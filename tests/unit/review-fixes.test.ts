// Correctifs de la revue finale (7.4) : contenus secondaires supprimés ou signalés.
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { readText } from "../../src/adapters/text.ts";
import { anonymize, check } from "../../src/worker/pipeline.ts";
import { ctx, fixture, NAMES } from "./helpers.ts";
import { parts } from "./ooxml-helpers.ts";

async function patch(name: string, fn: (zip: JSZip) => Promise<void>): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(fixture(name));
  await fn(zip);
  return zip.generateAsync({ type: "arraybuffer" });
}
const run = (file: ArrayBuffer, fileName: string) =>
  anonymize({ file, fileName, names: NAMES, ner: false, columns: [], mapping: null }, ctx);
const enc = (s: string) => new TextEncoder().encode(s).buffer;

describe("revue finale", () => {
  it("la miniature docProps/thumbnail est supprimée avec ses références", async () => {
    const file = await patch("sample.pptx", async (zip) => {
      zip.file("docProps/thumbnail.jpeg", new Uint8Array([1, 2, 3]));
      const rels = (await zip.file("_rels/.rels")?.async("string")) ?? "";
      zip.file(
        "_rels/.rels",
        rels.replace(
          "</Relationships>",
          '<Relationship Id="rIdThumb" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/thumbnail" Target="docProps/thumbnail.jpeg"/></Relationships>',
        ),
      );
    });
    const r = await run(file, "a.pptx");
    expect([...(await parts(r.document.data)).keys()]).not.toContain("docProps/thumbnail.jpeg");
    expect(new TextDecoder().decode((await parts(r.document.data)).get("_rels/.rels"))).not.toContain("thumbnail");
    expect(r.warnings.join("\n")).toMatch(/miniature d'aperçu/);
  });

  it("XLSX : le résultat texte d'une formule est signalé s'il contient une donnée", async () => {
    const file = await patch("sample.xlsx", async (zip) => {
      const xml = (await zip.file("xl/worksheets/sheet1.xml")?.async("string")) ?? "";
      zip.file(
        "xl/worksheets/sheet1.xml",
        xml.replace('<c r="D7" t="s">', '<c r="C7" t="str"><f>C2</f><v>jean.dupont@example.fr</v></c><c r="D7" t="s">'),
      );
    });
    const r = await run(file, "a.xlsx");
    expect(r.warnings.join("\n")).toMatch(/Résultat de formule : 1 élément/);
  });

  it("DOCX : un texte alternatif sensible est signalé par « Vérifier »", async () => {
    const file = await patch("sample.docx", async (zip) => {
      const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
      zip.file("word/document.xml", xml.replace('descr=""', 'descr="Photo de Jean Dupont"'));
    });
    const c = await check({ file, fileName: "a.docx", names: NAMES, ner: false }, ctx);
    expect(c.report.notices).toContainEqual({ text: "Photo de Jean Dupont", where: "Texte alternatif" });
  });

  it("PDF : le texte extrait est lu sans règles Markdown (une ligne ~~~ ne masque rien)", () => {
    const doc = readText(enc("Intro\n\n~~~\n\nJean Dupont"), false, "md");
    expect(doc.segments.map((s) => s.text)).toContain("Jean Dupont");
  });

  it("Markdown : un bloc de code non refermé est signalé", () => {
    expect(readText(enc("a\n```\nb@example.org"), true, "md").warnings.join()).toMatch(/non refermé/);
  });
});
