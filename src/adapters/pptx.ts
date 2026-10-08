// Adaptateur .pptx (PresentationML / DrawingML brut).
import type { Adapter, Doc, SegmentKind } from "../engine/types.ts";
import {
  contentWarnings,
  externalTargets,
  readParagraphParts,
  writeParagraphParts,
  type PartSpec,
} from "./ooxml/common.ts";
import { DRAWING } from "./ooxml/runs.ts";
import { ancestor, elementsNS, NS, type Element } from "./ooxml/xml.ts";
import { OoxmlPackage } from "./ooxml/zip.ts";

const PARTS: readonly [RegExp, SegmentKind][] = [
  [/^ppt\/slides\/slide\d+\.xml$/, "body"],
  [/^ppt\/notesSlides\/notesSlide\d+\.xml$/, "notes"],
  // Masques et dispositions : seuls les paragraphes contenant du texte deviennent des segments.
  [/^ppt\/slideMasters\/slideMaster\d+\.xml$/, "body"],
  [/^ppt\/slideLayouts\/slideLayout\d+\.xml$/, "body"],
];

/**
 * Tous les a:p de la partie : formes (p:sp), groupes imbriqués (p:grpSp, à toute profondeur),
 * cellules de tableaux (a:tbl/a:tc) et zones de notes.
 */
const paragraphs = (doc: Parameters<PartSpec["paragraphs"]>[0]) => elementsNS(doc, NS.a, "p");
const cellKind = (kind: SegmentKind) => (p: Element) => (ancestor(p, NS.a, ["tc"]) ? "cell" : kind);

const byNumber = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true });

async function read(file: ArrayBuffer): Promise<Doc> {
  const pkg = await OoxmlPackage.open(file);
  const warnings: string[] = [];
  const names = pkg.names();
  if (!names.includes("ppt/presentation.xml"))
    throw new Error("ppt/presentation.xml absent : ce n'est pas une présentation");
  const specs: PartSpec[] = [];
  for (const [re, kind] of PARTS) {
    for (const name of names.filter((n) => re.test(n)).sort(byNumber)) {
      specs.push({ name, kind, paragraphs, kindOf: cellKind(kind) });
    }
  }
  const { segments, state } = await readParagraphParts(pkg, DRAWING, specs, warnings);
  warnings.push(...contentWarnings(pkg, "ppt"));
  if (names.some((n) => /^ppt\/(comments\/|commentAuthors\.xml|authors\.xml)/.test(n))) {
    warnings.push("Commentaires de diapositives présents : leur texte et leurs auteurs ne sont pas traités.");
  }
  const notices = await externalTargets(pkg);
  return { format: "pptx", outputExtension: "pptx", segments, warnings, notices, state };
}

export const pptxAdapter: Adapter = {
  extensions: ["pptx"],
  read,
  write: writeParagraphParts,
};
