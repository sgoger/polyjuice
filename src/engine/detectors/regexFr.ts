// Détecteurs français, toujours actifs : NIR et téléphone national.
import type { Detection } from "../types.ts";
import { excludeTokens, NB, NE, runRules, type RegexRule } from "./util.ts";

const S = String.raw`[ . ]?`;
// Sexe, année, mois, département (2A/2B pour la Corse), commune, ordre, clé.
const NIR = new RegExp(
  String.raw`${NB}[1-478]${S}\d{2}${S}(?:0[1-9]|1[0-2]|[2-9]\d)${S}(?:\d{2}|2[AB])${S}\d{3}${S}\d{3}${S}\d{2}${NE}`,
  "giu",
);

/** Clé du NIR : 97 − (13 premiers caractères mod 97), 2A → 19, 2B → 18. */
export function nirKeyOk(m: string): boolean {
  const c = m.replace(/[ . ]/g, "").toUpperCase();
  if (c.length !== 15) return false;
  const body = c
    .slice(0, 13)
    .replace(/^(.{5})2A/, "$119")
    .replace(/^(.{5})2B/, "$118");
  if (!/^\d{13}$/.test(body)) return false;
  return 97 - Number(BigInt(body) % 97n) === Number(c.slice(13));
}

const PHONE_FR = new RegExp(String.raw`${NB}0[1-9](?:[ .\- ]?\d{2}){4}${NE}`, "gu");

export const FR_RULES: readonly RegexRule[] = [
  { type: "FR_NIR", re: NIR, validate: (m) => (nirKeyOk(m) ? m.length : null) },
  { type: "PHONE_NUMBER", re: PHONE_FR, score: 0.9 },
];

export function detectFr(text: string): Detection[] {
  return excludeTokens(text, runRules(text, FR_RULES));
}
