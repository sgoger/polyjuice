// Utilitaires communs aux détecteurs à base d'expressions régulières.
import { tokenRanges } from "../tokens.ts";
import type { Detection, EntityType } from "../types.ts";

/** Pas de lettre ni de chiffre (Unicode) juste avant. `\b` est ASCII en JS. */
export const B = String.raw`(?<![\p{L}\p{N}])`;
/** Pas de lettre ni de chiffre (Unicode) juste après. */
export const E = String.raw`(?![\p{L}\p{N}])`;
/**
 * Pour les numéros : mêmes frontières. Deux numéros séparés par un simple espace restent deux
 * détections distinctes ; on préfère sur-détecter (troncature d'une longue suite de chiffres)
 * plutôt que de laisser passer un numéro collé à un autre.
 */
export const NB = B;
export const NE = E;

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
    const re = new RegExp(rule.re.source, rule.re.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const len = rule.validate ? rule.validate(m[0]) : m[0].length;
      if (len === null || len <= 0) {
        // Correspondance rejetée : on réessaie à partir du caractère suivant.
        re.lastIndex = m.index + 1;
        continue;
      }
      out.push({
        start: m.index,
        end: m.index + len,
        text: m[0].slice(0, len),
        type: rule.type,
        source: "regex",
        score: rule.score ?? 1,
      });
      // Correspondance réduite par la validation : la suite peut contenir une autre entité.
      re.lastIndex = m.index + len;
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

/**
 * Plus longue troncature de `m`, à une frontière de groupe (fin de chaîne ou séparateur précédé d'un
 * caractère alphanumérique), qui satisfait `ok`. Une regex gourmande peut avaler le numéro suivant :
 * on essaie alors des longueurs décroissantes. Renvoie la longueur retenue, ou null.
 */
export function longestValidPrefix(m: string, ok: (candidate: string) => boolean): number | null {
  if (ok(m)) return m.length;
  for (let i = m.length - 1; i > 0; i--) {
    if (/[ .\-\u00A0]/.test(m.charAt(i)) && /[\p{L}\p{N})]/u.test(m.charAt(i - 1)) && ok(m.slice(0, i))) return i;
  }
  return null;
}
