// Adaptateur .xlsx (SpreadsheetML brut) : chaînes partagées et chaînes inline uniquement.
// Formules, nombres, dates, booléens, noms de feuilles, styles, graphiques et macros ne sont jamais touchés.
import type { Adapter, Doc, ReadOptions } from "../engine/types.ts";
import {
  contentWarnings,
  externalTargets,
  readParagraphParts,
  writeParagraphParts,
  type ParagraphLocator,
  type ParagraphState,
  type PartSpec,
} from "./ooxml/common.ts";
import { collect, SHEET } from "./ooxml/runs.ts";
import { childElements, elementsNS, NS, parseXml, type Element } from "./ooxml/xml.ts";
import { OoxmlPackage } from "./ooxml/zip.ts";

const SST = "xl/sharedStrings.xml";
const SHEET_RE = /^xl\/worksheets\/sheet\d+\.xml$/;
const byNumber = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true });

/** « AB12 » → « AB » ; index de colonne (0 = A) → lettres. */
const lettersOf = (ref: string) => /^[A-Z]+/.exec(ref)?.[0] ?? "";
function columnLetters(index: number): string {
  let s = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

const child = (el: Element, local: string) => childElements(el).find((c) => c.localName === local) ?? null;
const norm = (s: string) => s.trim().toLocaleLowerCase("fr");

interface CellInfo {
  column: string;
  type: string;
  formula: boolean;
  /** Index de chaîne partagée (t="s"). */
  sst: number | null;
  /** Élément `is` (t="inlineStr"). */
  inline: Element | null;
  value: string;
}

function cellsOf(sheet: Element | ReturnType<typeof parseXml>["doc"], sstTexts: readonly string[]): CellInfo[][] {
  const rows: CellInfo[][] = [];
  for (const row of elementsNS(sheet, NS.s, "row")) {
    let col = 0;
    const cells: CellInfo[] = [];
    for (const c of childElements(row).filter((e) => e.localName === "c")) {
      const ref = c.getAttribute("r");
      const column = ref ? lettersOf(ref) : columnLetters(col);
      col++;
      const type = c.getAttribute("t") ?? "n";
      const v = child(c, "v")?.textContent ?? "";
      const is = type === "inlineStr" ? child(c, "is") : null;
      const sst = type === "s" && /^\d+$/.test(v) ? Number(v) : null;
      const value = sst !== null ? (sstTexts[sst] ?? "") : is ? collect(is, SHEET).text : v;
      cells.push({ column, type, formula: !!child(c, "f"), sst, inline: is, value });
    }
    rows.push(cells);
  }
  return rows;
}

async function read(file: ArrayBuffer, options?: ReadOptions): Promise<Doc> {
  const pkg = await OoxmlPackage.open(file);
  const names = pkg.names();
  if (!names.includes("xl/workbook.xml")) throw new Error("xl/workbook.xml absent : ce n'est pas un classeur");
  const warnings: string[] = [];
  const sheets = names.filter((n) => SHEET_RE.test(n)).sort(byNumber);
  const specs: PartSpec[] = [];
  if (names.includes(SST)) specs.push({ name: SST, kind: "cell", paragraphs: (d) => elementsNS(d, NS.s, "si") });
  for (const name of sheets) specs.push({ name, kind: "cell", paragraphs: (d) => elementsNS(d, NS.s, "is") });
  const { segments, state } = await readParagraphParts(pkg, SHEET, specs, warnings);

  const columns = (options?.columns ?? []).map(norm).filter(Boolean);
  if (columns.length) warnings.push(...markColumns(state, segments, sheets, new Set(columns)));

  warnings.push(...contentWarnings(pkg, "xl"));
  if (names.includes("xl/vbaProject.bin"))
    warnings.push("Macros présentes (xl/vbaProject.bin) : copiées telles quelles, non analysées.");
  if (names.some((n) => /^xl\/(comments\d*\.xml|threadedComments\/)/.test(n))) {
    warnings.push("Commentaires ou notes de cellules présents : leur texte n'est pas traité.");
  }

  const notices = await externalTargets(pkg);
  try {
    const wb = parseXml(await pkg.readText("xl/workbook.xml"));
    for (const s of elementsNS(wb.doc, NS.s, "sheet")) {
      const name = s.getAttribute("name");
      if (name) notices.push({ text: name, where: "Nom de feuille" });
    }
  } catch {
    warnings.push("Partie illisible : xl/workbook.xml (noms de feuilles non vérifiés).");
  }
  return { format: "xlsx", outputExtension: "xlsx", segments, warnings, notices, state };
}

/**
 * « Colonnes à anonymiser » : sur chaque feuille, l'en-tête est la première ligne non vide ; toutes les
 * cellules chaîne (hors formules) des colonnes dont l'en-tête correspond sont marquées `wholeCell`.
 */
function markColumns(
  state: ParagraphState,
  segments: Doc["segments"],
  sheets: readonly string[],
  wanted: ReadonlySet<string>,
): string[] {
  const sstPart = state.parts.get(SST);
  const sstTexts = sstPart ? sstPart.paragraphs.map((p) => collect(p, SHEET).text) : [];
  const byLocator = new Map(
    segments.map((s) => [`${(s.locator as ParagraphLocator).part}#${(s.locator as ParagraphLocator).index}`, s]),
  );
  const mark = (part: string, index: number) => {
    const seg = byLocator.get(`${part}#${index}`);
    if (seg) seg.wholeCell = true;
  };

  const marked = new Set<number>();
  const usage = new Map<number, Set<string>>(); // index de chaîne partagée → « feuille!colonne »
  for (const sheet of sheets) {
    const part = state.parts.get(sheet);
    if (!part) continue;
    const rows = cellsOf(part.parsed.doc, sstTexts);
    for (const row of rows)
      for (const c of row)
        if (c.sst !== null) (usage.get(c.sst) ?? usage.set(c.sst, new Set()).get(c.sst))?.add(`${sheet}!${c.column}`);
    const headerIndex = rows.findIndex((r) => r.some((c) => c.value.trim() !== ""));
    if (headerIndex < 0) continue;
    const selected = new Set(
      (rows[headerIndex] ?? []).filter((c) => !c.formula && wanted.has(norm(c.value))).map((c) => c.column),
    );
    if (selected.size === 0) continue;
    for (const row of rows.slice(headerIndex + 1)) {
      for (const c of row) {
        if (!selected.has(c.column) || c.formula) continue;
        if (c.sst !== null) {
          marked.add(c.sst);
          mark(SST, c.sst);
        } else if (c.inline) {
          const index = part.paragraphs.indexOf(c.inline);
          if (index >= 0) mark(sheet, index);
        }
      }
    }
  }
  // Chaînes partagées marquées et utilisées par des cellules de plusieurs colonnes.
  const shared = [...marked].filter((i) => (usage.get(i)?.size ?? 0) > 1).length;
  return shared
    ? [
        `${shared} chaîne(s) partagée(s) des colonnes anonymisées sont utilisées dans plusieurs colonnes : toutes les cellules qui les utilisent sont remplacées.`,
      ]
    : [];
}

export const xlsxAdapter: Adapter = {
  extensions: ["xlsx"],
  read,
  write: writeParagraphParts,
};
