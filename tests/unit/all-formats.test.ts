// 7.3 : pour chaque format, anonymiser → vérifier (rien) → restaurer → égalité ; anonymiser ×2 → identité ;
// aucune entité attendue en clair dans le document anonymisé ni dans le rapport.
import { describe, expect, it } from "vitest";
import { check, restore } from "../../src/worker/pipeline.ts";
import { anonymizeFixture, ctx, expected, fixture, NAMES, readDoc, text } from "./helpers.ts";
import { allXmlText } from "./ooxml-helpers.ts";

const FORMATS = ["sample.docx", "sample.pptx", "sample.xlsx", "sample.pdf", "sample.md", "sample.txt"];
const extra = (name: string) => (name.endsWith(".xlsx") ? { columns: ["Nom", "Prénom"] } : {});

async function plainText(name: string, data: ArrayBuffer): Promise<string> {
  if (/\.(docx|pptx|xlsx)$/.test(name)) {
    // Toutes les parties XML, sauf ce qui n'est pas modifié par conception et fait l'objet d'un
    // avertissement : relations (cibles de liens mailto:), noms de feuilles (xl/workbook.xml, recopiés
    // dans docProps/app.xml).
    return allXmlText(data, (n) => n.endsWith(".rels") || n === "xl/workbook.xml" || n === "docProps/app.xml");
  }
  return text(data);
}

describe.each(FORMATS)("%s", (name) => {
  it("anonymiser → vérifier → restaurer", async () => {
    const anon = await anonymizeFixture(name, extra(name));
    const c = await check({ file: anon.document.data, fileName: anon.document.name, names: NAMES, ner: false }, ctx);
    expect(c.report.rows).toEqual([]);

    const restored = await restore(
      { file: anon.document.data, fileName: anon.document.name, mapping: text(anon.mapping.data) },
      ctx,
    );
    expect(restored.unknownTokens).toEqual([]);
    expect(restored.summary.missing).toEqual([]);
    // Référence : le texte d'origine tel que lu par l'adaptateur (pour un PDF, le Markdown extrait).
    const before = await readDoc(name, fixture(name));
    const after = await readDoc(restored.document.name, restored.document.data);
    expect(after.segments.map((s) => s.text)).toEqual(before.segments.map((s) => s.text));
  }, 30_000);

  it("anonymiser deux fois avec le même mapping donne le même document", async () => {
    const first = await anonymizeFixture(name, extra(name));
    const second = await anonymizeFixture(name, { ...extra(name), mapping: text(first.mapping.data) });
    expect(new Uint8Array(second.document.data)).toEqual(new Uint8Array(first.document.data));
  }, 30_000);

  it("aucune entité attendue en clair dans le document anonymisé ni dans le rapport", async () => {
    const anon = await anonymizeFixture(name, extra(name));
    const doc = await plainText(anon.document.name, anon.document.data);
    for (const e of expected.fixtures[name] ?? []) {
      expect(doc, `document : ${e.text}`).not.toContain(e.text);
      expect(anon.reportMarkdown, `rapport : ${e.text}`).not.toContain(e.text);
      expect(text(anon.report.data), `rapport téléchargé : ${e.text}`).not.toContain(e.text);
    }
  }, 30_000);
});
