// Orchestration de la détection : regex + liste de noms (+ NER si activée) → Detection[] sans chevauchement.
import { NameMatcher } from "./detectors/names.ts";
import type { NerProvider } from "./detectors/ner.ts";
import { detectCommon } from "./detectors/regexCommon.ts";
import { detectFr } from "./detectors/regexFr.ts";
import { excludeTokens } from "./detectors/util.ts";
import { isToken } from "./tokens.ts";
import type { Detection, Segment } from "./types.ts";

export interface DetectOptions {
  /** Liste de noms ; null ou vide = pas de détection par liste. */
  names?: NameMatcher | null;
  /** Fournisseur NER chargé ; null = NER désactivée. */
  ner?: NerProvider | null;
}

/** Détection sur un segment. Les segments `wholeCell` sont remplacés intégralement, sans détection. */
export async function detectSegment(segment: Segment, options: DetectOptions): Promise<Detection[]> {
  const { text } = segment;
  if (segment.wholeCell) return wholeCell(text);
  const found: Detection[] = [...detectCommon(text), ...detectFr(text)];
  if (options.names) found.push(...options.names.detect(text));
  if (options.ner) found.push(...(await options.ner.detect(text)));
  const normalized = found.flatMap((d) => normalize(text, d));
  return resolveOverlaps(text, excludeTokens(text, normalized));
}

function wholeCell(text: string): Detection[] {
  const start = text.search(/\S/);
  if (start < 0) return [];
  const end = text.trimEnd().length;
  const value = text.slice(start, end);
  if (isToken(value)) return [];
  return [{ start, end, text: value, type: "PERSON", source: "columns", score: 1 }];
}

/**
 * Coupe une détection aux tabulations et sauts de ligne (qui correspondent à des éléments non textuels
 * des documents) et retire la ponctuation et les blancs en bordure (NER, liste).
 */
function normalize(text: string, d: Detection): Detection[] {
  if (d.source === "regex") return [d];
  const out: Detection[] = [];
  const re = /[^\t\n\r\v\f]+/g;
  for (const m of text.slice(d.start, d.end).matchAll(re)) {
    let s = d.start + m.index;
    let e = s + m[0].length;
    while (s < e && /[\s.,;:!?«»"“”(]/u.test(text.charAt(s))) s++;
    while (e > s && /[\s.,;:!?«»"“”)]/u.test(text.charAt(e - 1))) e--;
    if (e > s) out.push({ ...d, start: s, end: e, text: text.slice(s, e) });
  }
  return out;
}

/**
 * Garde la plus longue, puis la plus confiante ; à égalité, la première. Une détection écartée qui
 * déborde de celle retenue l'étend (union des plages) : un chevauchement partiel ne laisse jamais
 * de fragment en clair. Résultat trié par position.
 */
export function resolveOverlaps(text: string, detections: readonly Detection[]): Detection[] {
  const ranked = [...detections].sort(
    (a, b) => b.end - b.start - (a.end - a.start) || b.score - a.score || a.start - b.start,
  );
  let kept: Detection[] = [];
  for (const d of ranked) {
    const hits = kept.filter((k) => d.start < k.end && k.start < d.end);
    const winner = hits[0];
    if (!winner) {
      kept.push(d);
      continue;
    }
    if (hits.length === 1 && winner.start <= d.start && d.end <= winner.end) continue;
    const start = Math.min(d.start, ...hits.map((h) => h.start));
    const end = Math.max(d.end, ...hits.map((h) => h.end));
    kept = kept.filter((k) => !hits.includes(k));
    kept.push({ ...winner, start, end, text: text.slice(start, end) });
  }
  return kept.sort((a, b) => a.start - b.start);
}

export { NameMatcher };
