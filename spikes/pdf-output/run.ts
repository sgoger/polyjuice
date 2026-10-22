// Spike : produire un PDF anonymisé plutôt qu'un .md. Compare, sur un corpus, la réécriture des flux
// de contenu (B, celle retenue dans src/adapters/pdfRewrite.ts), la rastérisation (C) et mesure ce
// qu'aurait coûté la réécriture avec décalage de la suite de la ligne (A). D (régénération) n'est pas
// mesurée : le .md couvre déjà ce besoin.
//
// À lancer depuis la racine du dépôt (utilise le code et les dépendances de l'application) :
//   npx tsx spikes/pdf-output/run.ts [--out dossier] [--mapping fichier.pdf=mapping.json] fichier.pdf…
// Sans --mapping, la détection est celle de l'application sans IA (motifs + liste de noms des fixtures).
// Les PDF produits sont écrits dans --out (par défaut spikes/out/pdf-output, ignoré par git), avec pour
// chacun les valeurs et tokens (<nom>.values.json, contient les données : ne pas commiter) pour la
// contre-vérification par MuPDF : uv run spikes/pdf-output/mupdf_check.py <dossier>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { extractPdf } from "../../src/adapters/pdf.ts";
import { parseContent } from "../../src/adapters/pdfContent.ts";
import {
  findMatches,
  interpret,
  lineRuns,
  remainingValues,
  rewritePdf,
  runQuad,
  tokenWidth,
  type Replacement,
} from "../../src/adapters/pdfRewrite.ts";
import { anonymize } from "../../src/worker/pipeline.ts";

const ROOT = resolve(import.meta.dirname, "../..");
const STANDARD_FONTS = join(ROOT, "node_modules/pdfjs-dist/standard_fonts/");
const DPI_COMPARE = 100;
const DPI_RASTER = 150;

const args = process.argv.slice(2);
let out = join(import.meta.dirname, "../out/pdf-output");
const mappings = new Map<string, string>();
const files: string[] = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i] ?? "";
  if (a === "--out") out = args[++i] ?? out;
  else if (a === "--mapping") {
    const [pdf, json] = (args[++i] ?? "").split("=");
    if (pdf && json) mappings.set(resolve(pdf), json);
  } else files.push(a);
}
mkdirSync(out, { recursive: true });

const ab = (b: Uint8Array | Buffer): ArrayBuffer => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
const ms = (t: number) => Math.round(performance.now() - t);
const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;

async function replacementsFor(file: string, data: ArrayBuffer): Promise<Replacement[]> {
  const json = mappings.get(resolve(file));
  let mapping: { entities: Record<string, { original: string }> };
  if (json) mapping = JSON.parse(readFileSync(json, "utf8")) as typeof mapping;
  else {
    const names = readFileSync(join(ROOT, "tests/fixtures/fixture-names.txt"), "utf8");
    const ctx = { progress: () => undefined, checkCancelled: () => undefined };
    const r = await anonymize(
      { file: data.slice(0), fileName: "x.pdf", names, ner: false, columns: [], mapping: null },
      ctx,
    );
    mapping = JSON.parse(new TextDecoder().decode(r.mapping.data)) as typeof mapping;
  }
  return Object.entries(mapping.entities).map(([token, e]) => ({ token, original: e.original }));
}

// ---------------------------------------------------------------------------
// Analyse (zones caviardées, mesures pour A)

interface PageZones {
  quads: { quad: [number, number][]; token: string; first: boolean }[];
}

interface Analysis {
  pages: PageZones[];
  fonts: Record<string, number>;
  matches: number;
  /** A : token plus large que la valeur (la suite de la ligne devrait être décalée). */
  wider: number;
  /** A : décalage qui ferait sortir la ligne de la marge droite de la page. */
  overflow: number;
  /** A : polices d'origine qui contiennent tous les caractères du token (⟦ ⟧ compris). */
  fontHasToken: number;
  formsWithText: number;
}

async function analyze(data: ArrayBuffer, reps: Replacement[]): Promise<Analysis> {
  const doc = await PDFDocument.load(data, { updateMetadata: false });
  const ctx = doc.context;
  const res: Analysis = { pages: [], fonts: {}, matches: 0, wider: 0, overflow: 0, fontHasToken: 0, formsWithText: 0 };
  for (const page of doc.getPages()) {
    const contents = page.node.Contents();
    const streams = contents instanceof PDFArray ? contents.asArray() : contents ? [contents] : [];
    const parts = streams.map((s) => {
      const st = ctx.lookup(s);
      return st instanceof PDFRawStream ? decodePDFRawStream(st).decode() : new Uint8Array();
    });
    const bytes = new Uint8Array(parts.reduce((n, p) => n + p.length + 1, 0));
    let p = 0;
    for (const part of parts) {
      bytes.set(part, p);
      p += part.length + 1;
      bytes[p - 1] = 10;
    }
    const resources = ctx.lookup(page.node.getInheritableAttribute(PDFName.of("Resources")));
    const dict = resources instanceof PDFDict ? resources : undefined;
    const unit = interpret(ctx, parseContent(bytes), dict);
    for (const f of unit.forms) {
      const st = ctx.lookup(f);
      if (st instanceof PDFRawStream && /T[jJ*']/.test(new TextDecoder("latin1").decode(decodePDFRawStream(st).decode()))) {
        res.formsWithText++;
      }
    }
    const fonts = ctx.lookup(dict?.get(PDFName.of("Font")));
    if (fonts instanceof PDFDict) {
      for (const [, ref] of fonts.entries()) {
        const f = ctx.lookup(ref);
        if (!(f instanceof PDFDict)) continue;
        const sub = f.get(PDFName.of("Subtype"))?.toString() ?? "?";
        const enc = ctx.lookup(f.get(PDFName.of("Encoding")))?.toString() ?? "";
        const key = `${sub}${sub === "/Type0" ? ` ${enc}` : ""}${f.has(PDFName.of("ToUnicode")) ? " +ToUnicode" : ""}`;
        res.fonts[key] = (res.fonts[key] ?? 0) + 1;
      }
    }
    const matches = findMatches(unit, reps);
    res.matches += matches.length;
    const rightMargin = Math.max(0, ...unit.glyphs.map((g) => g.end[0]));
    const zones: PageZones = { quads: [] };
    for (const m of matches) {
      const runs = lineRuns(unit.glyphs, m.glyphs);
      runs.forEach((run, k) => {
        zones.quads.push({ quad: runQuad(unit.glyphs, run), token: m.token, first: k === 0 });
      });
      const first = unit.glyphs[m.glyphs[0] ?? -1];
      if (!first) continue;
      const tokenUser = ((tokenWidth(m.token) / 1000) * first.size * Math.hypot(first.trm[0], first.trm[1])) / first.size;
      const budgetUser = (m.budget / (first.size * first.th)) * Math.hypot(first.trm[0], first.trm[1]);
      const delta = tokenUser - budgetUser;
      if (delta > 0.5) {
        res.wider++;
        // Fin de la ligne : dernier glyphe sur la même ligne de base que le premier glyphe retiré.
        const lineEnd = Math.max(
          ...unit.glyphs.filter((g) => Math.abs(g.trm[5] - first.trm[5]) < 1).map((g) => g.end[0]),
        );
        if (lineEnd + delta > rightMargin + 0.5) res.overflow++;
      }
      // Les glyphes ⟦ ⟧ ne figurent dans aucune police d'origine rencontrée : on vérifie leur présence par le texte.
      const fontText = new Set(unit.glyphs.filter((g) => g.fontName === first.fontName).map((g) => g.text));
      if ([..."⟦⟧"].every((c) => fontText.has(c))) res.fontHasToken++;
    }
    res.pages.push(zones);
  }
  return res;
}

// ---------------------------------------------------------------------------
// Rendu (pdf.js + canvas Node)

async function render(data: ArrayBuffer, dpi: number) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({ data: new Uint8Array(data.slice(0)), standardFontDataUrl: STANDARD_FONTS, verbosity: 0 });
  const doc = await task.promise;
  const pages: { width: number; height: number; scale: number; pixels: Uint8ClampedArray; canvas: ReturnType<typeof createCanvas> }[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const viewport = page.getViewport({ scale: dpi / 72 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext("2d");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({
      canvas: canvas as unknown as HTMLCanvasElement,
      canvasContext: context as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;
    pages.push({
      width: canvas.width,
      height: canvas.height,
      scale: dpi / 72,
      pixels: context.getImageData(0, 0, canvas.width, canvas.height).data,
      canvas,
    });
  }
  await task.destroy();
  return pages;
}

/** Masque (pixels) des zones caviardées, dilaté de `margin` pixels. */
function zoneMask(width: number, height: number, scale: number, pageHeight: number, zones: PageZones, margin: number) {
  const canvas = createCanvas(width, height);
  const c = canvas.getContext("2d");
  c.fillStyle = "#000";
  c.strokeStyle = "#000";
  c.lineWidth = margin * 2;
  for (const z of zones.quads) {
    c.beginPath();
    z.quad.forEach(([x, y], k) => {
      const px = x * scale;
      const py = (pageHeight - y) * scale;
      if (k === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    });
    c.closePath();
    c.fill();
    c.stroke();
  }
  const d = c.getImageData(0, 0, width, height).data;
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) mask[i] = (d[i * 4 + 3] ?? 0) > 0 ? 1 : 0;
  return mask;
}

function diff(a: Uint8ClampedArray, b: Uint8ClampedArray, mask: Uint8Array) {
  let outside = 0;
  let outsideTotal = 0;
  let inside = 0;
  let insideTotal = 0;
  for (let i = 0; i < mask.length; i++) {
    const d = Math.max(
      Math.abs((a[i * 4] ?? 0) - (b[i * 4] ?? 0)),
      Math.abs((a[i * 4 + 1] ?? 0) - (b[i * 4 + 1] ?? 0)),
      Math.abs((a[i * 4 + 2] ?? 0) - (b[i * 4 + 2] ?? 0)),
    );
    if (mask[i]) {
      insideTotal++;
      if (d > 32) inside++;
    } else {
      outsideTotal++;
      if (d > 32) outside++;
    }
  }
  return { outside: outside / Math.max(1, outsideTotal), inside: inside / Math.max(1, insideTotal) };
}

async function pageHeights(data: ArrayBuffer): Promise<number[]> {
  const doc = await PDFDocument.load(data, { updateMetadata: false });
  return doc.getPages().map((p) => p.getHeight());
}

// ---------------------------------------------------------------------------
// C : rastérisation

async function rasterize(data: ArrayBuffer, analysis: Analysis): Promise<Uint8Array> {
  const pages = await render(data, DPI_RASTER);
  const heights = await pageHeights(data);
  const sizes = (await PDFDocument.load(data, { updateMetadata: false })).getPages().map((p) => p.getSize());
  const outDoc = await PDFDocument.create({ updateMetadata: false });
  for (const [i, page] of pages.entries()) {
    const c = page.canvas.getContext("2d") as SKRSContext2D;
    const zones = analysis.pages[i] ?? { quads: [] };
    const h = heights[i] ?? 842;
    for (const z of zones.quads) {
      c.fillStyle = "#e0e0e0";
      c.beginPath();
      z.quad.forEach(([x, y], k) => {
        if (k === 0) c.moveTo(x * page.scale, (h - y) * page.scale);
        else c.lineTo(x * page.scale, (h - y) * page.scale);
      });
      c.closePath();
      c.fill();
      if (z.first) {
        const [bl, , tl] = [z.quad[0], z.quad[1], z.quad[3]];
        if (!bl || !tl) continue;
        const heightPx = Math.hypot(tl[0] - bl[0], tl[1] - bl[1]) * page.scale;
        c.fillStyle = "#000";
        c.font = `${Math.round(heightPx * 0.75)}px sans-serif`;
        c.fillText(z.token, bl[0] * page.scale, (h - bl[1]) * page.scale - heightPx * 0.2);
      }
    }
    const jpg = await page.canvas.encode("jpeg", 85);
    const img = await outDoc.embedJpg(jpg);
    const size = sizes[i] ?? { width: 595, height: 842 };
    outDoc.addPage([size.width, size.height]).drawImage(img, { x: 0, y: 0, width: size.width, height: size.height });
  }
  return outDoc.save();
}

// ---------------------------------------------------------------------------

interface Row {
  file: string;
  size: number;
  values: number;
  analysis: Analysis;
  b: { ok: boolean; reason?: string; ms: number; size: number; diffOutside?: number; leftValues?: number; tokens?: string };
  c: { ms: number; size: number; diffOutside: number; leftValues: number; tokens: string };
}

const rows: Row[] = [];
for (const file of files) {
  const buf = readFileSync(file);
  const data = ab(buf);
  const reps = await replacementsFor(file, data);
  const originals = [...new Set(reps.map((r) => r.original))];
  const analysis = await analyze(data, reps);
  const name = basename(file, ".pdf");

  // B
  let t = performance.now();
  const b = await rewritePdf(data.slice(0), reps);
  const bMs = ms(t);
  const row: Row = {
    file: name,
    size: buf.length,
    values: originals.length,
    analysis,
    b: { ok: b.ok, ms: bMs, size: b.ok ? b.data.length : 0, ...(b.ok ? {} : { reason: b.reason }) },
    c: { ms: 0, size: 0, diffOutside: 0, leftValues: 0, tokens: "" },
  };
  const heights = await pageHeights(data);
  const before = await render(data, DPI_COMPARE);
  writeFileSync(join(out, `${name}.values.json`), JSON.stringify(reps));
  if (b.ok) {
    writeFileSync(join(out, `${name}.B.pdf`), b.data);
    const after = await render(ab(b.data), DPI_COMPARE);
    let worst = 0;
    after.forEach((p, i) => {
      const ref = before[i];
      if (!ref) return;
      const mask = zoneMask(p.width, p.height, p.scale, heights[i] ?? 842, analysis.pages[i] ?? { quads: [] }, 3);
      worst = Math.max(worst, diff(ref.pixels, p.pixels, mask).outside);
    });
    const x = await extractPdf(ab(b.data));
    const txt = `${x.markdown}\n${x.itemsText}`;
    row.b.diffOutside = worst;
    row.b.leftValues = remainingValues(txt, originals).length;
    row.b.tokens = `${reps.filter((r) => x.markdown.includes(r.token)).length}/${reps.length}`;
  }

  // C
  t = performance.now();
  const c = await rasterize(data, analysis);
  row.c.ms = ms(t);
  row.c.size = c.length;
  writeFileSync(join(out, `${name}.C.pdf`), c);
  const cPages = await render(ab(c), DPI_COMPARE);
  let worst = 0;
  cPages.forEach((p, i) => {
    const ref = before[i];
    if (!ref) return;
    const mask = zoneMask(p.width, p.height, p.scale, heights[i] ?? 842, analysis.pages[i] ?? { quads: [] }, 3);
    worst = Math.max(worst, diff(ref.pixels, p.pixels, mask).outside);
  });
  const cx = await extractPdf(ab(c));
  row.c.diffOutside = worst;
  row.c.leftValues = remainingValues(`${cx.markdown}\n${cx.itemsText}`, originals).length;
  row.c.tokens = `${reps.filter((r) => cx.markdown.includes(r.token)).length}/${reps.length}`;
  rows.push(row);
}

const pct = (v: number | undefined) => (v === undefined ? "—" : `${(v * 100).toFixed(2)} %`);
console.log("\n| Fichier | Taille | Polices | Valeurs / occurrences | B : résultat | B : temps | B : taille | B : pixels modifiés hors zones | B : valeurs restantes / tokens lus | C : temps | C : taille | C : pixels modifiés hors zones | C : tokens lus | A : token plus large / débordement |");
console.log("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
for (const r of rows) {
  const fonts = Object.entries(r.analysis.fonts)
    .map(([k, v]) => `${v}× ${k}`)
    .join(", ");
  console.log(
    `| ${r.file} | ${kb(r.size)} | ${fonts}${r.analysis.formsWithText ? `, ${r.analysis.formsWithText} formulaire(s) avec texte` : ""} | ${r.values} / ${r.analysis.matches} | ${r.b.ok ? "PDF" : `refus : ${r.b.reason ?? ""}`} | ${r.b.ms} ms | ${r.b.ok ? kb(r.b.size) : "—"} | ${pct(r.b.diffOutside)} | ${r.b.ok ? `${r.b.leftValues ?? "?"} / ${r.b.tokens ?? "?"}` : "—"} | ${r.c.ms} ms | ${kb(r.c.size)} | ${pct(r.c.diffOutside)} | ${r.c.tokens} | ${r.analysis.wider} / ${r.analysis.overflow} (police avec ⟦ ⟧ : ${r.analysis.fontHasToken}) |`,
  );
}
console.log(`\nPDF produits dans ${out}`);
