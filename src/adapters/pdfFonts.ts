// Polices PDF : découpage des chaînes en codes, texte Unicode et chasse de chaque code.
// Seuls les cas que l'on sait mesurer exactement sont pris en charge ; les autres sont marqués
// « non pris en charge » (le texte correspondant ne peut alors pas être réécrit).
import {
  decodePDFRawStream,
  PDFArray,
  PDFDict,
  PDFName,
  PDFNumber,
  PDFRawStream,
  StandardFontEmbedder,
  StandardFonts,
  type PDFContext,
  type PDFObject,
} from "pdf-lib";

export interface PdfFont {
  /** Raison pour laquelle le texte de cette police ne peut pas être réécrit, ou null. */
  unsupported: string | null;
  /** Codes sur deux octets (Type0 Identity-H). */
  twoByte: boolean;
  /** Texte Unicode d'un code, ou null s'il est inconnu. */
  unicode(code: number): string | null;
  /** Chasse en millièmes d'unité de texte. */
  width(code: number): number;
}

export const lookup = (context: PDFContext, obj: PDFObject | undefined): PDFObject | undefined =>
  obj === undefined ? undefined : context.lookup(obj);

export const dictOf = (context: PDFContext, obj: PDFObject | undefined): PDFDict | undefined => {
  const o = lookup(context, obj);
  if (o instanceof PDFDict) return o;
  if (o instanceof PDFRawStream) return o.dict;
  return undefined;
};

export const nameOf = (context: PDFContext, obj: PDFObject | undefined): string | undefined => {
  const o = lookup(context, obj);
  return o instanceof PDFName ? o.decodeText() : undefined;
};

export const numberOf = (context: PDFContext, obj: PDFObject | undefined): number | undefined => {
  const o = lookup(context, obj);
  return o instanceof PDFNumber ? o.asNumber() : undefined;
};

export const arrayOf = (context: PDFContext, obj: PDFObject | undefined): PDFObject[] | undefined => {
  const o = lookup(context, obj);
  return o instanceof PDFArray ? o.asArray().map((x) => context.lookup(x) ?? x) : undefined;
};

export function streamBytes(context: PDFContext, obj: PDFObject | undefined): Uint8Array | undefined {
  const o = lookup(context, obj);
  if (!(o instanceof PDFRawStream)) return undefined;
  return decodePDFRawStream(o).decode();
}

// ---------------------------------------------------------------------------
// Encodages

const STANDARD_14 = new Set<string>(Object.values(StandardFonts));

type StandardFontName = Parameters<typeof StandardFontEmbedder.for>[0];
const embedders = new Map<string, StandardFontEmbedder>();

/** Métriques et encodage d'une des 14 polices standard (fournis par pdf-lib, sans téléchargement). */
export function standardFont(name: string): StandardFontEmbedder {
  let e = embedders.get(name);
  if (!e) embedders.set(name, (e = StandardFontEmbedder.for(name as unknown as StandardFontName)));
  return e;
}

let winAnsi: { names: (string | undefined)[]; unicode: (string | undefined)[]; byName: Map<string, string> } | null =
  null;

/** WinAnsiEncoding et table nom de glyphe → Unicode, tirées des métriques standard de pdf-lib. */
function winAnsiTables() {
  if (winAnsi) return winAnsi;
  const enc = standardFont(StandardFonts.Helvetica).encoding;
  const names: (string | undefined)[] = [];
  const unicode: (string | undefined)[] = [];
  const byName = new Map<string, string>();
  for (const cp of enc.supportedCodePoints) {
    const { code, name } = enc.encodeUnicodeCodePoint(cp);
    names[code] ??= name;
    unicode[code] ??= String.fromCodePoint(cp);
    if (!byName.has(name)) byName.set(name, String.fromCodePoint(cp));
  }
  for (const [n, u] of [
    ["quoteright", "’"],
    ["quoteleft", "‘"],
    ["fi", "fi"],
    ["fl", "fl"],
    ["ff", "ff"],
    ["ffi", "ffi"],
    ["ffl", "ffl"],
    ["minus", "−"],
    ["nbspace", " "],
  ] as const) {
    if (!byName.has(n)) byName.set(n, u);
  }
  winAnsi = { names, unicode, byName };
  return winAnsi;
}

export function glyphNameToUnicode(name: string): string | null {
  const known = winAnsiTables().byName.get(name);
  if (known) return known;
  const uni = /^uni([0-9A-F]{4})+$/i.exec(name);
  if (uni) {
    const hex = name.slice(3);
    let s = "";
    for (let i = 0; i < hex.length; i += 4) s += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
    return s;
  }
  const u = /^u([0-9A-F]{4,6})$/i.exec(name);
  if (u?.[1]) return String.fromCodePoint(parseInt(u[1], 16));
  return null;
}

/** Noms de glyphes d'un encodage de base (ASCII seulement pour Standard et MacRoman). */
function baseEncoding(name: string | undefined): (string | undefined)[] {
  const { names } = winAnsiTables();
  if (name === "WinAnsiEncoding") return [...names];
  const ascii: (string | undefined)[] = [];
  for (let c = 0x20; c < 0x7f; c++) ascii[c] = names[c];
  if (name === "StandardEncoding" || name === undefined) {
    ascii[0x27] = "quoteright";
    ascii[0x60] = "quoteleft";
  }
  if (name === "MacRomanEncoding" || name === "StandardEncoding" || name === undefined) return ascii;
  return [];
}

// ---------------------------------------------------------------------------
// ToUnicode

function utf16be(bytes: number[]): string {
  let s = "";
  for (let i = 0; i + 1 < bytes.length; i += 2) s += String.fromCharCode(((bytes[i] ?? 0) << 8) | (bytes[i + 1] ?? 0));
  return s;
}

const hexBytes = (h: string): number[] => {
  const out: number[] = [];
  for (let i = 0; i + 1 < h.length; i += 2) out.push(parseInt(h.slice(i, i + 2), 16));
  return out;
};

const hexValue = (h: string): number => parseInt(h || "0", 16);

/** Lit les sections bfchar et bfrange d'une CMap ToUnicode. */
export function parseToUnicode(bytes: Uint8Array): Map<number, string> {
  const text = new TextDecoder("latin1").decode(bytes);
  const map = new Map<number, string>();
  for (const block of text.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const m of (block[1] ?? "").matchAll(/<([0-9A-Fa-f\s]*)>\s*<([0-9A-Fa-f\s]*)>/g)) {
      map.set(hexValue((m[1] ?? "").replace(/\s/g, "")), utf16be(hexBytes((m[2] ?? "").replace(/\s/g, ""))));
    }
  }
  for (const block of text.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    const re = /<([0-9A-Fa-f\s]*)>\s*<([0-9A-Fa-f\s]*)>\s*(?:<([0-9A-Fa-f\s]*)>|\[([^\]]*)\])/g;
    for (const m of (block[1] ?? "").matchAll(re)) {
      const lo = hexValue((m[1] ?? "").replace(/\s/g, ""));
      const hi = hexValue((m[2] ?? "").replace(/\s/g, ""));
      if (hi < lo || hi - lo > 0xffff) continue;
      if (m[3] !== undefined) {
        const dst = hexBytes(m[3].replace(/\s/g, ""));
        for (let c = lo; c <= hi; c++) {
          const d = [...dst];
          // Incrément du dernier octet (avec retenue sur l'avant-dernier).
          let carry = c - lo;
          for (let k = d.length - 1; k >= 0 && carry > 0; k--) {
            const v = (d[k] ?? 0) + carry;
            d[k] = v & 0xff;
            carry = v >> 8;
          }
          map.set(c, utf16be(d));
        }
      } else {
        const items = [...(m[4] ?? "").matchAll(/<([0-9A-Fa-f\s]*)>/g)];
        items.forEach((it, k) => {
          if (lo + k <= hi) map.set(lo + k, utf16be(hexBytes((it[1] ?? "").replace(/\s/g, ""))));
        });
      }
    }
  }
  return map;
}

// ---------------------------------------------------------------------------

const unsupported = (reason: string): PdfFont => ({
  unsupported: reason,
  twoByte: false,
  unicode: () => null,
  width: () => 0,
});

function loadSimple(context: PDFContext, font: PDFDict, toUnicode: Map<number, string> | null): PdfFont {
  const baseFont = nameOf(context, font.get(PDFName.of("BaseFont")));
  const encObj = lookup(context, font.get(PDFName.of("Encoding")));
  let names: (string | undefined)[];
  if (encObj instanceof PDFName) names = baseEncoding(encObj.decodeText());
  else if (encObj instanceof PDFDict) {
    names = baseEncoding(nameOf(context, encObj.get(PDFName.of("BaseEncoding"))));
    let code = 0;
    for (const d of arrayOf(context, encObj.get(PDFName.of("Differences"))) ?? []) {
      if (d instanceof PDFNumber) code = d.asNumber();
      else if (d instanceof PDFName) names[code++] = d.decodeText();
    }
  } else names = baseEncoding(undefined);

  const widths = arrayOf(context, font.get(PDFName.of("Widths")));
  const firstChar = numberOf(context, font.get(PDFName.of("FirstChar"))) ?? 0;
  const descriptor = dictOf(context, font.get(PDFName.of("FontDescriptor")));
  const missing = numberOf(context, descriptor?.get(PDFName.of("MissingWidth"))) ?? 0;
  let width: (code: number) => number;
  if (widths) {
    const w = widths.map((x) => (x instanceof PDFNumber ? x.asNumber() : missing));
    width = (code) => w[code - firstChar] ?? missing;
  } else if (baseFont && STANDARD_14.has(baseFont) && baseFont !== "Symbol" && baseFont !== "ZapfDingbats") {
    const metrics = standardFont(baseFont).font;
    width = (code) => {
      const n = names[code];
      return (n ? metrics.getWidthOfGlyph(n) : undefined) ?? 0;
    };
  } else return unsupported("police sans table de chasses");

  const unicode = (code: number): string | null => {
    const fromCmap = toUnicode?.get(code);
    if (fromCmap !== undefined) return fromCmap;
    const n = names[code];
    return n ? glyphNameToUnicode(n) : null;
  };
  return { unsupported: null, twoByte: false, unicode, width };
}

function loadType0(context: PDFContext, font: PDFDict, toUnicode: Map<number, string> | null): PdfFont {
  const encoding = nameOf(context, font.get(PDFName.of("Encoding")));
  if (encoding !== "Identity-H") return unsupported(`police composite (encodage ${encoding ?? "intégré"})`);
  if (!toUnicode) return unsupported("police composite sans table ToUnicode");
  const descendant = dictOf(context, arrayOf(context, font.get(PDFName.of("DescendantFonts")))?.[0]);
  if (!descendant) return unsupported("police composite mal formée");
  const dw = numberOf(context, descendant.get(PDFName.of("DW"))) ?? 1000;
  const widths = new Map<number, number>();
  const w = arrayOf(context, descendant.get(PDFName.of("W"))) ?? [];
  for (let i = 0; i < w.length;) {
    const first = w[i];
    const next = w[i + 1];
    if (!(first instanceof PDFNumber)) break;
    if (next instanceof PDFArray) {
      next.asArray().forEach((x, k) => {
        const v = context.lookup(x);
        if (v instanceof PDFNumber) widths.set(first.asNumber() + k, v.asNumber());
      });
      i += 2;
    } else {
      const last = w[i + 1];
      const v = w[i + 2];
      if (!(last instanceof PDFNumber) || !(v instanceof PDFNumber)) break;
      for (let c = first.asNumber(); c <= last.asNumber() && c - first.asNumber() < 0x10000; c++) {
        widths.set(c, v.asNumber());
      }
      i += 3;
    }
  }
  return {
    unsupported: null,
    twoByte: true,
    unicode: (code) => toUnicode.get(code) ?? null,
    width: (code) => widths.get(code) ?? dw,
  };
}

export function loadFont(context: PDFContext, obj: PDFObject | undefined): PdfFont {
  const font = dictOf(context, obj);
  if (!font) return unsupported("police introuvable");
  const subtype = nameOf(context, font.get(PDFName.of("Subtype")));
  let toUnicode: Map<number, string> | null = null;
  try {
    const bytes = streamBytes(context, font.get(PDFName.of("ToUnicode")));
    if (bytes) toUnicode = parseToUnicode(bytes);
  } catch {
    return unsupported("table ToUnicode illisible");
  }
  if (subtype === "Type1" || subtype === "TrueType" || subtype === "MMType1") {
    return loadSimple(context, font, toUnicode);
  }
  if (subtype === "Type0") return loadType0(context, font, toUnicode);
  return unsupported(`police ${subtype ?? "inconnue"}`);
}

/** Découpe une chaîne en codes de caractères selon la police. */
export function codesOf(font: PdfFont, bytes: Uint8Array): number[] {
  if (!font.twoByte) return [...bytes];
  const out: number[] = [];
  for (let i = 0; i + 1 < bytes.length; i += 2) out.push(((bytes[i] ?? 0) << 8) | (bytes[i + 1] ?? 0));
  return out;
}
