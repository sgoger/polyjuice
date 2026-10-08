// Application des remplacements : détections → tokens (via le mapping) → édits + nouveau texte.
import type { MappingStore } from "./mapping.ts";
import type { Detection, Edit } from "./types.ts";

export interface Replaced {
  text: string;
  /** Plages remplacées, en coordonnées du texte d'origine, triées. */
  edits: Edit[];
  /** Pour chaque édit, la détection d'origine et le token attribué. */
  tokens: { token: string; detection: Detection }[];
}

/** Applique des édits (sans chevauchement) de la fin vers le début. */
export function applyEdits(text: string, edits: readonly Edit[]): string {
  let out = text;
  for (const e of [...edits].sort((a, b) => b.start - a.start)) {
    out = out.slice(0, e.start) + e.replacement + out.slice(e.end);
  }
  return out;
}

/** Position, dans le texte final, de chaque édit (utile pour les rapports). */
export function finalSpans(edits: readonly Edit[]): { start: number; end: number }[] {
  let shift = 0;
  return [...edits]
    .sort((a, b) => a.start - b.start)
    .map((e) => {
      const start = e.start + shift;
      shift += e.replacement.length - (e.end - e.start);
      return { start, end: start + e.replacement.length };
    });
}

export async function replaceDetections(
  text: string,
  detections: readonly Detection[],
  store: MappingStore,
): Promise<Replaced> {
  const sorted = [...detections].sort((a, b) => a.start - b.start);
  const edits: Edit[] = [];
  const tokens: Replaced["tokens"] = [];
  for (const d of sorted) {
    const token = await store.getOrCreateToken(d.type, d.text, d.source);
    edits.push({ start: d.start, end: d.end, replacement: token });
    tokens.push({ token, detection: d });
  }
  return { text: applyEdits(text, edits), edits, tokens };
}
