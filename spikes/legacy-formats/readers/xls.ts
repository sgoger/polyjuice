// Adaptateur .xls (Excel 97-2003, lecture seule) : le classeur BIFF8 est converti en un classeur .xlsx
// minimal (valeurs, formats de nombre, cellules fusionnées, largeurs de colonnes), ensuite traité par
// l'adaptateur .xlsx. Le document produit est un .xlsx ; mise en forme, graphiques, images,
// commentaires et macros sont perdus, et les formules remplacées par leur dernier résultat calculé.
import JSZip from "jszip";
import { pl } from "../../../src/engine/plural.ts";
import type { Adapter, Doc, ReadOptions } from "../../../src/engine/types.ts";
import { readXls, type XlsCell, type XlsSheet, type XlsWorkbook } from "./biff.ts";
import { xlsxAdapter } from "../../../src/adapters/xlsx.ts";

const DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS_S = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const NS_REL = "http://schemas.openxmlformats.org/package/2006/relationships";
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const CT = "application/vnd.openxmlformats-officedocument.spreadsheetml";

/** Caractères interdits en XML 1.0 (contrôles hors tabulation et sauts de ligne, surrogates isolés). */
const INVALID_XML =
  // eslint-disable-next-line no-control-regex
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

const esc = (s: string) =>
  s
    .replace(INVALID_XML, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\r/g, "&#13;");

function columnLetters(index: number): string {
  let s = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}
const ref = (row: number, col: number) => `${columnLetters(col)}${row + 1}`;

/** Formats de nombre : identifiant BIFF → index de style (`cellXfs`) dans le .xlsx produit. */
class Styles {
  private readonly custom = new Map<number, number>(); // ifmt BIFF personnalisé → numFmtId xlsx
  private readonly xfs: number[] = [0]; // numFmtId de chaque cellXf (le premier : Standard)

  constructor(private readonly formats: ReadonlyMap<number, string>) {}

  index(ifmt: number): number {
    let numFmtId = ifmt;
    // Les formats définis dans le classeur (y compris ceux qui redéfinissent un format intégré pour une
    // langue) reçoivent un identifiant personnalisé ; les autres sont des formats intégrés communs.
    if (this.formats.has(ifmt)) {
      numFmtId = this.custom.get(ifmt) ?? 164 + this.custom.size;
      this.custom.set(ifmt, numFmtId);
    } else if (ifmt > 49) numFmtId = 0;
    if (numFmtId === 0) return 0;
    const i = this.xfs.indexOf(numFmtId);
    if (i >= 0) return i;
    this.xfs.push(numFmtId);
    return this.xfs.length - 1;
  }

  xml(): string {
    const numFmts = [...this.custom].map(
      ([ifmt, id]) => `<numFmt numFmtId="${id}" formatCode="${esc(this.formats.get(ifmt) ?? "General")}"/>`,
    );
    return (
      DECL +
      `<styleSheet xmlns="${NS_S}">` +
      (numFmts.length ? `<numFmts count="${numFmts.length}">${numFmts.join("")}</numFmts>` : "") +
      '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>' +
      '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      `<cellXfs count="${this.xfs.length}">` +
      this.xfs
        .map(
          (id) =>
            `<xf numFmtId="${id}" fontId="0" fillId="0" borderId="0" xfId="0"${id ? ' applyNumberFormat="1"' : ""}/>`,
        )
        .join("") +
      "</cellXfs>" +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      "</styleSheet>"
    );
  }
}

class SharedStrings {
  private readonly index = new Map<string, number>();
  private readonly list: string[] = [];
  count = 0;

  add(s: string): number {
    this.count++;
    let i = this.index.get(s);
    if (i === undefined) {
      i = this.list.length;
      this.list.push(s);
      this.index.set(s, i);
    }
    return i;
  }

  xml(): string {
    const items = this.list.map((s) => {
      const space = /^\s|\s$/.test(s) ? ' xml:space="preserve"' : "";
      return `<si><t${space}>${esc(s)}</t></si>`;
    });
    return (
      DECL + `<sst xmlns="${NS_S}" count="${this.count}" uniqueCount="${this.list.length}">${items.join("")}</sst>`
    );
  }
}

function cellXml(c: XlsCell, strings: SharedStrings, styles: Styles): string {
  const s = styles.index(c.numFmt);
  const attrs = `r="${ref(c.row, c.col)}"${s ? ` s="${s}"` : ""}`;
  switch (c.value.t) {
    case "s":
      return `<c ${attrs} t="s"><v>${strings.add(c.value.v)}</v></c>`;
    case "n":
      return Number.isFinite(c.value.v) ? `<c ${attrs}><v>${c.value.v}</v></c>` : `<c ${attrs} t="e"><v>#NUM!</v></c>`;
    case "b":
      return `<c ${attrs} t="b"><v>${c.value.v ? 1 : 0}</v></c>`;
    case "e":
      return `<c ${attrs} t="e"><v>${esc(c.value.v)}</v></c>`;
  }
}

function sheetXml(sheet: XlsSheet, strings: SharedStrings, styles: Styles): string {
  // Dernière valeur lue pour une cellule donnée (un classeur valide n'en a qu'une).
  const byCell = new Map<number, XlsCell>();
  for (const c of sheet.cells) byCell.set(c.row * 256 + c.col, c);
  const cells = [...byCell.values()].sort((a, b) => a.row - b.row || a.col - b.col);
  const rows: string[] = [];
  for (let i = 0; i < cells.length;) {
    const row = cells[i]?.row ?? 0;
    const parts: string[] = [];
    for (; i < cells.length && cells[i]?.row === row; i++) {
      const c = cells[i];
      if (c) parts.push(cellXml(c, strings, styles));
    }
    rows.push(`<row r="${row + 1}">${parts.join("")}</row>`);
  }
  const cols = sheet.columns
    .filter((c) => c.first <= c.last && c.last < 256)
    .sort((a, b) => a.first - b.first)
    .map(
      (c) =>
        `<col min="${c.first + 1}" max="${c.last + 1}" width="${Math.round(c.width * 100) / 100}" customWidth="1"${c.hidden ? ' hidden="1"' : ""}/>`,
    );
  const merges = sheet.merges
    .filter((m) => m.r1 <= m.r2 && m.c1 <= m.c2 && (m.r1 !== m.r2 || m.c1 !== m.c2))
    .map((m) => `<mergeCell ref="${ref(m.r1, m.c1)}:${ref(m.r2, m.c2)}"/>`);
  return (
    DECL +
    `<worksheet xmlns="${NS_S}" xmlns:r="${NS_R}">` +
    (cols.length ? `<cols>${cols.join("")}</cols>` : "") +
    `<sheetData>${rows.join("")}</sheetData>` +
    (merges.length ? `<mergeCells count="${merges.length}">${merges.join("")}</mergeCells>` : "") +
    "</worksheet>"
  );
}

/** Classeur .xlsx minimal (sans métadonnées) équivalent aux valeurs du classeur .xls. */
export async function xlsToXlsx(wb: XlsWorkbook): Promise<ArrayBuffer> {
  if (wb.sheets.length === 0) throw new Error("aucune feuille de calcul dans ce classeur");
  const strings = new SharedStrings();
  const styles = new Styles(wb.formats);
  const zip = new JSZip();
  const sheets = wb.sheets.map((s) => sheetXml(s, strings, styles));
  const n = sheets.length;
  // Au moins une feuille visible (Excel refuse un classeur dont toutes les feuilles sont masquées).
  const states = wb.sheets.map((s) => s.state);
  if (states.every((s) => s !== 0)) states[0] = 0;

  zip.file(
    "[Content_Types].xml",
    DECL +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      `<Override PartName="/xl/workbook.xml" ContentType="${CT}.sheet.main+xml"/>` +
      sheets
        .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="${CT}.worksheet+xml"/>`)
        .join("") +
      `<Override PartName="/xl/sharedStrings.xml" ContentType="${CT}.sharedStrings+xml"/>` +
      `<Override PartName="/xl/styles.xml" ContentType="${CT}.styles+xml"/>` +
      "</Types>",
  );
  zip.file(
    "_rels/.rels",
    DECL +
      `<Relationships xmlns="${NS_REL}"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  );
  zip.file(
    "xl/workbook.xml",
    DECL +
      `<workbook xmlns="${NS_S}" xmlns:r="${NS_R}">` +
      (wb.date1904 ? '<workbookPr date1904="1"/>' : "<workbookPr/>") +
      "<bookViews><workbookView/></bookViews>" +
      "<sheets>" +
      wb.sheets
        .map((s, i) => {
          const state = states[i] === 1 ? ' state="hidden"' : states[i] === 2 ? ' state="veryHidden"' : "";
          return `<sheet name="${esc(s.name)}" sheetId="${i + 1}"${state} r:id="rId${i + 1}"/>`;
        })
        .join("") +
      "</sheets></workbook>",
  );
  zip.file(
    "xl/_rels/workbook.xml.rels",
    DECL +
      `<Relationships xmlns="${NS_REL}">` +
      sheets
        .map((_, i) => `<Relationship Id="rId${i + 1}" Type="${REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
        .join("") +
      `<Relationship Id="rId${n + 1}" Type="${REL}/styles" Target="styles.xml"/>` +
      `<Relationship Id="rId${n + 2}" Type="${REL}/sharedStrings" Target="sharedStrings.xml"/>` +
      "</Relationships>",
  );
  sheets.forEach((xml, i) => zip.file(`xl/worksheets/sheet${i + 1}.xml`, xml));
  zip.file("xl/sharedStrings.xml", strings.xml());
  zip.file("xl/styles.xml", styles.xml());
  return zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
}

/** Avertissements propres à la conversion : ce qui n'a pas été reporté dans le .xlsx produit. */
export function conversionWarnings(wb: XlsWorkbook): string[] {
  const d = wb.dropped;
  const out = [
    "Classeur Excel 97-2003 (.xls) converti en .xlsx : la mise en forme (polices, couleurs, bordures), les graphiques, les images et les macros sont perdus ; les valeurs, les formats de nombre, les cellules fusionnées et les largeurs de colonnes sont conservés.",
  ];
  if (d.formulas)
    out.push(
      `${pl(d.formulas, "formule remplacée", "formules remplacées")} par ${d.formulas > 1 ? "leur" : "son"} dernier résultat calculé.`,
    );
  if (d.comments)
    out.push(`${pl(d.comments, "commentaire de cellule supprimé", "commentaires de cellules supprimés")}.`);
  if (d.headersFooters) out.push("En-têtes et pieds de page de feuille supprimés.");
  if (d.hyperlinks)
    out.push(
      `${pl(d.hyperlinks, "lien hypertexte supprimé", "liens hypertextes supprimés")} (le texte des cellules est conservé).`,
    );
  if (d.drawings || d.charts)
    out.push("Images, formes, zones de texte et graphiques supprimés : leur texte n'est pas repris dans le .xlsx.");
  if (d.otherSheets)
    out.push(
      `${pl(d.otherSheets, "feuille non tabulaire supprimée", "feuilles non tabulaires supprimées")} (feuille graphique, feuille macro ou module).`,
    );
  if (d.definedNames) out.push("Noms définis supprimés.");
  if (d.macros) out.push("Macros (VBA) supprimées.");
  if (d.metadata) out.push("Propriétés du document (auteur, société…) supprimées.");
  return out;
}

async function read(file: ArrayBuffer, options?: ReadOptions): Promise<Doc> {
  const wb = readXls(file);
  const doc = await xlsxAdapter.read(await xlsToXlsx(wb), options);
  return { ...doc, warnings: [...conversionWarnings(wb), ...doc.warnings] };
}

export const xlsAdapter: Adapter = {
  extensions: ["xls"],
  read,
  write: (doc) => xlsxAdapter.write(doc),
};
