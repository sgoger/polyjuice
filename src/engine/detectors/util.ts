// Utilitaires communs aux détecteurs à base d'expressions régulières.
import { tokenRanges } from "../tokens.ts";
import type { Detection, EntityType } from "../types.ts";

/** Pas de lettre ni de chiffre (Unicode) juste avant. `\b` est ASCII en JS. */
export const B = String.raw`(?<![\p{L}\p{N}])`;
/** Pas de lettre ni de chiffre (Unicode) juste après. */
export const E = String.raw`(?![\p{L}\p{N}])`;
/** Pour les numéros : pas de chiffre ni de séparateur + chiffre de part et d'autre. */
export const NB = String.raw`(?<![\p{L}\p{N}]|\d[ .\- ])`;
export const NE = String.raw`(?![\p{L}\p{N}]|[ .\- ]\d)`;

export interface RegexRule {
  type: EntityType;
  re: RegExp;
  score?: number;
  /** Valide (et éventuellement réduit) la correspondance ; renvoie la longueur retenue ou null. */
  validate?: (match: string) => number | null;
}

export function runRules(text: string, rules: readonly RegexRule[]): Detection[] {
  const out: Detection[] = [];
  for (const rule of rules) {
    for (const m of text.matchAll(rule.re)) {
      const len = rule.validate ? rule.validate(m[0]) : m[0].length;
      if (len === null || len <= 0) continue;
      out.push({
        start: m.index,
        end: m.index + len,
        text: m[0].slice(0, len),
        type: rule.type,
        source: "regex",
        score: rule.score ?? 1,
      });
    }
  }
  return out;
}

/** Retire les détections qui chevauchent un token ⟦…⟧ déjà présent. */
export function excludeTokens(text: string, detections: Detection[]): Detection[] {
  const ranges = tokenRanges(text);
  if (ranges.length === 0) return detections;
  return detections.filter((d) => !ranges.some(([s, e]) => d.start < e && s < d.end));
}

export const digitsOf = (s: string): string => s.replace(/\D/g, "");
