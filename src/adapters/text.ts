// Adaptateur .txt / .md : un segment par ligne (ou par fragment de ligne hors zones protégées en Markdown).
// Fins de ligne et BOM préservés. En Markdown, les blocs de code clôturés et les cibles de liens et
// d'images `](…)` ne sont jamais modifiés ; le texte des liens est traité.
import type { Adapter, Doc, Segment } from "../engine/types.ts";

interface Locator {
  line: number;
  start: number;
  /** Longueur du fragment d'origine. */
  length: number;
}

interface State {
  bom: boolean;
  lines: string[];
  /** Séparateur qui suit chaque ligne ("" pour la dernière). */
  seps: string[];
}

const BOM = [0xef, 0xbb, 0xbf];

export function decodeUtf8(file: ArrayBuffer): { text: string; bom: boolean } {
  const bytes = new Uint8Array(file);
  const bom = BOM.every((b, i) => bytes[i] === b);
  return {
    text: new TextDecoder("utf-8", { fatal: false, ignoreBOM: true }).decode(bom ? bytes.subarray(3) : bytes),
    bom,
  };
}

export function splitLines(text: string): { lines: string[]; seps: string[] } {
  const lines: string[] = [];
  const seps: string[] = [];
  const re = /\r\n|\n|\r/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    lines.push(text.slice(last, m.index));
    seps.push(m[0]);
    last = m.index + m[0].length;
  }
  lines.push(text.slice(last));
  seps.push("");
  return { lines, seps };
}

const FENCE = /^ {0,3}(`{3,}|~{3,})/;

/** Plages protégées d'une ligne Markdown : cibles `(…)` suivant `]`, parenthèses incluses et équilibrées. */
export function protectedRanges(line: string): [number, number][] {
  const out: [number, number][] = [];
  let i = line.indexOf("](");
  while (i >= 0) {
    const start = i + 2;
    let depth = 1;
    let j = start;
    for (; j < line.length && depth > 0; j++) {
      const c = line[j];
      if (c === "\\") j++;
      else if (c === "(") depth++;
      else if (c === ")") depth--;
    }
    const end = depth === 0 ? j : line.length;
    out.push([start - 1, end]);
    i = line.indexOf("](", end);
  }
  return out;
}

export function readText(file: ArrayBuffer, markdown: boolean, format: "txt" | "md"): Doc {
  const { text, bom } = decodeUtf8(file);
  const { lines, seps } = splitLines(text);
  const segments: Segment[] = [];
  let fence: string | null = null;
  for (const [n, line] of lines.entries()) {
    if (markdown) {
      const f = FENCE.exec(line);
      if (fence) {
        if (f?.[1]?.startsWith(fence.charAt(0)) && f[1].length >= fence.length && line.trim() === f[1]) fence = null;
        continue;
      }
      if (f?.[1]) {
        fence = f[1];
        continue;
      }
    }
    const ranges = markdown ? protectedRanges(line) : [];
    let pos = 0;
    for (const [s, e] of [...ranges, [line.length, line.length] as [number, number]]) {
      if (s > pos) {
        const locator: Locator = { line: n, start: pos, length: s - pos };
        segments.push({ locator, text: line.slice(pos, s), kind: "body" });
      }
      pos = e;
    }
  }
  const state: State = { bom, lines, seps };
  const warnings = fence
    ? ["Bloc de code Markdown non refermé : tout le texte qui suit l'ouverture du bloc n'est pas traité."]
    : [];
  return { format, outputExtension: format, segments, warnings, state };
}

export function writeText(doc: Doc): ArrayBuffer {
  const state = doc.state as State;
  const lines = [...state.lines];
  // De la fin vers le début dans chaque ligne, pour que les positions restent valides.
  const segs = [...doc.segments].sort((a, b) => {
    const la = a.locator as Locator;
    const lb = b.locator as Locator;
    return la.line - lb.line || lb.start - la.start;
  });
  for (const seg of segs) {
    const { line, start, length } = seg.locator as Locator;
    const cur = lines[line] ?? "";
    lines[line] = cur.slice(0, start) + seg.text + cur.slice(start + length);
  }
  const body = lines.map((l, i) => l + (state.seps[i] ?? "")).join("");
  const encoded = new TextEncoder().encode(body);
  const out = new Uint8Array((state.bom ? 3 : 0) + encoded.length);
  if (state.bom) out.set(BOM);
  out.set(encoded, state.bom ? 3 : 0);
  return out.buffer;
}

export const txtAdapter: Adapter = {
  extensions: ["txt"],
  read: (file) => Promise.resolve(readText(file, false, "txt")),
  write: (doc) => Promise.resolve(writeText(doc)),
};

export const mdAdapter: Adapter = {
  extensions: ["md"],
  read: (file) => Promise.resolve(readText(file, true, "md")),
  write: (doc) => Promise.resolve(writeText(doc)),
};
