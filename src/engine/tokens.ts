// Tokens ⟦X-ABCDE⟧ : dérivation déterministe par HMAC-SHA256(salt, type + "\0" + original).
import type { EntityType } from "./types.ts";

export const TOKEN_OPEN = "⟦"; // ⟦
export const TOKEN_CLOSE = "⟧"; // ⟧
export const TOKEN_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const TOKEN_LENGTH = 5;

export const TYPE_LETTERS: Readonly<Record<EntityType, string>> = {
  PERSON: "P",
  ORGANIZATION: "O",
  LOCATION: "L",
  EMAIL_ADDRESS: "E",
  PHONE_NUMBER: "T",
  IBAN_CODE: "I",
  CREDIT_CARD: "C",
  URL: "U",
  IP_ADDRESS: "A",
  FR_NIR: "N",
};

const LETTERS = Object.values(TYPE_LETTERS).join("");

/** Token valide : lettre de type, 5 caractères de l'alphabet, suffixe numérique optionnel (collision). */
export const TOKEN_SOURCE = `${TOKEN_OPEN}[${LETTERS}]-[${TOKEN_ALPHABET}]{${TOKEN_LENGTH}}(?:[2-9]|[1-9]\\d+)?${TOKEN_CLOSE}`;

/** Nouvelle instance globale à chaque appel (les regex `g` sont à état). */
export const tokenRegex = (): RegExp => new RegExp(TOKEN_SOURCE, "gu");

export const isToken = (s: string): boolean => new RegExp(`^${TOKEN_SOURCE}$`, "u").test(s);

/** Plages [start, end) des tokens présents dans un texte. */
export function tokenRanges(text: string): [number, number][] {
  return [...text.matchAll(tokenRegex())].map((m) => [m.index, m.index + m[0].length]);
}

const encoder = new TextEncoder();
const keyCache = new WeakMap<Uint8Array, Promise<CryptoKey>>();

function importKey(salt: Uint8Array): Promise<CryptoKey> {
  let key = keyCache.get(salt);
  if (!key) {
    key = crypto.subtle.importKey("raw", salt as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    keyCache.set(salt, key);
  }
  return key;
}

/** Encode les 40 premiers bits du condensat en 5 caractères de l'alphabet (base 31). */
export function encodeDigest(digest: Uint8Array): string {
  let n = 0;
  for (let i = 0; i < 5; i++) n = n * 256 + (digest[i] ?? 0);
  let out = "";
  for (let i = 0; i < TOKEN_LENGTH; i++) {
    out += TOKEN_ALPHABET.charAt(n % TOKEN_ALPHABET.length);
    n = Math.floor(n / TOKEN_ALPHABET.length);
  }
  return out;
}

/** Token de base (sans suffixe de collision) pour une entité. */
export async function deriveToken(salt: Uint8Array, type: EntityType, original: string): Promise<string> {
  const key = await importKey(salt);
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(`${type}\0${original}`));
  return `${TOKEN_OPEN}${TYPE_LETTERS[type]}-${encodeDigest(new Uint8Array(mac))}${TOKEN_CLOSE}`;
}

/** Ajoute un suffixe numérique (2, 3, …) à un token, en cas de collision. */
export const withSuffix = (token: string, n: number): string => `${token.slice(0, -1)}${n}${TOKEN_CLOSE}`;
