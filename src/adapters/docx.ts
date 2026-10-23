// Adaptateur .docx (WordprocessingML brut).
import { t } from "../i18n/index.ts";
import type { Adapter, Doc, SegmentKind } from "../engine/types.ts";
import {
  altTexts,
  contentWarnings,
  externalTargets,
  readParagraphParts,
  writeParagraphParts,
  type PartSpec,
} from "./ooxml/common.ts";
import { WORD } from "./ooxml/runs.ts";
import { inspectDocx } from "./inspect.ts";
import { elementsNS, NS } from "./ooxml/xml.ts";
import { OoxmlPackage } from "./ooxml/zip.ts";

const PARTS: readonly [RegExp, SegmentKind][] = [
  [/^word\/document\.xml$/, "body"],
  [/^word\/header\d*\.xml$/, "header"],
  [/^word\/footer\d*\.xml$/, "footer"],
  [/^word\/footnotes\.xml$/, "footnote"],
  [/^word\/endnotes\.xml$/, "footnote"],
  [/^word\/comments\.xml$/, "comment"],
];

/**
 * Tous les w:p dans l'ordre du document, y compris ceux des zones de texte (w:txbxContent), dans les
 * deux branches de mc:AlternateContent (mc:Choice et mc:Fallback).
 */
const paragraphs = (doc: Parameters<PartSpec["paragraphs"]>[0]) => elementsNS(doc, NS.w, "p");

async function read(file: ArrayBuffer): Promise<Doc> {
  const pkg = await OoxmlPackage.open(file);
  const warnings: string[] = [];
  const names = pkg.names();
  const specs: PartSpec[] = [];
  for (const [re, kind] of PARTS) {
    for (const name of names.filter((n) => re.test(n)).sort(byNumber)) specs.push({ name, kind, paragraphs });
  }
  if (!specs.some((s) => s.name === "word/document.xml")) throw new Error(t().docx.notWord);
  const { segments, state } = await readParagraphParts(pkg, WORD, specs, warnings);
  warnings.push(...contentWarnings(pkg, "word"));
  warnings.push(...(await authorWarnings(pkg)));

  const notices = await externalTargets(pkg);
  let deleted = false;
  let bound = false;
  for (const spec of specs) {
    const part = state.parts.get(spec.name);
    if (!part) continue;
    for (const instr of elementsNS(part.parsed.doc, NS.w, "instrText")) {
      const code = (instr.textContent ?? "").trim();
      if (code) notices.push({ text: code, where: t().docx.fieldCode });
    }
    notices.push(...altTexts(part.parsed.doc));
    if (elementsNS(part.parsed.doc, NS.w, "delText").length) deleted = true;
    if (elementsNS(part.parsed.doc, NS.w, "dataBinding").length) bound = true;
  }
  if (deleted) {
    warnings.push(t().docx.deletedRevisions);
  }
  if (bound && names.some((n) => n.startsWith("customXml/"))) {
    warnings.push(t().docx.customXml);
  }
  return { format: "docx", outputExtension: "docx", segments, warnings, notices, state };
}

/** Les noms d'auteurs (commentaires, révisions) sont des attributs : ils ne sont pas traités. */
async function authorWarnings(pkg: OoxmlPackage): Promise<string[]> {
  const { authors, trackRevisions, peopleList } = await inspectDocx(pkg);
  const out: string[] = [];
  if (authors) out.push(t().docx.authors(authors));
  if (peopleList) out.push(t().docx.peopleList);
  if (trackRevisions) out.push(t().docx.trackRevisions);
  return out;
}

const byNumber = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true });

export const docxAdapter: Adapter = {
  extensions: ["docx"],
  read,
  write: writeParagraphParts,
};
