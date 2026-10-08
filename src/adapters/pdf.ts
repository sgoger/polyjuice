// Adaptateur .pdf (lecture seule, pdf.js) : extraction du texte en Markdown minimal, ensuite traité
// par l'adaptateur Markdown. Le document produit est un .md.
import { pl } from "../engine/plural.ts";
import type { Adapter, Doc } from "../engine/types.ts";
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
      const ops = await page.getOperatorList();
      if (ops.fnArray.some((f) => IMAGE_OPS.has(f))) pagesWithImages++;
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }
  return { markdown: pagesMd.join("\n\n---\n\n") + "\n", pages: doc.numPages, chars, pagesWithImages };
}

export const SCANNED_THRESHOLD = 200;

async function read(file: ArrayBuffer): Promise<Doc> {
  const x = await extractPdf(file);
  const md = new TextEncoder().encode(x.markdown).buffer;
  const doc = readText(md, true, "md");
  const warnings = [
    "PDF converti en Markdown : la mise en forme d'origine n'est pas conservée, le document produit est un .md.",
  ];
  if (x.pages > 0 && x.chars / x.pages < SCANNED_THRESHOLD) {
    warnings.push(
      `PDF probablement scanné (${Math.round(x.chars / x.pages)} caractères par page en moyenne) : le texte contenu dans les images n'est pas extrait (pas d'OCR).`,
    );
  }
  if (x.pagesWithImages) {
    warnings.push(
      `${pl(x.pagesWithImages, "page contient", "pages contiennent")} des images : le texte contenu dans les images n'est pas traité.`,
    );
  }
  return { ...doc, format: "pdf", outputExtension: "md", warnings };
}

export const pdfAdapter: Adapter = {
  extensions: ["pdf"],
  read,
  write: (doc) => Promise.resolve(writeText(doc)),
};
