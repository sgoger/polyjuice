// Liste de noms (deny-list) : correspondance exacte, insensible à la casse, accents respectés,
// sur frontières de mots Unicode. La liste n'est jamais stockée.
import type { Detection } from "../types.ts";
import { excludeTokens } from "./util.ts";

/** Un terme par ligne ; `#` introduit un commentaire ; lignes vides ignorées ; doublons retirés. */
export function parseNames(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of raw.split(/\r\n|\r|\n/)) {
    const term = line.replace(/#.*$/, "").trim().replace(/\s+/g, " ");
    if (!term) continue;
    const k = term.toLocaleLowerCase("fr");
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(term);
  }
  return out;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export class NameMatcher {
  private readonly re: RegExp | null;

  constructor(readonly terms: readonly string[]) {
    if (terms.length === 0) {
      this.re = null;
      return;
    }
    // Termes les plus longs d'abord, pour que « Jean Dupont » l'emporte sur « Jean ».
    // Les espaces internes acceptent tout blanc horizontal (espace, insécable…).
    const alternation = [...terms]
      .sort((a, b) => b.length - a.length)
      .map((t) =>
        t
          .split(" ")
          .map(escape)
          .join(String.raw`[\p{Zs}\t]+`),
      )
      .join("|");
    this.re = new RegExp(String.raw`(?<![\p{L}\p{N}\p{M}_])(?:${alternation})(?![\p{L}\p{N}\p{M}_])`, "giu");
  }

  detect(text: string): Detection[] {
    if (!this.re) return [];
    const out: Detection[] = [];
    for (const m of text.matchAll(this.re)) {
      out.push({ start: m.index, end: m.index + m[0].length, text: m[0], type: "PERSON", source: "names", score: 1 });
    }
    return excludeTokens(text, out);
  }
}
