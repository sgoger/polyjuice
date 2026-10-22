// Inspection rapide d'un document Office au dépôt : commentaires, révisions et auteurs, sans extraire
// le texte ni charger le modèle. Les noms d'auteurs ne quittent pas cette fonction : seuls leurs
// nombres sont renvoyés.
import { elementsNS, NS, parseXml, type Document } from "./ooxml/xml.ts";
import { OoxmlPackage } from "./ooxml/zip.ts";

export interface Inspection {
  format: "docx" | "pptx" | "xlsx";
  /** Commentaires (y compris les réponses) ; pour un classeur, commentaires modernes (en fil). */
  comments: number;
  /** Notes de cellules (anciens commentaires Excel), hors copies de compatibilité des commentaires modernes. */
  notes: number;
  /** Révisions du suivi des modifications (.docx). */
  revisions: number;
  /** Suivi des modifications activé (.docx, w:trackRevisions). */
  trackRevisions: boolean;
  /** Auteurs distincts des commentaires, notes et révisions. */
  authors: number;
  /** Liste de personnes présente (word/people.xml, ppt/commentAuthors.xml, ppt/authors.xml, xl/persons/). */
  peopleList: boolean;
}

/** Rien de trouvé : aucun avertissement à afficher. */
export const isClean = (i: Inspection): boolean =>
  i.comments + i.notes + i.revisions + i.authors === 0 && !i.trackRevisions && !i.peopleList;

const P188 = "http://schemas.microsoft.com/office/powerpoint/2018/8/main";
const TC = "http://schemas.microsoft.com/office/spreadsheetml/2018/threadedcomments";

const REVISIONS = [
  "ins",
  "del",
  "moveFrom",
  "moveTo",
  "rPrChange",
  "pPrChange",
  "sectPrChange",
  "tblPrChange",
  "trPrChange",
  "tcPrChange",
  "numberingChange",
];
const WORD_STORIES = /^word\/(document|comments|footnotes|endnotes|header\d*|footer\d*)\.xml$/;

/** Inspection d'un fichier d'après son extension ; null pour les formats sans commentaires (.pdf, .md, .txt). */
export async function inspect(fileName: string, file: ArrayBuffer): Promise<Inspection | null> {
  const ext = /\.([^./\\]+)$/.exec(fileName)?.[1]?.toLowerCase();
  if (ext !== "docx" && ext !== "pptx" && ext !== "xlsx") return null;
  const pkg = await OoxmlPackage.open(file);
  if (ext === "docx") return inspectDocx(pkg);
  if (ext === "pptx") return inspectPptx(pkg);
  return inspectXlsx(pkg);
}

/** Parties lues une par une ; une partie illisible est ignorée sans interrompre l'inspection. */
async function* parts(pkg: OoxmlPackage, re: RegExp): AsyncGenerator<[string, Document]> {
  for (const name of pkg.names().filter((n) => re.test(n))) {
    let doc: Document;
    try {
      doc = parseXml(await pkg.readText(name)).doc;
    } catch {
      continue;
    }
    yield [name, doc];
  }
}

/** Identifiant → nom ; un nom vide est ignoré (l'auteur est alors compté par son identifiant). */
function named(map: Map<string, string>, id: string, name: string | null): void {
  if (name) map.set(id, name);
}

const empty = (format: Inspection["format"], pkg: OoxmlPackage, people: RegExp): Inspection => ({
  format,
  comments: 0,
  notes: 0,
  revisions: 0,
  trackRevisions: false,
  authors: 0,
  peopleList: pkg.names().some((n) => people.test(n)),
});

export async function inspectDocx(pkg: OoxmlPackage): Promise<Inspection> {
  const out = empty("docx", pkg, /^word\/people\.xml$/);
  const authors = new Set<string>();
  const author = (el: { getAttributeNS(ns: string, local: string): string | null }) => {
    const a = el.getAttributeNS(NS.w, "author");
    if (a) authors.add(a);
  };
  for await (const [name, doc] of parts(pkg, WORD_STORIES)) {
    if (name === "word/comments.xml") {
      const comments = elementsNS(doc, NS.w, "comment");
      out.comments += comments.length;
      comments.forEach(author);
    }
    for (const local of REVISIONS) {
      const els = elementsNS(doc, NS.w, local);
      out.revisions += els.length;
      els.forEach(author);
    }
  }
  for await (const [, doc] of parts(pkg, /^word\/settings\.xml$/)) {
    const track = elementsNS(doc, NS.w, "trackRevisions")[0];
    const val = track?.getAttributeNS(NS.w, "val");
    out.trackRevisions = !!track && val !== "false" && val !== "0" && val !== "off";
  }
  out.authors = authors.size;
  return out;
}

export async function inspectPptx(pkg: OoxmlPackage): Promise<Inspection> {
  const out = empty("pptx", pkg, /^ppt\/(commentAuthors|authors)\.xml$/);
  // Identifiant d'auteur → nom (listes ancienne et moderne).
  const names = new Map<string, string>();
  for await (const [, doc] of parts(pkg, /^ppt\/commentAuthors\.xml$/)) {
    for (const a of elementsNS(doc, NS.p, "cmAuthor"))
      named(names, `p:${a.getAttribute("id")}`, a.getAttribute("name"));
  }
  for await (const [, doc] of parts(pkg, /^ppt\/authors\.xml$/)) {
    for (const a of elementsNS(doc, P188, "author")) named(names, `m:${a.getAttribute("id")}`, a.getAttribute("name"));
  }
  const authors = new Set<string>();
  const add = (key: string) => authors.add(names.get(key) ?? key);
  for await (const [name, doc] of parts(pkg, /^ppt\/comments\/[^/]+\.xml$/)) {
    const modern = /^ppt\/comments\/modernComment[^/]*\.xml$/.test(name);
    const els = modern
      ? [...elementsNS(doc, P188, "cm"), ...elementsNS(doc, P188, "reply")]
      : elementsNS(doc, NS.p, "cm");
    out.comments += els.length;
    for (const el of els) add(`${modern ? "m" : "p"}:${el.getAttribute("authorId")}`);
  }
  out.authors = authors.size;
  return out;
}

export async function inspectXlsx(pkg: OoxmlPackage): Promise<Inspection> {
  const out = empty("xlsx", pkg, /^xl\/persons\/[^/]+\.xml$/);
  const persons = new Map<string, string>();
  for await (const [, doc] of parts(pkg, /^xl\/persons\/[^/]+\.xml$/)) {
    for (const p of elementsNS(doc, TC, "person"))
      named(persons, p.getAttribute("id") ?? "", p.getAttribute("displayName"));
  }
  const authors = new Set<string>();
  for await (const [, doc] of parts(pkg, /^xl\/threadedComments\/[^/]+\.xml$/)) {
    for (const c of elementsNS(doc, TC, "threadedComment")) {
      out.comments++;
      const id = c.getAttribute("personId") ?? "";
      authors.add(persons.get(id) ?? id);
    }
  }
  for await (const [, doc] of parts(pkg, /^xl\/comments\d*\.xml$/)) {
    const list = elementsNS(doc, NS.s, "author").map((a) => a.textContent ?? "");
    for (const c of elementsNS(doc, NS.s, "comment")) {
      const name = list[Number(c.getAttribute("authorRef") ?? 0)] ?? "";
      // Copie de compatibilité d'un commentaire moderne (auteur « tc={id} ») : déjà comptée.
      if (name.startsWith("tc=")) continue;
      out.notes++;
      if (name) authors.add(name);
    }
  }
  out.authors = authors.size;
  return out;
}
