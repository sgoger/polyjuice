// Réécriture d'un PDF anonymisé (caviardage réel) : les glyphes des valeurs détectées sont retirés des
// flux de contenu en conservant leur avance (la suite de la ligne ne bouge pas), le token est dessiné à
// leur place, puis les pages sont recopiées dans un nouveau document sans annotations, signets,
// structure, métadonnées ni révisions antérieures. Le résultat est relu par pdf.js et refusé s'il
// contient encore une valeur détectée : l'appelant produit alors seulement le .md.
import {
  decodePDFRawStream,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFRawStream,
  PDFRef,
  PDFStream,
  PDFString,
  StandardFonts,
  type PDFContext,
  type PDFObject,
} from "pdf-lib";
import { extractPdf } from "./pdf.ts";
import {
  formatNumber,
  parseContent,
  serializeOperation,
  type Operand,
  type Operation,
  type PdfName,
} from "./pdfContent.ts";
import { codesOf, dictOf, loadFont, lookup, nameOf, standardFont, streamBytes, type PdfFont } from "./pdfFonts.ts";
import { TOKEN_CLOSE, TOKEN_OPEN } from "../engine/tokens.ts";

export interface Replacement {
  /** Valeur d'origine telle que détectée dans le texte extrait. */
  original: string;
  token: string;
}

export interface RewriteStats {
  pages: number;
  /** Occurrences retirées du PDF. */
  redacted: number;
  /** Polices non prises en charge rencontrées (raisons). */
  unsupportedFonts: string[];
  /** Plus petit facteur de compression horizontale appliqué à un token (1 = aucun). */
  minTokenScale: number;
}

export type RewriteResult =
  | { ok: true; data: Uint8Array; removed: string[]; stats: RewriteStats }
  | { ok: false; reason: string; stats: RewriteStats | null };

/**
 * Ajustement d'un token à la largeur de la valeur remplacée (ratio = largeur disponible / largeur
 * naturelle) : compression horizontale jusqu'à 60 %, puis réduction du corps jusqu'à 55 % ; au-delà
 * (valeur très courte), le token déborde sur la suite de la ligne.
 */
export function tokenFit(ratio: number): { size: number; stretch: number } {
  if (ratio >= 1) return { size: 1, stretch: 1 };
  if (ratio >= 0.6) return { size: 1, stretch: ratio };
  const size = Math.max(0.55, ratio / 0.6);
  return { size, stretch: Math.max(0.6, ratio / size) };
}

/** Gris du fond dessiné sous les zones caviardées (0 = noir, 1 = blanc). */
const REDACTION_GRAY = 0.88;

// ---------------------------------------------------------------------------
// Recherche des valeurs

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Motif d'une valeur : blancs souples (y compris absents), limites de mot aux extrémités alphanumériques. */
export function valuePattern(value: string): RegExp | null {
  const v = value.normalize("NFKC").trim();
  if (!v) return null;
  const body = v.split(/\s+/u).map(escapeRe).join("\\s*");
  const pre = /^[\p{L}\p{N}]/u.test(v) ? "(?<![\\p{L}\\p{N}])" : "";
  const post = /[\p{L}\p{N}]$/u.test(v) ? "(?![\\p{L}\\p{N}])" : "";
  return new RegExp(pre + body + post, "gu");
}

/** Valeurs encore présentes dans un texte. */
export function remainingValues(text: string, values: readonly string[]): string[] {
  return values.filter((v) => valuePattern(v)?.test(text.normalize("NFKC")) ?? false);
}

// ---------------------------------------------------------------------------
// Interprétation d'un flux de contenu

type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

const mul = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[1] * n[2],
  m[0] * n[1] + m[1] * n[3],
  m[2] * n[0] + m[3] * n[2],
  m[2] * n[1] + m[3] * n[3],
  m[4] * n[0] + m[5] * n[2] + n[4],
  m[4] * n[1] + m[5] * n[3] + n[5],
];

const apply = (m: Matrix, x: number, y: number): [number, number] => [
  m[0] * x + m[2] * y + m[4],
  m[1] * x + m[3] * y + m[5],
];

interface TextState {
  ctm: Matrix;
  fontName: string | null;
  font: PdfFont | null;
  size: number;
  tc: number;
  tw: number;
  th: number;
  tl: number;
  rise: number;
  /** Mode de rendu du texte (Tr) : 3 et 7 = invisible. */
  render: number;
}

export interface Glyph {
  /** Index de l'opération et de l'élément (tableau TJ) qui portent le glyphe. */
  op: number;
  el: number;
  code: number;
  /** Code sur deux octets (police composite). */
  twoByte: boolean;
  text: string;
  /** Avance horizontale en unités de texte (espacements et échelle horizontale compris). */
  adv: number;
  /** Matrice de rendu au début du glyphe (espace utilisateur) et largeur du glyphe (millièmes). */
  trm: Matrix;
  w0: number;
  /** Point d'arrivée après l'avance, en espace utilisateur. */
  end: [number, number];
  fontName: string;
  size: number;
  tc: number;
  th: number;
  rewritable: boolean;
  /** Texte invisible (Tr 3 ou 7), typiquement la couche de texte d'un PDF océrisé. */
  invisible: boolean;
}

export interface Unit {
  ops: Operation[];
  glyphs: Glyph[];
  /** Formulaires (XObject) appelés par ce flux. */
  forms: PDFRef[];
  unsupportedFonts: Set<string>;
}

const num = (v: Operand | undefined): number => (typeof v === "number" ? v : 0);
const isName = (v: Operand | undefined): v is PdfName => !!v && typeof v === "object" && "name" in v;

const SHOW_OPS = new Set(["Tj", "TJ", "'", '"']);

/** Rejoue un flux de contenu et liste ses glyphes avec leur position et leur texte. */
export function interpret(context: PDFContext, ops: Operation[], resources: PDFDict | undefined): Unit {
  const fontsDict = dictOf(context, resources?.get(PDFName.of("Font")));
  const xobjects = dictOf(context, resources?.get(PDFName.of("XObject")));
  const fontCache = new Map<string, PdfFont>();
  const unsupportedFonts = new Set<string>();
  const glyphs: Glyph[] = [];
  const forms: PDFRef[] = [];
  let gs: TextState = {
    ctm: IDENTITY,
    fontName: null,
    font: null,
    size: 0,
    tc: 0,
    tw: 0,
    th: 1,
    tl: 0,
    rise: 0,
    render: 0,
  };
  const stack: TextState[] = [];
  let tm: Matrix = IDENTITY;
  let tlm: Matrix = IDENTITY;

  const moveLine = (tx: number, ty: number) => {
    tlm = mul([1, 0, 0, 1, tx, ty], tlm);
    tm = tlm;
  };

  const show = (opIndex: number, el: number, bytes: Uint8Array) => {
    const font = gs.font;
    const fontName = gs.fontName ?? "";
    const codes = font ? codesOf(font, bytes) : [...bytes];
    for (const code of codes) {
      const trm = mul(mul([gs.size * gs.th, 0, 0, gs.size, 0, gs.rise], tm), gs.ctm);
      const w0 = font && !font.unsupported ? font.width(code) : 0;
      const isSpace = font && !font.twoByte && code === 32;
      const adv = ((w0 / 1000) * gs.size + gs.tc + (isSpace ? gs.tw : 0)) * gs.th;
      tm = mul([1, 0, 0, 1, adv, 0], tm);
      const u = font && !font.unsupported ? font.unicode(code) : null;
      glyphs.push({
        op: opIndex,
        el,
        code,
        twoByte: !!font?.twoByte,
        text: u === null ? "�" : u.normalize("NFKC"),
        adv,
        trm,
        w0,
        end: apply(mul(tm, gs.ctm), 0, gs.rise),
        fontName,
        size: gs.size,
        tc: gs.tc,
        th: gs.th,
        rewritable: !!font && !font.unsupported,
        invisible: gs.render === 3 || gs.render === 7,
      });
    }
  };

  ops.forEach((o, i) => {
    const a = o.args;
    switch (o.op) {
      case "q":
        stack.push(gs);
        gs = { ...gs };
        break;
      case "Q":
        gs = stack.pop() ?? gs;
        break;
      case "cm":
        gs.ctm = mul([num(a[0]), num(a[1]), num(a[2]), num(a[3]), num(a[4]), num(a[5])], gs.ctm);
        break;
      case "BT":
        tm = IDENTITY;
        tlm = IDENTITY;
        break;
      case "Tf": {
        const name = isName(a[0]) ? a[0].name : "";
        let font = fontCache.get(name);
        if (!font) {
          font = loadFont(context, fontsDict?.get(PDFName.of(name)));
          fontCache.set(name, font);
        }
        if (font.unsupported) unsupportedFonts.add(font.unsupported);
        gs.fontName = name;
        gs.font = font;
        gs.size = num(a[1]);
        break;
      }
      case "Tc":
        gs.tc = num(a[0]);
        break;
      case "Tw":
        gs.tw = num(a[0]);
        break;
      case "Tz":
        gs.th = num(a[0]) / 100;
        break;
      case "TL":
        gs.tl = num(a[0]);
        break;
      case "Tr":
        gs.render = num(a[0]);
        break;
      case "Ts":
        gs.rise = num(a[0]);
        break;
      case "Td":
        moveLine(num(a[0]), num(a[1]));
        break;
      case "TD":
        gs.tl = -num(a[1]);
        moveLine(num(a[0]), num(a[1]));
        break;
      case "Tm":
        tlm = [num(a[0]), num(a[1]), num(a[2]), num(a[3]), num(a[4]), num(a[5])];
        tm = tlm;
        break;
      case "T*":
        moveLine(0, -gs.tl);
        break;
      case "Tj":
        if (a[0] instanceof Uint8Array) show(i, 0, a[0]);
        break;
      case "'":
        moveLine(0, -gs.tl);
        if (a[0] instanceof Uint8Array) show(i, 0, a[0]);
        break;
      case '"':
        gs.tw = num(a[0]);
        gs.tc = num(a[1]);
        moveLine(0, -gs.tl);
        if (a[2] instanceof Uint8Array) show(i, 0, a[2]);
        break;
      case "TJ":
        if (Array.isArray(a[0])) {
          a[0].forEach((e, k) => {
            if (e instanceof Uint8Array) show(i, k, e);
            else if (typeof e === "number") tm = mul([1, 0, 0, 1, (-e / 1000) * gs.size * gs.th, 0], tm);
          });
        }
        break;
      case "Do": {
        const ref = isName(a[0]) ? xobjects?.get(PDFName.of(a[0].name)) : undefined;
        const x = lookup(context, ref);
        if (ref instanceof PDFRef && x instanceof PDFRawStream) {
          if (nameOf(context, x.dict.get(PDFName.of("Subtype"))) === "Form") forms.push(ref);
        }
        break;
      }
    }
  });
  return { ops, glyphs, forms, unsupportedFonts };
}

// ---------------------------------------------------------------------------
// Correspondance valeurs → glyphes

export interface Match {
  token: string;
  /** Index des glyphes retirés, dans l'ordre. */
  glyphs: number[];
  /** Largeur disponible pour le token, en unités de texte du premier glyphe. */
  budget: number;
  /** Au moins un glyphe invisible : la valeur est sans doute aussi visible dans une image. */
  invisible: boolean;
}

/** Texte d'un flux, avec pour chaque unité UTF-16 le glyphe qui la porte (-1 : séparateur déduit des positions). */
export function unitText(glyphs: readonly Glyph[]): { text: string; owner: number[] } {
  let text = "";
  const owner: number[] = [];
  glyphs.forEach((g, i) => {
    const prev = glyphs[i - 1];
    if (prev) {
      const gap = Math.hypot(g.trm[4] - prev.end[0], g.trm[5] - prev.end[1]);
      const size = Math.hypot(g.trm[2], g.trm[3]) || 1;
      if (gap > 0.15 * size) {
        text += " ";
        owner.push(-1);
      }
    }
    for (const unitChar of g.text.split("")) {
      owner.push(i);
      text += unitChar;
    }
  });
  return { text, owner };
}

/** Découpe les glyphes d'une correspondance en segments de ligne (quitte la ligne → nouveau segment). */
export function lineRuns(glyphs: readonly Glyph[], indexes: readonly number[]): number[][] {
  const runs: number[][] = [];
  let run: number[] = [];
  let origin: Glyph | undefined;
  for (const i of indexes) {
    const g = glyphs[i];
    if (!g) continue;
    if (origin) {
      const [a, b, c, d, ox, oy] = origin.trm;
      const dx = g.end[0] - ox;
      const dy = g.end[1] - oy;
      const along = (dx * a + dy * b) / (Math.hypot(a, b) || 1);
      const across = (dx * c + dy * d) / (Math.hypot(c, d) || 1);
      if (Math.abs(across) > 0.5 * Math.hypot(c, d) || along < 0) {
        runs.push(run);
        run = [];
        origin = undefined;
      }
    }
    origin ??= g;
    run.push(i);
  }
  if (run.length) runs.push(run);
  return runs;
}

/** Longueur d'un segment de ligne, en espace utilisateur, du début du premier glyphe à la fin du dernier. */
function runLength(glyphs: readonly Glyph[], run: readonly number[]): number {
  const first = glyphs[run[0] ?? -1];
  const last = glyphs[run[run.length - 1] ?? -1];
  if (!first || !last) return 0;
  const [a, b, , , ox, oy] = first.trm;
  return ((last.end[0] - ox) * a + (last.end[1] - oy) * b) / (Math.hypot(a, b) || 1);
}

/** Largeur disponible pour le token : premier segment de ligne, en unités de texte du premier glyphe. */
function budgetOf(glyphs: readonly Glyph[], indexes: readonly number[]): number {
  const first = glyphs[indexes[0] ?? -1];
  const run = lineRuns(glyphs, indexes)[0];
  if (!first || !run) return 0;
  const ux = Math.hypot(first.trm[0], first.trm[1]) || 1;
  // Longueur en espace utilisateur → unités de texte (échelle horizontale du texte comprise).
  return (runLength(glyphs, run) / ux) * first.size * first.th;
}

/** Quadrilatère (espace utilisateur) couvrant un segment de ligne, de la ligne de base -0,2 em à +0,9 em. */
export function runQuad(glyphs: readonly Glyph[], run: readonly number[]): [number, number][] {
  const first = glyphs[run[0] ?? -1];
  if (!first) return [];
  const t = first.trm;
  const len = runLength(glyphs, run);
  const ux = Math.hypot(t[0], t[1]) || 1;
  const [dx, dy] = [(t[0] / ux) * len, (t[1] / ux) * len];
  const bl = apply(t, 0, -0.2);
  const tl = apply(t, 0, 0.9);
  return [bl, [bl[0] + dx, bl[1] + dy], [tl[0] + dx, tl[1] + dy], tl];
}

/** Correspondances des valeurs dans un flux ; les glyphes de chacune ne sont pris qu'une fois. */
export function findMatches(unit: Unit, replacements: readonly Replacement[]): Match[] {
  const { text, owner } = unitText(unit.glyphs);
  const claimed = new Set<number>();
  const matches: Match[] = [];
  const sorted = [...replacements].sort((x, y) => y.original.length - x.original.length);
  for (const r of sorted) {
    const re = valuePattern(r.original);
    if (!re) continue;
    for (const m of text.matchAll(re)) {
      const set = new Set<number>();
      for (let k = m.index; k < m.index + m[0].length; k++) {
        const o = owner[k] ?? -1;
        if (o >= 0) set.add(o);
      }
      const indexes = [...set].sort((x, y) => x - y);
      if (indexes.length === 0 || indexes.some((i) => claimed.has(i) || !unit.glyphs[i]?.rewritable)) continue;
      indexes.forEach((i) => claimed.add(i));
      matches.push({
        token: r.token,
        glyphs: indexes,
        budget: budgetOf(unit.glyphs, indexes),
        invisible: indexes.some((i) => unit.glyphs[i]?.invisible),
      });
    }
  }
  return matches;
}

// ---------------------------------------------------------------------------
// Réécriture d'un flux

/** Police des tokens : Helvetica (standard, non incorporée), ⟦ ⟧ dessinés comme [ ] mais extraits comme ⟦ ⟧. */
const TOKEN_FONT = StandardFonts.Helvetica;

export const tokenGlyphs = (token: string): string => token.replaceAll(TOKEN_OPEN, "[").replaceAll(TOKEN_CLOSE, "]");

/** Chasse du token en millièmes d'unité de texte (somme des chasses, sans crénage : un PDF n'en applique pas). */
export function tokenWidth(token: string): number {
  const { font, encoding } = standardFont(TOKEN_FONT);
  let w = 0;
  for (const ch of tokenGlyphs(token)) {
    w += font.getWidthOfGlyph(encoding.encodeUnicodeCodePoint(ch.codePointAt(0) ?? 0).name) ?? 0;
  }
  return w;
}

const TO_UNICODE = `/CIDInit /ProcSet findresource begin
12 dict begin
begincmap
/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def
/CMapName /Adobe-Identity-UCS def
/CMapType 2 def
1 begincodespacerange
<00> <FF>
endcodespacerange
3 beginbfrange
<20> <5A> <0020>
<5C> <5C> <005C>
<5E> <7E> <005E>
endbfrange
2 beginbfchar
<5B> <27E6>
<5D> <27E7>
endbfchar
endcmap
CMapName currentdict /CMap defineresource pop
end
end
`;

function tokenFont(context: PDFContext): PDFRef {
  const toUnicode = context.register(context.flateStream(TO_UNICODE));
  return context.register(
    context.obj({
      Type: "Font",
      Subtype: "Type1",
      BaseFont: TOKEN_FONT,
      Encoding: "WinAnsiEncoding",
      ToUnicode: toUnicode,
    }),
  );
}

const encoder = new TextEncoder();
const NL = encoder.encode("\n");

/** Opérations de marquage : les propriétés (texte de remplacement, MCID…) sont retirées. */
function stripMarked(o: Operation): string | null {
  if (o.op === "BDC" && isName(o.args[0])) return serializeOperation("BMC", [o.args[0]]);
  if (o.op === "DP" && isName(o.args[0])) return serializeOperation("MP", [o.args[0]]);
  return null;
}

/** Réécrit un flux : glyphes retirés, tokens dessinés, propriétés de contenu marqué supprimées. */
export function rewriteUnit(
  bytes: Uint8Array,
  unit: Unit,
  matches: readonly Match[],
  tokenFontName: string,
  stats: { minTokenScale: number },
): Uint8Array {
  const removed = new Set<number>();
  const starts = new Map<number, Match>();
  for (const m of matches) {
    m.glyphs.forEach((g) => removed.add(g));
    starts.set(m.glyphs[0] ?? -1, m);
  }
  const byOp = new Map<number, number[]>();
  unit.glyphs.forEach((g, i) => {
    let list = byOp.get(g.op);
    if (!list) byOp.set(g.op, (list = []));
    list.push(i);
  });
  const touched = new Set<number>();
  for (const i of removed) touched.add(unit.glyphs[i]?.op ?? -1);

  const chunks: Uint8Array[] = [];
  const push = (s: string) => {
    chunks.push(encoder.encode(s), NL);
  };
  // Fond gris clair sous chaque zone caviardée, dessiné en premier (sous tout le reste).
  const fill: string[] = [];
  for (const m of matches) {
    for (const run of lineRuns(unit.glyphs, m.glyphs)) {
      const q = runQuad(unit.glyphs, run);
      if (q.length !== 4) continue;
      fill.push(
        q.map(([x, y], k) => `${formatNumber(x)} ${formatNumber(y)} ${k === 0 ? "m" : "l"}`).join(" ") + " h f",
      );
    }
  }
  if (fill.length) push(`q ${REDACTION_GRAY} g\n${fill.join("\n")}\nQ`);
  unit.ops.forEach((o, opIndex) => {
    const marked = stripMarked(o);
    if (marked) {
      push(marked);
      return;
    }
    if (!SHOW_OPS.has(o.op) || !touched.has(opIndex)) {
      chunks.push(bytes.subarray(o.start, o.end), NL);
      return;
    }
    const list = byOp.get(opIndex) ?? [];
    const first = unit.glyphs[list[0] ?? -1];
    if (!first) return;
    const { size, th } = first;
    // ' et " : passage à la ligne (et espacements) avant l'affichage.
    if (o.op === "'") push("T*");
    if (o.op === '"')
      push(`${serializeOperation("Tw", [num(o.args[0])])} ${serializeOperation("Tc", [num(o.args[1])])} T*`);
    const elements: Operand[] =
      o.op === "TJ" && Array.isArray(o.args[0]) ? o.args[0] : [o.args[o.op === '"' ? 2 : 0] ?? new Uint8Array()];

    let arr: Operand[] = [];
    let cur: number[] = [];
    let pending = 0;
    const flushStr = () => {
      if (cur.length) arr.push(Uint8Array.from(cur));
      cur = [];
    };
    const flushPending = () => {
      if (Math.abs(pending) > 1e-9 && size !== 0 && th !== 0) {
        flushStr();
        arr.push((-pending * 1000) / (size * th));
      }
      pending = 0;
    };
    const emit = () => {
      flushStr();
      if (arr.length) push(serializeOperation("TJ", [arr]));
      arr = [];
    };
    let gi = 0;
    elements.forEach((e, el) => {
      if (typeof e === "number") {
        flushStr();
        arr.push(e);
        return;
      }
      if (!(e instanceof Uint8Array)) return;
      while (gi < list.length && unit.glyphs[list[gi] ?? -1]?.el === el) {
        const idx = list[gi++] ?? -1;
        const g = unit.glyphs[idx];
        if (!g) continue;
        const m = starts.get(idx);
        if (m) {
          flushPending();
          emit();
          const natural = (tokenWidth(m.token) / 1000) * g.size;
          const { size: sizeFactor, stretch } = tokenFit(natural > 0 ? m.budget / natural : 1);
          const scale = sizeFactor * stretch;
          stats.minTokenScale = Math.min(stats.minTokenScale, scale);
          push(
            [
              serializeOperation("Tf", [{ name: tokenFontName }, g.size * sizeFactor]),
              serializeOperation("Tc", [0]),
              serializeOperation("Tz", [stretch * 100]),
              serializeOperation("Tj", [encoder.encode(tokenGlyphs(m.token))]),
              serializeOperation("Tf", [{ name: g.fontName }, g.size]),
              serializeOperation("Tc", [g.tc]),
              serializeOperation("Tz", [g.th * 100]),
            ].join(" "),
          );
          // Le token a fait avancer le texte de sa propre largeur : on le déduit de l'avance à rendre.
          pending -= natural * scale;
        }
        if (removed.has(idx)) pending += g.adv;
        else {
          flushPending();
          if (g.twoByte) cur.push(g.code >> 8, g.code & 0xff);
          else cur.push(g.code);
        }
      }
    });
    flushPending();
    emit();
  });
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let p = 0;
  for (const c of chunks) {
    out.set(c, p);
    p += c.length;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Document

/** Entrées de page conservées ; tout le reste (annotations, structure, métadonnées…) est retiré. */
const PAGE_KEYS = new Set([
  "Type",
  "Parent",
  "MediaBox",
  "CropBox",
  "BleedBox",
  "TrimBox",
  "ArtBox",
  "Rotate",
  "Resources",
  "Contents",
  "Group",
  "UserUnit",
]);

/** Clés retirées de tous les objets recopiés. */
const DROPPED_KEYS = [
  "Metadata",
  "PieceInfo",
  "StructParent",
  "StructParents",
  "AF",
  "OC",
  "Properties",
  "LastModified",
];

function scrub(obj: PDFObject | undefined, seen: Set<PDFObject>): void {
  if (!obj || seen.has(obj)) return;
  seen.add(obj);
  const dict = obj instanceof PDFDict ? obj : obj instanceof PDFStream ? obj.dict : null;
  if (dict) {
    for (const k of DROPPED_KEYS) dict.delete(PDFName.of(k));
    for (const [, v] of dict.entries()) scrub(v, seen);
  } else if (obj instanceof PDFArray) {
    for (const v of obj.asArray()) scrub(v, seen);
  }
}

function contentBytes(context: PDFContext, contents: PDFObject | undefined): Uint8Array {
  const o = lookup(context, contents);
  const parts: Uint8Array[] = [];
  if (o instanceof PDFArray) {
    for (const x of o.asArray()) parts.push(streamBytes(context, x) ?? new Uint8Array(), NL);
  } else if (o instanceof PDFRawStream) parts.push(decodePDFRawStream(o).decode());
  const out = new Uint8Array(parts.reduce((s, x) => s + x.length, 0));
  let p = 0;
  for (const x of parts) {
    out.set(x, p);
    p += x.length;
  }
  return out;
}

function fontKey(context: PDFContext, resources: PDFDict): string {
  let fonts = dictOf(context, resources.get(PDFName.of("Font")));
  if (!fonts) {
    fonts = context.obj({});
    resources.set(PDFName.of("Font"), fonts);
  }
  let n = 0;
  while (fonts.has(PDFName.of(`PJTok${n || ""}`))) n++;
  return `PJTok${n || ""}`;
}

/** Ce qui est retiré du document, pour l'avertissement. */
function removedParts(doc: PDFDocument): string[] {
  const cat = doc.catalog;
  const ctx = doc.context;
  const out: string[] = [];
  const info = dictOf(ctx, ctx.trailerInfo.Info);
  if ((info && info.keys().length > 0) || cat.has(PDFName.of("Metadata"))) out.push("les métadonnées (titre, auteur…)");
  const annots = doc.getPages().reduce((s, p) => s + (p.node.Annots()?.size() ?? 0), 0);
  if (annots) out.push(`${annots} annotation${annots > 1 ? "s" : ""} (liens, commentaires…)`);
  if (cat.has(PDFName.of("Outlines"))) out.push("les signets");
  if (cat.has(PDFName.of("StructTreeRoot"))) out.push("la structure d'accessibilité (PDF balisé)");
  const names = dictOf(ctx, cat.get(PDFName.of("Names")));
  if (names?.has(PDFName.of("EmbeddedFiles"))) out.push("les fichiers joints");
  if (names?.has(PDFName.of("JavaScript")) || cat.has(PDFName.of("OpenAction"))) out.push("les actions et scripts");
  return out;
}

function precheck(doc: PDFDocument): string | null {
  const ctx = doc.context;
  const form = dictOf(ctx, doc.catalog.get(PDFName.of("AcroForm")));
  const fields = lookup(ctx, form?.get(PDFName.of("Fields")));
  if (fields instanceof PDFArray && fields.size() > 0) return "formulaire PDF";
  if (doc.catalog.has(PDFName.of("OCProperties"))) return "calques (contenu optionnel)";
  return null;
}

interface StreamJob {
  bytes: Uint8Array;
  unit: Unit;
  resources: PDFDict | undefined;
}

/** Réécrit le PDF ; refuse (ok: false) dès qu'une valeur ne peut pas être retirée sûrement. */
export async function rewritePdf(file: ArrayBuffer, replacements: readonly Replacement[]): Promise<RewriteResult> {
  let src: PDFDocument;
  try {
    src = await PDFDocument.load(new Uint8Array(file.slice(0)), { updateMetadata: false });
  } catch (e) {
    const encrypted = e instanceof Error && /encrypt/i.test(e.message);
    return { ok: false, reason: encrypted ? "PDF chiffré" : "structure du PDF non prise en charge", stats: null };
  }
  try {
    return await rewriteLoaded(src, replacements);
  } catch {
    return { ok: false, reason: "structure du PDF non prise en charge", stats: null };
  }
}

async function rewriteLoaded(src: PDFDocument, replacements: readonly Replacement[]): Promise<RewriteResult> {
  const refused = precheck(src);
  if (refused) return { ok: false, reason: refused, stats: null };

  const ctx = src.context;
  const stats: RewriteStats = { pages: src.getPageCount(), redacted: 0, unsupportedFonts: [], minTokenScale: 1 };
  const unsupported = new Set<string>();
  let invisible = 0;
  let tokenFontRef: PDFRef | null = null;
  const removed = removedParts(src);

  const process = (bytes: Uint8Array, resources: PDFDict | undefined): { job: StreamJob; matches: Match[] } => {
    const ops = parseContent(bytes);
    const unit = interpret(ctx, ops, resources);
    unit.unsupportedFonts.forEach((r) => unsupported.add(r));
    const matches = findMatches(unit, replacements);
    invisible += matches.filter((m) => m.invisible).length;
    return { job: { bytes, unit, resources }, matches };
  };
  const finish = (job: StreamJob, matches: Match[]): Uint8Array => {
    let name = "PJTok";
    if (matches.length && job.resources) {
      tokenFontRef ??= tokenFont(ctx);
      name = fontKey(ctx, job.resources);
      dictOf(ctx, job.resources.get(PDFName.of("Font")))?.set(PDFName.of(name), tokenFontRef);
    }
    stats.redacted += matches.length;
    return rewriteUnit(job.bytes, job.unit, matches, name, stats);
  };

  try {
    const doneForms = new Set<string>();
    const forms: { ref: PDFRef; parentResources: PDFDict | undefined }[] = [];
    for (const page of src.getPages()) {
      const node = page.node;
      const res = lookup(ctx, node.getInheritableAttribute(PDFName.of("Resources")));
      const resources = res instanceof PDFDict ? res.clone(ctx) : ctx.obj({});
      const fonts = dictOf(ctx, resources.get(PDFName.of("Font")));
      if (fonts) resources.set(PDFName.of("Font"), fonts.clone(ctx));
      const { job, matches } = process(contentBytes(ctx, node.Contents()), resources);
      const out = finish(job, matches);
      node.set(PDFName.of("Resources"), resources);
      node.set(PDFName.of("Contents"), ctx.register(ctx.flateStream(out)));
      for (const ref of job.unit.forms) forms.push({ ref, parentResources: resources });
      for (const key of node.keys()) if (!PAGE_KEYS.has(key.decodeText())) node.delete(key);
    }
    // Formulaires (XObject), y compris imbriqués : chacun réécrit une fois, avec ses propres ressources.
    for (let next = forms.shift(); next; next = forms.shift()) {
      const { ref, parentResources } = next;
      if (doneForms.has(ref.toString())) continue;
      doneForms.add(ref.toString());
      const stream = ctx.lookup(ref);
      if (!(stream instanceof PDFRawStream)) continue;
      const own = dictOf(ctx, stream.dict.get(PDFName.of("Resources")));
      const resources = own ? own.clone(ctx) : (parentResources?.clone(ctx) ?? ctx.obj({}));
      const fonts = dictOf(ctx, resources.get(PDFName.of("Font")));
      if (fonts) resources.set(PDFName.of("Font"), fonts.clone(ctx));
      const { job, matches } = process(decodePDFRawStream(stream).decode(), resources);
      const out = finish(job, matches);
      const rewritten = ctx.flateStream(out);
      for (const [k, v] of stream.dict.entries()) {
        if (!["Filter", "DecodeParms", "Length"].includes(k.decodeText())) rewritten.dict.set(k, v);
      }
      rewritten.dict.set(PDFName.of("Resources"), resources);
      ctx.assign(ref, rewritten);
      for (const f of job.unit.forms) forms.push({ ref: f, parentResources: resources });
    }
  } catch (e) {
    return { ok: false, reason: `flux de contenu illisible (${e instanceof Error ? e.message : String(e)})`, stats };
  }
  stats.unsupportedFonts = [...unsupported];
  if (invisible) {
    // PDF océrisé : retirer la couche de texte ne retire pas la donnée de l'image qu'elle recouvre.
    return { ok: false, reason: "texte invisible superposé à une image (PDF océrisé)", stats };
  }

  const out = await PDFDocument.create({ updateMetadata: false });
  const pages = await out.copyPages(
    src,
    src.getPages().map((_, i) => i),
  );
  for (const p of pages) out.addPage(p);
  const seen = new Set<PDFObject>();
  for (const [, obj] of out.context.enumerateIndirectObjects()) scrub(obj, seen);
  const data = await out.save({ useObjectStreams: true });

  const leak = await verifyPdf(data, replacements);
  if (leak) {
    const why = stats.unsupportedFonts.length ? ` ; en cause : ${stats.unsupportedFonts.join(", ")}` : "";
    return { ok: false, reason: `${leak}${why}`, stats };
  }
  return { ok: true, data, removed, stats };
}

// ---------------------------------------------------------------------------
// Vérification

/** Textes de tous les objets d'un PDF (chaînes, flux décodés hors images et polices). */
async function rawTexts(data: Uint8Array): Promise<string[]> {
  const doc = await PDFDocument.load(data, { updateMetadata: false });
  const ctx = doc.context;
  const fontFiles = new Set<PDFObject>();
  const texts: string[] = [];
  const objects = ctx.enumerateIndirectObjects();
  for (const [, obj] of objects) {
    const dict = obj instanceof PDFDict ? obj : null;
    for (const k of ["FontFile", "FontFile2", "FontFile3"]) {
      const f = dict?.get(PDFName.of(k));
      if (f) fontFiles.add(ctx.lookup(f) ?? f);
    }
  }
  const walk = (o: PDFObject | undefined) => {
    if (o instanceof PDFString || o instanceof PDFHexString) texts.push(o.decodeText());
    else if (o instanceof PDFName) texts.push(o.decodeText());
    else if (o instanceof PDFArray) o.asArray().forEach(walk);
    else if (o instanceof PDFDict) for (const [, v] of o.entries()) walk(v);
  };
  for (const [, obj] of objects) {
    if (obj instanceof PDFRawStream) {
      walk(obj.dict);
      if (fontFiles.has(obj) || nameOf(ctx, obj.dict.get(PDFName.of("Subtype"))) === "Image") continue;
      let bytes: Uint8Array;
      try {
        bytes = decodePDFRawStream(obj).decode();
      } catch {
        bytes = obj.contents;
      }
      texts.push(new TextDecoder("latin1").decode(bytes));
      texts.push(new TextDecoder("utf-16be").decode(bytes));
    } else walk(obj);
  }
  return texts;
}

/**
 * Vérifie un PDF produit : il s'ouvre (pdf.js), son texte extrait ne contient plus aucune valeur
 * d'origine et contient chaque token ; aucun objet ne contient une valeur d'origine en clair.
 * Renvoie null si tout est correct, sinon la raison (sans la valeur).
 */
export async function verifyPdf(data: Uint8Array, replacements: readonly Replacement[]): Promise<string | null> {
  const originals = [...new Set(replacements.map((r) => r.original))];
  let x;
  try {
    x = await extractPdf(data.slice().buffer);
  } catch {
    return "le PDF produit ne s'ouvre pas";
  }
  const extracted = `${x.markdown}\n${x.itemsText}`;
  const left = remainingValues(extracted, originals);
  if (left.length) {
    return `${left.length} valeur${left.length > 1 ? "s" : ""} détectée${left.length > 1 ? "s" : ""} n'a pas pu être retirée du texte du PDF`;
  }
  const missing = [...new Set(replacements.map((r) => r.token))].filter((t) => !x.markdown.includes(t));
  if (missing.length)
    return `${missing.length} token${missing.length > 1 ? "s" : ""} illisible${missing.length > 1 ? "s" : ""} dans le PDF produit`;
  const raw = remainingValues((await rawTexts(data)).join("\n"), originals);
  if (raw.length)
    return `${raw.length} valeur${raw.length > 1 ? "s" : ""} détectée${raw.length > 1 ? "s" : ""} subsiste${raw.length > 1 ? "nt" : ""} dans la structure du PDF`;
  return null;
}
