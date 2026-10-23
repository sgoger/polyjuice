// Flux de contenu PDF : découpage en opérations (opérandes + opérateur) et sérialisation.
// Chaque opération garde ses positions dans le flux, pour recopier à l'identique celles qu'on ne modifie pas.
import { t } from "../i18n/index.ts";

export interface PdfName {
  name: string;
}

export type Operand = number | boolean | null | PdfName | Uint8Array | Operand[] | Map<string, Operand>;

export interface Operation {
  op: string;
  args: Operand[];
  /** Plage [start, end) de l'opération (opérandes compris) dans le flux. */
  start: number;
  end: number;
}

const WS = new Set([0x00, 0x09, 0x0a, 0x0c, 0x0d, 0x20]);
const DELIM = new Set([0x28, 0x29, 0x3c, 0x3e, 0x5b, 0x5d, 0x7b, 0x7d, 0x2f, 0x25]);
const isRegular = (c: number) => !WS.has(c) && !DELIM.has(c);

export class ContentSyntaxError extends Error {}

/** Découpe un flux de contenu décodé en opérations. */
export function parseContent(bytes: Uint8Array): Operation[] {
  let pos = 0;
  const n = bytes.length;
  const ops: Operation[] = [];
  let stack: Operand[] = [];
  let opStart = -1;

  const skipWs = () => {
    while (pos < n) {
      const c = bytes[pos] ?? 0;
      if (WS.has(c)) pos++;
      else if (c === 0x25) {
        while (pos < n && bytes[pos] !== 0x0a && bytes[pos] !== 0x0d) pos++;
      } else break;
    }
  };

  const readLiteral = (): Uint8Array => {
    pos++; // (
    const out: number[] = [];
    let depth = 1;
    while (pos < n) {
      const c = bytes[pos++] ?? 0;
      if (c === 0x5c) {
        const e = bytes[pos++] ?? 0;
        const simple: Record<number, number> = { 0x6e: 10, 0x72: 13, 0x74: 9, 0x62: 8, 0x66: 12 };
        if (e in simple) out.push(simple[e] ?? 0);
        else if (e >= 0x30 && e <= 0x37) {
          let v = e - 0x30;
          for (let k = 0; k < 2 && (bytes[pos] ?? 0) >= 0x30 && (bytes[pos] ?? 0) <= 0x37; k++) {
            v = v * 8 + ((bytes[pos++] ?? 0) - 0x30);
          }
          out.push(v & 0xff);
        } else if (e === 0x0d) {
          if (bytes[pos] === 0x0a) pos++;
        } else if (e !== 0x0a) out.push(e);
      } else if (c === 0x28) {
        depth++;
        out.push(c);
      } else if (c === 0x29) {
        if (--depth === 0) return Uint8Array.from(out);
        out.push(c);
      } else out.push(c);
    }
    throw new ContentSyntaxError(t().pdf.syntax.unterminatedString);
  };

  const readHex = (): Uint8Array => {
    pos++; // <
    const digits: number[] = [];
    while (pos < n && bytes[pos] !== 0x3e) {
      const c = bytes[pos++] ?? 0;
      const v = c >= 0x30 && c <= 0x39 ? c - 0x30 : (c | 0x20) >= 0x61 && (c | 0x20) <= 0x66 ? (c | 0x20) - 0x57 : -1;
      if (v >= 0) digits.push(v);
    }
    pos++; // >
    if (digits.length % 2) digits.push(0);
    const out = new Uint8Array(digits.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = (digits[2 * i] ?? 0) * 16 + (digits[2 * i + 1] ?? 0);
    return out;
  };

  const readName = (): PdfName => {
    pos++; // /
    let s = "";
    while (pos < n && isRegular(bytes[pos] ?? 0)) {
      const c = bytes[pos++] ?? 0;
      if (c === 0x23 && pos + 1 < n) {
        s += String.fromCharCode(parseInt(String.fromCharCode(bytes[pos] ?? 0, bytes[pos + 1] ?? 0), 16));
        pos += 2;
      } else s += String.fromCharCode(c);
    }
    return { name: s };
  };

  const readKeyword = (): string => {
    let s = "";
    while (pos < n && isRegular(bytes[pos] ?? 0)) s += String.fromCharCode(bytes[pos++] ?? 0);
    return s;
  };

  // Valeur (pour les tableaux et dictionnaires) ; renvoie undefined sur un délimiteur fermant.
  const readValue = (): Operand | undefined => {
    skipWs();
    const c = bytes[pos];
    if (c === undefined) throw new ContentSyntaxError(t().pdf.syntax.unexpectedEnd);
    if (c === 0x28) return readLiteral();
    if (c === 0x2f) return readName();
    if (c === 0x5b) {
      pos++;
      const arr: Operand[] = [];
      for (;;) {
        skipWs();
        if (bytes[pos] === 0x5d) {
          pos++;
          return arr;
        }
        const v = readValue();
        if (v === undefined) throw new ContentSyntaxError(t().pdf.syntax.malformedArray);
        arr.push(v);
      }
    }
    if (c === 0x3c && bytes[pos + 1] === 0x3c) {
      pos += 2;
      const dict = new Map<string, Operand>();
      for (;;) {
        skipWs();
        if (bytes[pos] === 0x3e && bytes[pos + 1] === 0x3e) {
          pos += 2;
          return dict;
        }
        const k = readValue();
        if (!k || typeof k !== "object" || !("name" in k)) throw new ContentSyntaxError(t().pdf.syntax.malformedDict);
        const v = readValue();
        if (v === undefined) throw new ContentSyntaxError(t().pdf.syntax.malformedDict);
        dict.set(k.name, v);
      }
    }
    if (c === 0x3c) return readHex();
    if (c === 0x5d || c === 0x3e || c === 0x29 || c === 0x7b || c === 0x7d) {
      throw new ContentSyntaxError(t().pdf.syntax.unexpectedDelimiter);
    }
    const word = readKeyword();
    if (word === "true") return true;
    if (word === "false") return false;
    if (word === "null") return null;
    const num = Number(word);
    if (word !== "" && !Number.isNaN(num)) return num;
    throw new ContentSyntaxError(t().pdf.syntax.unexpectedValue(word));
  };

  for (;;) {
    skipWs();
    if (pos >= n) break;
    if (opStart < 0) opStart = pos;
    const c = bytes[pos] ?? 0;
    if (c === 0x28 || c === 0x2f || c === 0x5b || c === 0x3c) {
      const v = readValue();
      if (v !== undefined) stack.push(v);
      continue;
    }
    if (!isRegular(c)) throw new ContentSyntaxError(t().pdf.syntax.unexpectedDelimiter);
    const word = readKeyword();
    const num = Number(word);
    if (word === "true" || word === "false" || word === "null" || !Number.isNaN(num)) {
      stack.push(word === "true" ? true : word === "false" ? false : word === "null" ? null : num);
      continue;
    }
    if (word === "BI") {
      // Image en ligne : dictionnaire jusqu'à ID, puis données binaires jusqu'à EI.
      const dict = new Map<string, Operand>();
      for (;;) {
        skipWs();
        if (bytes[pos] === 0x49 && bytes[pos + 1] === 0x44 && !isRegular(bytes[pos + 2] ?? 0x20)) break;
        const k = readValue();
        const v = readValue();
        if (!k || typeof k !== "object" || !("name" in k) || v === undefined) {
          throw new ContentSyntaxError(t().pdf.syntax.malformedInlineImage);
        }
        dict.set(k.name, v);
      }
      pos += 3; // ID + un blanc
      const len = dict.get("L") ?? dict.get("Length");
      let end = -1;
      if (typeof len === "number" && len >= 0) {
        let p = pos + len;
        while (p < n && WS.has(bytes[p] ?? 0)) p++;
        if (bytes[p] === 0x45 && bytes[p + 1] === 0x49) end = p;
      }
      for (let p = pos; end < 0 && p + 1 < n; p++) {
        if (
          bytes[p] === 0x45 &&
          bytes[p + 1] === 0x49 &&
          WS.has(bytes[p - 1] ?? 0x20) &&
          (p + 2 >= n || WS.has(bytes[p + 2] ?? 0x20))
        ) {
          end = p;
        }
      }
      if (end < 0) throw new ContentSyntaxError(t().pdf.syntax.unterminatedInlineImage);
      pos = end + 2;
      ops.push({ op: "BI", args: [dict], start: opStart, end: pos });
      stack = [];
      opStart = -1;
      continue;
    }
    ops.push({ op: word, args: stack, start: opStart, end: pos });
    stack = [];
    opStart = -1;
  }
  return ops;
}

// ---------------------------------------------------------------------------
// Sérialisation

const HEX = "0123456789abcdef";

export function formatNumber(v: number): string {
  if (Number.isInteger(v)) return String(v);
  const s = v.toFixed(5).replace(/0+$/, "").replace(/\.$/, "");
  return s === "-0" ? "0" : s;
}

export function serializeOperand(v: Operand): string {
  if (v === null) return "null";
  if (typeof v === "number") return formatNumber(v);
  if (typeof v === "boolean") return String(v);
  if (v instanceof Uint8Array) {
    let s = "<";
    for (const b of v) s += (HEX[b >> 4] ?? "") + (HEX[b & 15] ?? "");
    return s + ">";
  }
  if (Array.isArray(v)) return `[${v.map(serializeOperand).join(" ")}]`;
  if (v instanceof Map) {
    return `<<${[...v].map(([k, x]) => `${serializeOperand({ name: k })} ${serializeOperand(x)}`).join(" ")}>>`;
  }
  let s = "/";
  for (const ch of v.name) {
    const c = ch.charCodeAt(0);
    s += c < 0x21 || c > 0x7e || c === 0x23 || DELIM.has(c) ? `#${HEX[c >> 4] ?? ""}${HEX[c & 15] ?? ""}` : ch;
  }
  return s;
}

export function serializeOperation(op: string, args: readonly Operand[]): string {
  return [...args.map(serializeOperand), op].join(" ");
}
