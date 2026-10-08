// Éléments communs aux trois adaptateurs Office : métadonnées, avertissements, cibles de liens.
import { pl } from "../../engine/plural.ts";
import { applyEdits, collect, type RunModel } from "./runs.ts";
import { elementsNS, NS, parseXml, serializeXml, setText, type Element, type ParsedPart } from "./xml.ts";
import type { OoxmlPackage } from "./zip.ts";
import type { Doc, Segment, SegmentKind } from "../../engine/types.ts";

/** Valeur fixe des dates de création et de modification (déterminisme). */
export const FIXED_DATE = "2000-01-01T00:00:00Z";

const CORE_FIELDS: readonly [ns: string, local: string, label: string][] = [
  [NS.dc, "creator", "auteur"],
  [NS.cp, "lastModifiedBy", "dernier modificateur"],
  [NS.dc, "title", "titre"],
  [NS.dc, "subject", "sujet"],
  [NS.cp, "keywords", "mots-clés"],
  [NS.dc, "description", "description"],
  [NS.cp, "category", "catégorie"],
  [NS.cp, "contentStatus", "statut"],
];
const APP_FIELDS: readonly [local: string, label: string][] = [
  ["Company", "société"],
  ["Manager", "responsable"],
];
const CORE = "docProps/core.xml";
const APP = "docProps/app.xml";
const CUSTOM = "docProps/custom.xml";

async function tryParse(pkg: OoxmlPackage, name: string): Promise<ParsedPart | null> {
  if (!pkg.has(name)) return null;
  try {
    return parseXml(await pkg.readText(name));
  } catch {
    return null;
  }
}

const filled = (els: Element[]) => els.some((e) => (e.textContent ?? "").trim() !== "");

/** Libellés des métadonnées non vides qui seront vidées à l'écriture. */
export async function metadataToClear(pkg: OoxmlPackage): Promise<string[]> {
  const out: string[] = [];
  const core = await tryParse(pkg, CORE);
  if (core) for (const [ns, local, label] of CORE_FIELDS) if (filled(elementsNS(core.doc, ns, local))) out.push(label);
  const app = await tryParse(pkg, APP);
  if (app) for (const [local, label] of APP_FIELDS) if (filled(elementsNS(app.doc, NS.ep, local))) out.push(label);
  if (pkg.has(CUSTOM)) out.push("propriétés personnalisées");
  if (thumbnails(pkg).length) out.push("miniature d'aperçu");
  return out;
}

/** Titres recopiés dans docProps/app.xml (noms de feuilles, titres de diapositives…), conservés tels quels. */
export async function titlesWarning(pkg: OoxmlPackage): Promise<string[]> {
  const app = await tryParse(pkg, APP);
  if (!app) return [];
  const titles = elementsNS(app.doc, NS.ep, "TitlesOfParts").flatMap((t) =>
    Array.from(t.getElementsByTagName("vt:lpstr")).filter((e) => (e.textContent ?? "").trim() !== ""),
  );
  return titles.length
    ? [
        `Propriétés du document (docProps/app.xml) : ${pl(titles.length, "titre recopié", "titres recopiés")} (noms de feuilles, titres de diapositives…), conservés tels quels.`,
      ]
    : [];
}

export function metadataWarning(labels: readonly string[]): string[] {
  return labels.length
    ? [`Métadonnées vidées : ${labels.join(", ")} (dates de création et de modification neutralisées).`]
    : [];
}

/** Ne réécrit une partie que si son contenu change (les parties identiques gardent leurs octets). */
function writeIfChanged(pkg: OoxmlPackage, name: string, original: string, part: ParsedPart): void {
  const out = serializeXml(part);
  if (out !== original) pkg.setText(name, out);
}

/** Vide les métadonnées personnelles, neutralise les dates, supprime docProps/custom.xml. */
export async function clearMetadata(pkg: OoxmlPackage): Promise<void> {
  if (pkg.has(CORE)) {
    const xml = await pkg.readText(CORE);
    const core = parseXml(xml);
    for (const [ns, local] of CORE_FIELDS) for (const el of elementsNS(core.doc, ns, local)) setText(el, "");
    for (const local of ["created", "modified"])
      for (const el of elementsNS(core.doc, NS.dcterms, local)) setText(el, FIXED_DATE);
    writeIfChanged(pkg, CORE, xml, core);
  }
  if (pkg.has(APP)) {
    const xml = await pkg.readText(APP);
    const app = parseXml(xml);
    for (const [local] of APP_FIELDS) for (const el of elementsNS(app.doc, NS.ep, local)) setText(el, "");
    writeIfChanged(pkg, APP, xml, app);
  }
  if (pkg.has(CUSTOM)) {
    pkg.remove(CUSTOM);
    await removeReferences(pkg, CUSTOM);
  }
  // Miniature : image de la première page ou diapositive, souvent porteuse de noms.
  for (const name of thumbnails(pkg)) {
    pkg.remove(name);
    await removeReferences(pkg, name);
  }
}

const thumbnails = (pkg: OoxmlPackage) => pkg.names().filter((n) => /^docProps\/thumbnail\.[a-z]+$/i.test(n));

/** Textes alternatifs des images et formes (attributs descr/title), signalés sans être modifiés. */
export function altTexts(doc: ParsedPart["doc"]): { text: string; where: string }[] {
  const out: { text: string; where: string }[] = [];
  for (const [ns, local] of [
    ["http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing", "docPr"],
    [NS.p, "cNvPr"],
  ] as const) {
    for (const el of elementsNS(doc, ns, local)) {
      for (const attr of ["descr", "title"]) {
        const v = el.getAttribute(attr);
        if (v?.trim()) out.push({ text: v, where: "Texte alternatif" });
      }
    }
  }
  return out;
}

/** Retire la relation (racine) et la déclaration de type de contenu d'une partie supprimée. */
async function removeReferences(pkg: OoxmlPackage, partName: string): Promise<void> {
  const RELS = "_rels/.rels";
  if (pkg.has(RELS)) {
    const xml = await pkg.readText(RELS);
    const rels = parseXml(xml);
    for (const rel of elementsNS(rels.doc, NS.rel, "Relationship")) {
      if (rel.getAttribute("Target")?.replace(/^\//, "") === partName) rel.parentNode?.removeChild(rel);
    }
    writeIfChanged(pkg, RELS, xml, rels);
  }
  const CT = "[Content_Types].xml";
  if (pkg.has(CT)) {
    const xml = await pkg.readText(CT);
    const ct = parseXml(xml);
    for (const o of elementsNS(ct.doc, NS.ct, "Override")) {
      if (o.getAttribute("PartName") === `/${partName}`) o.parentNode?.removeChild(o);
    }
    writeIfChanged(pkg, CT, xml, ct);
  }
}

/** Avertissements sur les contenus non traités, d'après les dossiers du paquet. */
export function contentWarnings(pkg: OoxmlPackage, root: string, extra: { charts?: boolean } = {}): string[] {
  const count = (dir: string) => pkg.names().filter((n) => n.startsWith(`${root}/${dir}/`)).length;
  const out: string[] = [];
  const media = count("media");
  if (media)
    out.push(
      `${pl(media, "image ou média présent", "images ou médias présents")} : le texte contenu dans les images n'est pas traité.`,
    );
  if (count("diagrams")) out.push("SmartArt présents : leur texte n'est pas traité.");
  if (extra.charts !== false && count("charts")) out.push("Graphiques présents : leur texte n'est pas traité.");
  const ole = count("embeddings");
  if (ole)
    out.push(
      `${pl(ole, "objet incorporé (OLE) présent", "objets incorporés (OLE) présents")} : leur contenu n'est pas traité.`,
    );
  return out;
}

/** Cibles externes des relations (liens hypertextes…), signalées sans être modifiées. */
export async function externalTargets(pkg: OoxmlPackage): Promise<{ text: string; where: string }[]> {
  const out: { text: string; where: string }[] = [];
  for (const name of pkg.names().filter((n) => n.endsWith(".rels"))) {
    const rels = await tryParse(pkg, name);
    if (!rels) continue;
    for (const rel of elementsNS(rels.doc, NS.rel, "Relationship")) {
      const target = rel.getAttribute("Target");
      if (rel.getAttribute("TargetMode") === "External" && target) out.push({ text: target, where: "Cible de lien" });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Parties à paragraphes (DOCX, PPTX) : lecture des segments et réécriture des édits.

export interface ParagraphLocator {
  part: string;
  index: number;
}

export interface ParagraphState {
  pkg: OoxmlPackage;
  model: RunModel;
  parts: Map<string, { xml: string; parsed: ParsedPart; paragraphs: Element[] }>;
  metadata: string[];
}

export interface PartSpec {
  name: string;
  kind: SegmentKind;
  /** Paragraphes de la partie, dans l'ordre du document. */
  paragraphs: (doc: ParsedPart["doc"]) => Element[];
  /** Type de segment par paragraphe, si différent du type de la partie (ex. cellule de tableau). */
  kindOf?: (p: Element) => SegmentKind;
}

/** Lit les parties ; une partie illisible produit un avertissement au lieu d'une erreur. */
export async function readParagraphParts(
  pkg: OoxmlPackage,
  model: RunModel,
  specs: readonly PartSpec[],
  warnings: string[],
): Promise<{ segments: Segment[]; state: ParagraphState }> {
  const segments: Segment[] = [];
  const state: ParagraphState = { pkg, model, parts: new Map(), metadata: await metadataToClear(pkg) };
  for (const spec of specs) {
    let xml: string;
    let parsed: ParsedPart;
    try {
      xml = await pkg.readText(spec.name);
      parsed = parseXml(xml);
    } catch (e) {
      warnings.push(`Partie illisible, non traitée : ${spec.name} (${e instanceof Error ? e.message : String(e)}).`);
      continue;
    }
    const paragraphs = spec.paragraphs(parsed.doc);
    state.parts.set(spec.name, { xml, parsed, paragraphs });
    paragraphs.forEach((p, index) => {
      const { text } = collect(p, model);
      if (!/\S/.test(text)) return;
      const locator: ParagraphLocator = { part: spec.name, index };
      segments.push({ locator, text, kind: spec.kindOf?.(p) ?? spec.kind });
    });
  }
  warnings.push(...metadataWarning(state.metadata), ...(await titlesWarning(pkg)));
  return { segments, state };
}

export async function writeParagraphParts(doc: Doc): Promise<ArrayBuffer> {
  const state = doc.state as ParagraphState;
  const dirty = new Set<string>();
  for (const seg of doc.segments) {
    if (!seg.edits?.length) continue;
    const { part, index } = seg.locator as ParagraphLocator;
    const entry = state.parts.get(part);
    const p = entry?.paragraphs[index];
    if (!entry || !p) throw new Error(`paragraphe introuvable : ${part}#${index}`);
    const result = applyEdits(collect(p, state.model), seg.edits, state.model);
    if (result !== seg.text) throw new Error(`incohérence de réécriture dans ${part}#${index}`);
    dirty.add(part);
  }
  for (const name of dirty) {
    const entry = state.parts.get(name);
    if (entry) writeIfChanged(state.pkg, name, entry.xml, entry.parsed);
  }
  await clearMetadata(state.pkg);
  return state.pkg.generate();
}
