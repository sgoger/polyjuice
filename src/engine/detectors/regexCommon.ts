// Détecteurs indépendants de la langue : e-mail, IBAN, URL, IP, carte bancaire, téléphone international.
import type { Detection } from "../types.ts";
import { B, digitsOf, E, excludeTokens, NB, NE, runRules, type RegexRule } from "./util.ts";

const EMAIL = new RegExp(
  String.raw`${B}[\p{L}\p{N}._%+\-]+@(?:[\p{L}\p{N}](?:[\p{L}\p{N}\-]*[\p{L}\p{N}])?\.)+\p{L}{2,}${E}`,
  "gu",
);

const URL_RE = new RegExp(String.raw`${B}(?:(?:https?|ftp)://|www\.)[^\s<>"'⟦⟧]+`, "giu");

/** Retire la ponctuation finale ; garde une parenthèse fermante équilibrée. */
export function trimUrl(s: string): number {
  let end = s.length;
  for (;;) {
    const c = s.charAt(end - 1);
    if (/[.,;:!?'"»…\]}]/.test(c)) end--;
    else if (c === ")") {
      const body = s.slice(0, end);
      if ((body.match(/\(/g) ?? []).length < (body.match(/\)/g) ?? []).length) end--;
      else break;
    } else break;
  }
  return end;
}

const OCTET = String.raw`(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)`;
const IPV4 = new RegExp(String.raw`(?<![\p{L}\p{N}.])(?:${OCTET}\.){3}${OCTET}(?![\p{L}\p{N}]|\.\d)`, "gu");

const IPV6 = new RegExp(
  String.raw`(?<![\p{L}\p{N}:])(?:[0-9A-Fa-f]{0,4}:){2,7}(?:(?:\d{1,3}\.){3}\d{1,3}|[0-9A-Fa-f]{1,4})?(?![\p{L}\p{N}:])`,
  "gu",
);

export function isIPv6(s: string): boolean {
  if (!s.includes("::") && s.split(":").length < 8) return false;
  if (s.replace(/[:.]/g, "") === "") return false;
  try {
    new URL(`http://[${s}]/`);
    return true;
  } catch {
    return false;
  }
}

// IBAN : 2 lettres, 2 chiffres de contrôle, 11 à 30 caractères, groupés par des espaces optionnels.
const IBAN = new RegExp(String.raw`${B}[A-Z]{2}\d{2}(?:[  ]?[A-Z0-9]){11,30}${E}`, "gu");

export function ibanChecksumOk(compact: string): boolean {
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(compact)) return false;
  const rearranged = compact.slice(4) + compact.slice(0, 4);
  let rest = 0;
  for (const ch of rearranged) {
    const v = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
    for (const d of v) rest = (rest * 10 + Number(d)) % 97;
  }
  return rest === 1;
}

/** Plus longue troncature (à une frontière de groupe) dont la clé est valide. */
function validateIban(m: string): number | null {
  const ends = [m.length];
  for (let i = m.length - 1; i > 0; i--) if (m[i] === " " || m[i] === " ") ends.push(i);
  for (const end of ends) {
    if (ibanChecksumOk(m.slice(0, end).replace(/[  ]/g, ""))) return end;
  }
  return null;
}

const CARD = new RegExp(String.raw`${NB}\d(?:[ \- ]?\d){12,18}${NE}`, "gu");

export function luhnOk(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

const validateCard = (m: string) => {
  const d = digitsOf(m);
  return /^[2-6]/.test(d) && luhnOk(d) ? m.length : null;
};

// Téléphone international : +CC ou 00CC, « (0) » optionnel, groupes séparés par espace, point ou tiret.
const PHONE_INTL = new RegExp(
  String.raw`(?<![\p{L}\p{N}+]|\d[ .\- ])(?:\+|00)[1-9]\d{0,2}(?:[ .\- ]?\(0\))?(?:[ .\- ]?\d{1,4}){2,7}${NE}`,
  "gu",
);

const validatePhoneIntl = (m: string) => {
  const d = digitsOf(m.replace(/^00/, "").replace(/\(0\)/, ""));
  return d.length >= 8 && d.length <= 15 ? m.length : null;
};

export const COMMON_RULES: readonly RegexRule[] = [
  { type: "EMAIL_ADDRESS", re: EMAIL },
  { type: "URL", re: URL_RE, validate: trimUrl },
  { type: "IP_ADDRESS", re: IPV4 },
  { type: "IP_ADDRESS", re: IPV6, validate: (m) => (isIPv6(m) ? m.length : null) },
  { type: "IBAN_CODE", re: IBAN, validate: validateIban },
  { type: "CREDIT_CARD", re: CARD, validate: validateCard, score: 0.95 },
  { type: "PHONE_NUMBER", re: PHONE_INTL, validate: validatePhoneIntl, score: 0.9 },
];

export function detectCommon(text: string): Detection[] {
  return excludeTokens(text, runRules(text, COMMON_RULES));
}
