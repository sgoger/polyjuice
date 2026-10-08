// Adaptateur .docx (WordprocessingML brut).
import { agree, pl } from "../engine/plural.ts";
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
import { elementsNS, NS, parseXml } from "./ooxml/xml.ts";
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
  if (!specs.some((s) => s.name === "word/document.xml"))
    throw new Error("word/document.xml absent : ce n'est pas un document Word");
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
      if (code) notices.push({ text: code, where: "Code de champ" });
    }
    notices.push(...altTexts(part.parsed.doc));
    if (elementsNS(part.parsed.doc, NS.w, "delText").length) deleted = true;
    if (elementsNS(part.parsed.doc, NS.w, "dataBinding").length) bound = true;
  }
  if (deleted) {
    warnings.push(
      "Révisions supprimées (suivi des modifications) présentes : leur texte reste dans le fichier sans être traité. Acceptez ou rejetez les révisions avant d'anonymiser.",
    );
  }
  if (bound && names.some((n) => n.startsWith("customXml/"))) {
    warnings.push(
      "Contrôles de contenu liés à des données XML (customXml) : ces données ne sont pas traitées et Word peut les réafficher à l'ouverture.",
    );
  }
  return { format: "docx", outputExtension: "docx", segments, warnings, notices, state };
}

/** Les noms d'auteurs (commentaires, révisions) sont des attributs : ils ne sont pas traités. */
async function authorWarnings(pkg: OoxmlPackage): Promise<string[]> {
  const authors = new Set<string>();
  for (const name of pkg
    .names()
    .filter((n) => /^word\/(document|comments|footnotes|endnotes|header\d*|footer\d*)\.xml$/.test(n))) {
    try {
      const { doc } = parseXml(await pkg.readText(name));
      for (const local of ["comment", "ins", "del", "moveFrom", "moveTo", "rPrChange", "pPrChange"]) {
        for (const el of elementsNS(doc, NS.w, local)) {
          const a = el.getAttributeNS(NS.w, "author");
          if (a) authors.add(a);
        }
      }
    } catch {
      // partie illisible : déjà signalée
    }
  }
  const out: string[] = [];
  if (authors.size) {
    out.push(
      `${pl(authors.size, "nom d'auteur", "noms d'auteurs")} de commentaires ou de révisions ${agree(authors.size, "conservé tel quel : il n'est pas anonymisé", "conservés tels quels : ils ne sont pas anonymisés")}.`,
    );
  }
  if (pkg.has("word/people.xml"))
    out.push("Liste des personnes ayant commenté ou révisé le document (word/people.xml) conservée telle quelle.");
  return out;
}

const byNumber = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true });

export const docxAdapter: Adapter = {
  extensions: ["docx"],
  read,
  write: writeParagraphParts,
};
