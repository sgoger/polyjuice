import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { inspect, isClean, type Inspection } from "../../src/adapters/inspect.ts";
import { fixture, readDoc } from "./helpers.ts";

const NONE: Omit<Inspection, "format"> = {
  comments: 0,
  notes: 0,
  revisions: 0,
  trackRevisions: false,
  authors: 0,
  peopleList: false,
};

async function zip(files: Record<string, string>, base?: ArrayBuffer): Promise<ArrayBuffer> {
  const z = base ? await JSZip.loadAsync(base) : new JSZip();
  for (const [name, content] of Object.entries(files)) z.file(name, content);
  return z.generateAsync({ type: "arraybuffer" });
}

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const P = 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const P188 = 'xmlns:p188="http://schemas.microsoft.com/office/powerpoint/2018/8/main"';
const S = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
const TC = 'xmlns="http://schemas.microsoft.com/office/spreadsheetml/2018/threadedcomments"';

/** Commentaires PowerPoint : ancien format (2 auteurs) et moderne (1 commentaire + 1 réponse). */
const PPTX_COMMENTS = {
  "ppt/commentAuthors.xml": `<p:cmAuthorLst ${P}><p:cmAuthor id="0" name="Jean Dupont"/><p:cmAuthor id="1" name="Emily Clarke"/></p:cmAuthorLst>`,
  "ppt/comments/comment1.xml": `<p:cmLst ${P}><p:cm authorId="0"/><p:cm authorId="1"/><p:cm authorId="0"/></p:cmLst>`,
  "ppt/authors.xml": `<p188:authorLst ${P188}><p188:author id="{A}" name="Jean Dupont"/><p188:author id="{B}" name="Klaus Müller"/></p188:authorLst>`,
  "ppt/comments/modernComment_100_1.xml": `<p188:cmLst ${P188}><p188:cm authorId="{A}"><p188:replyLst><p188:reply authorId="{B}"/></p188:replyLst></p188:cm></p188:cmLst>`,
};

/** Classeur : 1 note, 1 commentaire moderne (avec sa copie de compatibilité « tc= ») et sa réponse. */
const XLSX_COMMENTS = {
  "xl/comments1.xml": `<comments ${S}><authors><author>tc={1}</author><author>Sabine Weber</author></authors><commentList><comment ref="A1" authorRef="0"/><comment ref="B2" authorRef="1"/></commentList></comments>`,
  "xl/threadedComments/threadedComment1.xml": `<ThreadedComments ${TC}><threadedComment ref="A1" id="{1}" personId="{P1}"/><threadedComment ref="A1" id="{2}" parentId="{1}" personId="{P2}"/></ThreadedComments>`,
  "xl/persons/person.xml": `<personList ${TC}><person displayName="Oliver Hughes" id="{P1}"/><person displayName="Sabine Weber" id="{P2}"/></personList>`,
};

describe("inspection au dépôt", () => {
  it(".docx avec commentaires, révisions, suivi des modifications et word/people.xml", async () => {
    expect(await inspect("revisions.docx", fixture("revisions.docx"))).toEqual({
      ...NONE,
      format: "docx",
      comments: 2,
      revisions: 4,
      trackRevisions: true,
      authors: 3,
      peopleList: true,
    });
  });

  it("sample.docx : un commentaire, un auteur", async () => {
    expect(await inspect("sample.docx", fixture("sample.docx"))).toEqual({
      ...NONE,
      format: "docx",
      comments: 1,
      authors: 1,
    });
  });

  it("compte tous les types de révisions, dans les en-têtes et les notes aussi", async () => {
    const rev = (local: string, author: string) => `<w:${local} w:id="1" w:author="${author}"/>`;
    const file = await zip({
      "word/document.xml": `<w:document ${W}><w:body>${["sectPrChange", "tblPrChange", "trPrChange", "tcPrChange", "numberingChange", "moveFrom", "moveTo", "pPrChange"].map((l) => rev(l, "A")).join("")}</w:body></w:document>`,
      "word/header2.xml": `<w:hdr ${W}>${rev("ins", "B")}</w:hdr>`,
      "word/footnotes.xml": `<w:footnotes ${W}>${rev("del", "A")}</w:footnotes>`,
      "word/settings.xml": `<w:settings ${W}><w:trackRevisions w:val="false"/></w:settings>`,
    });
    expect(await inspect("a.docx", file)).toEqual({ ...NONE, format: "docx", revisions: 10, authors: 2 });
  });

  it("une partie illisible est ignorée sans interrompre l'inspection", async () => {
    const file = await zip({ "word/header1.xml": "<w:hdr" }, fixture("sample.docx"));
    expect(await inspect("a.docx", file)).toMatchObject({ comments: 1, authors: 1 });
    const pptx = await zip({ ...PPTX_COMMENTS, "ppt/comments/comment2.xml": "<<<" });
    expect(await inspect("b.pptx", pptx)).toMatchObject({ comments: 5 });
  });

  it(".pptx : commentaires anciens et modernes, réponses comprises ; auteurs distincts par nom", async () => {
    expect(await inspect("a.pptx", await zip(PPTX_COMMENTS))).toEqual({
      ...NONE,
      format: "pptx",
      comments: 5,
      authors: 3,
      peopleList: true,
    });
  });

  it(".pptx : liste d'auteurs sans commentaire", async () => {
    const file = await zip({ "ppt/commentAuthors.xml": PPTX_COMMENTS["ppt/commentAuthors.xml"] });
    const i = await inspect("a.pptx", file);
    expect(i).toEqual({ ...NONE, format: "pptx", peopleList: true });
    expect(i && isClean(i)).toBe(false);
  });

  it(".xlsx : notes et commentaires modernes, sans compter les copies de compatibilité", async () => {
    expect(await inspect("a.xlsx", await zip(XLSX_COMMENTS))).toEqual({
      ...NONE,
      format: "xlsx",
      comments: 2,
      notes: 1,
      authors: 2,
      peopleList: true,
    });
  });

  it.each(["sample.pptx", "sample.xlsx"])("%s sans commentaire : inspection vide", async (name) => {
    const i = await inspect(name, fixture(name));
    expect(i && isClean(i)).toBe(true);
  });

  it.each(["sample.pdf", "sample.md", "sample.txt"])("%s : rien à inspecter", async (name) => {
    expect(await inspect(name, fixture(name))).toBeNull();
  });

  it("un fichier Office illisible lève une erreur", async () => {
    await expect(inspect("a.docx", new TextEncoder().encode("pas un zip").buffer)).rejects.toThrow();
  });
});

describe("avertissements d'après traitement", () => {
  it(".docx : auteurs, word/people.xml, suivi des modifications", async () => {
    const w = (await readDoc("revisions.docx", fixture("revisions.docx"))).warnings.join("\n");
    expect(w).toMatch(/3 noms d'auteurs de commentaires ou de révisions restent en clair/);
    expect(w).toMatch(/word\/people\.xml/);
    expect(w).toMatch(/Suivi des modifications activé/);
    expect(w).toMatch(/Révisions supprimées/);
  });

  it(".pptx : commentaires comptés", async () => {
    const file = await zip(PPTX_COMMENTS, fixture("sample.pptx"));
    expect((await readDoc("a.pptx", file)).warnings).toContain(
      "5 commentaires de diapositives : texte et noms des auteurs restent en clair (non traités). Supprimez les commentaires dans PowerPoint, puis anonymisez à nouveau.",
    );
  });

  it(".xlsx : commentaires et notes comptés", async () => {
    const file = await zip(XLSX_COMMENTS, fixture("sample.xlsx"));
    expect((await readDoc("a.xlsx", file)).warnings.join("\n")).toMatch(/^3 commentaires ou notes de cellules :/m);
  });
});
