// Adaptateur .pdf : extraction du texte avec pdf.js en Markdown minimal, traité comme du texte brut
// (document .md). À l'anonymisation, le PDF d'origine est aussi réécrit (pdfRewrite.ts) quand c'est
// possible sans risque : le .pdf devient le document principal, le .md reste produit.
import { t } from "../i18n/index.ts";
import type { Adapter, Doc, OriginalOutput } from "../engine/types.ts";
import { readText, writeText } from "./text.ts";

type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

let pdfjsPromise: Promise<PdfJs> | null = null;

async function loadPdfjs(): Promise<PdfJs> {
  pdfjsPromise ??= (async () => {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const isNode =
      typeof (globalThis as { process?: { versions?: { node?: string } } }).process?.versions?.node === "string";
    if (!isNode && !pdfjs.GlobalWorkerOptions.workerSrc) {
      // Navigateur : pdf.js lance son propre Worker (servi par l'application, aucune requête externe).
      const { default: url } = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
      pdfjs.GlobalWorkerOptions.workerSrc = url;
    }
    return pdfjs;
  })();
  return pdfjsPromise;
}

interface Item {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Line {
  y: number;
  h: number;
  items: Item[];
}

/** Regroupe les fragments en lignes (même ordonnée), puis en paragraphes (écart > 1,5 × hauteur de ligne). */
export function paragraphsOf(items: readonly Item[]): string[] {
  const lines: Line[] = [];
  for (const it of items) {
    if (!it.str.trim()) continue;
    const line = lines.find((l) => Math.abs(l.y - it.y) <= Math.max(l.h, it.h) * 0.5);
    if (line) {
      line.items.push(it);
      line.h = Math.max(line.h, it.h);
    } else lines.push({ y: it.y, h: it.h, items: [it] });
  }
  lines.sort((a, b) => b.y - a.y);
  const texts = lines.map((l) => {
    const sorted = [...l.items].sort((a, b) => a.x - b.x);
    let s = "";
    let prevEnd: number | null = null;
    for (const it of sorted) {
      if (prevEnd !== null && it.x - prevEnd > it.h * 0.2 && !s.endsWith(" ") && !it.str.startsWith(" ")) s += " ";
      s += it.str;
      prevEnd = it.x + it.w;
    }
    return s.replace(/\s+/g, " ").trim();
  });
  const paragraphs: string[] = [];
  let current: string[] = [];
  lines.forEach((l, i) => {
    const prev = lines[i - 1];
    if (prev && prev.y - l.y > prev.h * 1.5 && current.length) {
      paragraphs.push(current.join(" "));
      current = [];
    }
    current.push(texts[i] ?? "");
  });
  if (current.length) paragraphs.push(current.join(" "));
  return paragraphs.filter(Boolean);
}

export interface PdfExtraction {
  markdown: string;
  /** Fragments de texte bout à bout, sans séparateur (une ligne par page) : sert aux vérifications. */
  itemsText: string;
  pages: number;
  chars: number;
  pagesWithImages: number;
}

export async function extractPdf(file: ArrayBuffer): Promise<PdfExtraction> {
  const pdfjs = await loadPdfjs();
  // Aucune ressource externe : pas de polices standard, de cMaps ni de WASM téléchargés (texte seul).
  const task = pdfjs.getDocument({
    data: new Uint8Array(file.slice(0)),
    disableFontFace: true,
    useSystemFonts: false,
    useWorkerFetch: false,
    useWasm: false,
    stopAtErrors: false,
    verbosity: 0,
  });
  const doc = await task.promise;
  const IMAGE_OPS = new Set([
    pdfjs.OPS.paintImageXObject,
    pdfjs.OPS.paintInlineImageXObject,
    pdfjs.OPS.paintImageMaskXObject,
  ]);
  const pagesMd: string[] = [];
  const pagesItems: string[] = [];
  let chars = 0;
  let pagesWithImages = 0;
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      const items: Item[] = [];
      for (const raw of content.items) {
        if (!("str" in raw)) continue;
        const [, , c = 0, d = 0, x = 0, y = 0] = raw.transform as number[];
        items.push({ str: raw.str, x, y, w: raw.width, h: raw.height || Math.hypot(c, d) || 10 });
        chars += raw.str.replace(/\s/g, "").length;
      }
      pagesMd.push(paragraphsOf(items).join("\n\n"));
      pagesItems.push(items.map((it) => it.str).join(""));
      const ops = await page.getOperatorList();
      if (ops.fnArray.some((f) => IMAGE_OPS.has(f))) pagesWithImages++;
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }
  return {
    markdown: pagesMd.join("\n\n---\n\n") + "\n",
    itemsText: pagesItems.join("\n"),
    pages: doc.numPages,
    chars,
    pagesWithImages,
  };
}

export const SCANNED_THRESHOLD = 200;

interface State {
  /** État de l'adaptateur texte (le .md). */
  text: unknown;
  file: ArrayBuffer;
  /** Texte d'origine de chaque segment (le moteur remplace `segment.text`). */
  originals: string[];
  scanned: boolean;
}

async function read(file: ArrayBuffer): Promise<Doc> {
  const x = await extractPdf(file);
  const md = new TextEncoder().encode(x.markdown).buffer;
  // Texte brut (pas de règles Markdown) : une ligne « ~~~ » ou « ](… » d'un PDF ne doit rien masquer.
  const doc = readText(md, false, "md");
  const warnings: string[] = [];
  const scanned = x.pages > 0 && x.chars / x.pages < SCANNED_THRESHOLD;
  if (scanned) {
    warnings.push(t().pdf.scanned(Math.round(x.chars / x.pages)));
  }
  if (x.pagesWithImages) {
    warnings.push(t().pdf.pagesWithImages(x.pagesWithImages));
  }
  // Scanné : peu de texte et des images. Le PDF réécrit montrerait encore les données des images.
  const state: State = {
    text: doc.state,
    file,
    originals: doc.segments.map((s) => s.text),
    scanned: scanned && x.pagesWithImages > 0,
  };
  return { ...doc, format: "pdf", outputExtension: "md", warnings, state };
}

/** Valeurs remplacées (texte d'origine → token), d'après les édits du moteur. */
function replacementsOf(doc: Doc, originals: readonly string[]): { original: string; token: string }[] {
  const seen = new Map<string, string>();
  doc.segments.forEach((seg, i) => {
    const text = originals[i] ?? "";
    for (const e of seg.edits ?? []) {
      const original = text.slice(e.start, e.end);
      if (original && !seen.has(original)) seen.set(original, e.replacement);
    }
  });
  return [...seen].map(([original, token]) => ({ original, token }));
}

async function writeOriginal(doc: Doc): Promise<OriginalOutput> {
  const state = doc.state as State;
  if (state.scanned) {
    return { extension: "pdf", data: null, warnings: [t().pdf.notRewrittenScanned] };
  }
  let result;
  try {
    const { rewritePdf } = await import("./pdfRewrite.ts");
    result = await rewritePdf(state.file, replacementsOf(doc, state.originals));
  } catch (e) {
    result = { ok: false as const, reason: t().pdf.unexpected(e instanceof Error ? e.message : String(e)) };
  }
  if (!result.ok) {
    return { extension: "pdf", data: null, warnings: [t().pdf.notRewritten(result.reason)] };
  }
  const warnings = [t().pdf.rewritten];
  if (result.removed.length) warnings.push(t().pdf.removed(result.removed.join(", ")));
  return { extension: "pdf", data: result.data.slice().buffer, warnings };
}

export const pdfAdapter: Adapter = {
  extensions: ["pdf"],
  read,
  write: (doc) => Promise.resolve(writeText({ ...doc, state: (doc.state as State).text })),
  writeOriginal,
};
