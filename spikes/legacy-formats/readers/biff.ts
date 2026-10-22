// Lecteur minimal des classeurs Excel 97-2003 (.xls, BIFF8, [MS-XLS]) : noms de feuilles, valeurs des
// cellules (chaînes, nombres, booléens, erreurs, résultat en cache des formules), formats de nombre,
// cellules fusionnées et largeurs de colonnes. Tout le reste (styles, graphiques, images, commentaires,
// macros, en-têtes et pieds de page, liens, noms définis) est ignoré et seulement compté, pour avertir.
import { Cfb } from "./cfb.ts";

export type XlsValue = { t: "s"; v: string } | { t: "n"; v: number } | { t: "b"; v: boolean } | { t: "e"; v: string };

export interface XlsCell {
  row: number;
  col: number;
  value: XlsValue;
  /** Identifiant BIFF du format de nombre (`ifmt`), 0 = Standard. */
  numFmt: number;
}

export interface XlsRange {
  r1: number;
  r2: number;
  c1: number;
  c2: number;
}

export interface XlsColumn {
  first: number;
  last: number;
  /** Largeur en caractères. */
  width: number;
  hidden: boolean;
}

export interface XlsSheet {
  name: string;
  /** 0 = visible, 1 = masquée, 2 = très masquée. */
  state: number;
  cells: XlsCell[];
  merges: XlsRange[];
  columns: XlsColumn[];
}

/** Contenus lus mais non reportés dans le .xlsx produit (pour les avertissements). */
export interface XlsDropped {
  formulas: number;
  comments: number;
  headersFooters: number;
  hyperlinks: number;
  charts: number;
  /** Objets dessinés : images, formes, zones de texte, graphiques incorporés, contrôles. */
  drawings: number;
  /** Feuilles graphiques, feuilles macro, modules VBA, boîtes de dialogue. */
  otherSheets: number;
  definedNames: number;
  macros: boolean;
  metadata: boolean;
}

export interface XlsWorkbook {
  sheets: XlsSheet[];
  date1904: boolean;
  /** Formats de nombre personnalisés : `ifmt` → code de format. */
  formats: Map<number, string>;
  dropped: XlsDropped;
}

const R = {
  FORMULA: 0x0006,
  EOF: 0x000a,
  HEADER: 0x0014,
  FOOTER: 0x0015,
  NAME: 0x0018,
  NOTE: 0x001c,
  DATEMODE: 0x0022,
  FILEPASS: 0x002f,
  CONTINUE: 0x003c,
  COLINFO: 0x007d,
  BOUNDSHEET: 0x0085,
  MULRK: 0x00bd,
  RSTRING: 0x00d6,
  XF: 0x00e0,
  MERGECELLS: 0x00e5,
  OBJ: 0x005d,
  SST: 0x00fc,
  LABELSST: 0x00fd,
  HLINK: 0x01b8,
  NUMBER: 0x0203,
  LABEL: 0x0204,
  BOOLERR: 0x0205,
  STRING: 0x0207,
  RK: 0x027e,
  FORMAT: 0x041e,
  BOF: 0x0809,
} as const;

const ERRORS: Record<number, string> = {
  0x00: "#NULL!",
  0x07: "#DIV/0!",
  0x0f: "#VALUE!",
  0x17: "#REF!",
  0x1d: "#NAME?",
  0x24: "#NUM!",
  0x2a: "#N/A",
};

const latin1 = new TextDecoder("latin1");
const utf16 = new TextDecoder("utf-16le");

interface Rec {
  type: number;
  /** Données de l'enregistrement, puis celles des enregistrements CONTINUE qui le suivent. */
  parts: Uint8Array[];
  /** Position de l'enregistrement dans le flux. */
  offset: number;
}

function* records(stream: Uint8Array, from = 0): Generator<Rec> {
  const dv = new DataView(stream.buffer, stream.byteOffset, stream.byteLength);
  let p = from;
  let current: Rec | null = null;
  while (p + 4 <= stream.length) {
    const type = dv.getUint16(p, true);
    const size = dv.getUint16(p + 2, true);
    const data = stream.subarray(p + 4, Math.min(p + 4 + size, stream.length));
    if (type === R.CONTINUE && current) current.parts.push(data);
    else {
      if (current) yield current;
      current = { type, parts: [data], offset: p };
    }
    p += 4 + size;
  }
  if (current) yield current;
}

/** Lecture séquentielle d'un enregistrement et de ses CONTINUE. */
class Cursor {
  private seg = 0;
  private pos = 0;
  constructor(private readonly parts: readonly Uint8Array[]) {}

  get done(): boolean {
    while (this.seg < this.parts.length && this.pos >= (this.parts[this.seg]?.length ?? 0)) {
      this.seg++;
      this.pos = 0;
    }
    return this.seg >= this.parts.length;
  }

  private atSegmentEnd(): boolean {
    return this.pos >= (this.parts[this.seg]?.length ?? 0);
  }

  byte(): number {
    if (this.done) throw new Error("enregistrement tronqué");
    const b = this.parts[this.seg]?.[this.pos] ?? 0;
    this.pos++;
    return b;
  }

  u16(): number {
    return this.byte() | (this.byte() << 8);
  }

  u32(): number {
    return (this.u16() | (this.u16() << 16)) >>> 0;
  }

  skip(n: number): void {
    for (let i = 0; i < n; i++) this.byte();
  }

  /**
   * `cch` caractères. Quand le tableau de caractères est coupé par un CONTINUE, celui-ci commence par
   * un octet d'options qui indique si la suite est compressée (1 octet par caractère) ou en UTF-16.
   */
  chars(cch: number, highByte: boolean): string {
    let out = "";
    let wide = highByte;
    let left = cch;
    while (left > 0) {
      if (this.atSegmentEnd()) {
        this.seg++;
        this.pos = 0;
        if (this.seg >= this.parts.length) throw new Error("chaîne tronquée");
        wide = (this.byte() & 1) === 1;
      }
      const seg = this.parts[this.seg] ?? new Uint8Array(0);
      const avail = Math.floor((seg.length - this.pos) / (wide ? 2 : 1));
      const n = Math.min(left, avail);
      if (n === 0) throw new Error("chaîne tronquée");
      const bytes = seg.subarray(this.pos, this.pos + n * (wide ? 2 : 1));
      out += (wide ? utf16 : latin1).decode(bytes);
      this.pos += bytes.length;
      left -= n;
    }
    return out;
  }

  /** XLUnicodeString (cch sur 2 octets) ou ShortXLUnicodeString (cch sur 1 octet). */
  unicodeString(shortLength = false): string {
    const cch = shortLength ? this.byte() : this.u16();
    const flags = this.byte();
    return this.chars(cch, (flags & 1) === 1);
  }

  /** XLUnicodeRichExtendedString (table des chaînes partagées). */
  richExtendedString(): string {
    const cch = this.u16();
    const flags = this.byte();
    const runs = flags & 0x08 ? this.u16() : 0;
    const ext = flags & 0x04 ? this.u32() : 0;
    const s = this.chars(cch, (flags & 1) === 1);
    this.skip(runs * 4 + ext);
    return s;
  }
}

const view = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, b.byteLength);

/** Valeur d'un RK : nombre compressé sur 4 octets. */
function rk(v: number): number {
  let n: number;
  if (v & 2) n = (v | 0) >> 2;
  else {
    const dv = new DataView(new ArrayBuffer(8));
    dv.setUint32(4, v & 0xfffffffc, true);
    n = dv.getFloat64(0, true);
  }
  return v & 1 ? n / 100 : n;
}

export function readXls(file: ArrayBuffer | Uint8Array): XlsWorkbook {
  const cfb = Cfb.open(file);
  const stream = cfb.stream("Workbook");
  if (!stream) {
    if (cfb.stream("Book"))
      throw new Error("classeur Excel 5.0/95 (BIFF5) : format trop ancien, seul Excel 97-2003 (BIFF8) est lu");
    throw new Error("flux « Workbook » absent : ce n'est pas un classeur Excel");
  }
  const dropped: XlsDropped = {
    formulas: 0,
    comments: 0,
    headersFooters: 0,
    hyperlinks: 0,
    drawings: 0,
    charts: 0,
    otherSheets: 0,
    definedNames: 0,
    macros: cfb.entries.some((e) => e.path === "_VBA_PROJECT_CUR" || e.path.startsWith("_VBA_PROJECT_CUR/")),
    metadata: cfb.has("\u0005SummaryInformation") || cfb.has("\u0005DocumentSummaryInformation"),
  };

  // Flux global du classeur.
  const sst: string[] = [];
  const xfFormats: number[] = [];
  const formats = new Map<number, string>();
  const bounds: { name: string; state: number; offset: number }[] = [];
  let date1904 = false;
  let first = true;
  for (const rec of records(stream)) {
    const d = rec.parts[0] ?? new Uint8Array(0);
    if (first) {
      first = false;
      if (rec.type !== R.BOF) throw new Error("début de classeur (BOF) absent");
      if (d.length < 4 || view(d).getUint16(0, true) !== 0x0600)
        throw new Error("classeur Excel antérieur à 97 : seul Excel 97-2003 (BIFF8) est lu");
      continue;
    }
    if (rec.type === R.EOF) break;
    switch (rec.type) {
      case R.FILEPASS:
        throw new Error("classeur protégé par mot de passe : ouvrez-le dans Excel et retirez la protection");
      case R.BOUNDSHEET: {
        const c = new Cursor(rec.parts);
        const offset = c.u32();
        const state = c.byte() & 0x03;
        const kind = c.byte();
        const name = c.unicodeString(true);
        if (kind === 0) bounds.push({ name, state, offset });
        else dropped.otherSheets++;
        break;
      }
      case R.SST: {
        const c = new Cursor(rec.parts);
        c.u32();
        const unique = c.u32();
        for (let i = 0; i < unique && !c.done; i++) sst.push(c.richExtendedString());
        break;
      }
      case R.XF:
        xfFormats.push(d.length >= 4 ? view(d).getUint16(2, true) : 0);
        break;
      case R.FORMAT: {
        const c = new Cursor(rec.parts);
        const id = c.u16();
        formats.set(id, c.unicodeString());
        break;
      }
      case R.DATEMODE:
        date1904 = d.length >= 2 && view(d).getUint16(0, true) === 1;
        break;
      case R.NAME:
        dropped.definedNames++;
        break;
    }
  }

  const sheets = bounds.map((b) => readSheet(stream, b, sst, xfFormats, dropped));
  return { sheets, date1904, formats, dropped };
}

/** Texte d'un en-tête ou pied de page, sans les codes de mise en page (« &P », « &"Arial,Gras" »…). */
const headerText = (s: string): string => s.replace(/&(?:"[^"]*"|\d+|K[0-9A-Fa-f]{6}|.)/g, "").trim();

function readSheet(
  stream: Uint8Array,
  bound: { name: string; state: number; offset: number },
  sst: readonly string[],
  xfFormats: readonly number[],
  dropped: XlsDropped,
): XlsSheet {
  const sheet: XlsSheet = { name: bound.name, state: bound.state, cells: [], merges: [], columns: [] };
  const fmt = (ixfe: number) => xfFormats[ixfe] ?? 0;
  const put = (row: number, col: number, ixfe: number, value: XlsValue) => {
    sheet.cells.push({ row, col, value, numFmt: fmt(ixfe) });
  };
  /** Formule à résultat texte : la valeur arrive dans l'enregistrement STRING qui suit. */
  let pending: { row: number; col: number; ixfe: number } | null = null;
  let depth = 0;
  let started = false;
  for (const rec of records(stream, bound.offset)) {
    const d = rec.parts[0] ?? new Uint8Array(0);
    const dv = view(d);
    if (rec.type === R.BOF) {
      if (!started) {
        started = true;
        continue;
      }
      // Sous-flux imbriqué : graphique incorporé dans la feuille.
      depth++;
      dropped.charts++;
      continue;
    }
    if (!started) throw new Error(`feuille « ${bound.name} » : début (BOF) absent`);
    if (rec.type === R.EOF) {
      if (depth === 0) break;
      depth--;
      continue;
    }
    if (depth > 0) continue;
    if (rec.type !== R.STRING) {
      if (
        pending &&
        [R.FORMULA, R.LABELSST, R.LABEL, R.RSTRING, R.NUMBER, R.RK, R.MULRK, R.BOOLERR].includes(rec.type as never)
      )
        pending = null;
    }
    switch (rec.type) {
      case R.LABELSST:
        if (d.length >= 10)
          put(dv.getUint16(0, true), dv.getUint16(2, true), dv.getUint16(4, true), {
            t: "s",
            v: sst[dv.getUint32(6, true)] ?? "",
          });
        break;
      case R.LABEL:
      case R.RSTRING: {
        const c = new Cursor(rec.parts);
        const row = c.u16();
        const col = c.u16();
        const ixfe = c.u16();
        put(row, col, ixfe, { t: "s", v: c.unicodeString() });
        break;
      }
      case R.NUMBER:
        if (d.length >= 14)
          put(dv.getUint16(0, true), dv.getUint16(2, true), dv.getUint16(4, true), {
            t: "n",
            v: dv.getFloat64(6, true),
          });
        break;
      case R.RK:
        if (d.length >= 10)
          put(dv.getUint16(0, true), dv.getUint16(2, true), dv.getUint16(4, true), {
            t: "n",
            v: rk(dv.getUint32(6, true)),
          });
        break;
      case R.MULRK: {
        const row = dv.getUint16(0, true);
        const firstCol = dv.getUint16(2, true);
        const count = Math.floor((d.length - 6) / 6);
        for (let i = 0; i < count; i++) {
          const off = 4 + i * 6;
          put(row, firstCol + i, dv.getUint16(off, true), { t: "n", v: rk(dv.getUint32(off + 2, true)) });
        }
        break;
      }
      case R.BOOLERR:
        if (d.length >= 8) {
          const v = d[6] ?? 0;
          put(
            dv.getUint16(0, true),
            dv.getUint16(2, true),
            dv.getUint16(4, true),
            d[7] ? { t: "e", v: ERRORS[v] ?? "#N/A" } : { t: "b", v: v !== 0 },
          );
        }
        break;
      case R.FORMULA: {
        if (d.length < 14) break;
        dropped.formulas++;
        const row = dv.getUint16(0, true);
        const col = dv.getUint16(2, true);
        const ixfe = dv.getUint16(4, true);
        if (dv.getUint16(12, true) !== 0xffff) {
          put(row, col, ixfe, { t: "n", v: dv.getFloat64(6, true) });
          break;
        }
        const kind = d[6];
        const v = d[8] ?? 0;
        if (kind === 0) pending = { row, col, ixfe };
        else if (kind === 1) put(row, col, ixfe, { t: "b", v: v !== 0 });
        else if (kind === 2) put(row, col, ixfe, { t: "e", v: ERRORS[v] ?? "#N/A" });
        else if (kind === 3) put(row, col, ixfe, { t: "s", v: "" });
        break;
      }
      case R.STRING:
        if (pending) {
          put(pending.row, pending.col, pending.ixfe, { t: "s", v: new Cursor(rec.parts).unicodeString() });
          pending = null;
        }
        break;
      case R.MERGECELLS: {
        const n = dv.getUint16(0, true);
        for (let i = 0; i < n && 2 + i * 8 + 8 <= d.length; i++) {
          const o = 2 + i * 8;
          sheet.merges.push({
            r1: dv.getUint16(o, true),
            r2: dv.getUint16(o + 2, true),
            c1: dv.getUint16(o + 4, true),
            c2: dv.getUint16(o + 6, true),
          });
        }
        break;
      }
      case R.COLINFO:
        if (d.length >= 10)
          sheet.columns.push({
            first: dv.getUint16(0, true),
            last: dv.getUint16(2, true),
            width: dv.getUint16(4, true) / 256,
            hidden: (dv.getUint16(8, true) & 1) === 1,
          });
        break;
      case R.HEADER:
      case R.FOOTER:
        // Codes seuls (« &A » nom de feuille, « &P » numéro de page…) : rien de personnel perdu.
        if (d.length > 0 && /[\p{L}\p{N}]/u.test(headerText(new Cursor(rec.parts).unicodeString())))
          dropped.headersFooters++;
        break;
      case R.NOTE:
        dropped.comments++;
        break;
      case R.HLINK:
        dropped.hyperlinks++;
        break;
      case R.OBJ:
        // Objet dessiné (image, forme, zone de texte, graphique, contrôle) ; les commentaires
        // (ot = 0x19) sont comptés par leurs enregistrements NOTE.
        if (d.length >= 6 && dv.getUint16(4, true) !== 0x19) dropped.drawings++;
        break;
    }
  }
  return sheet;
}
