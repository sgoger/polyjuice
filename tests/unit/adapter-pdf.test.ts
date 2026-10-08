import { describe, expect, it } from "vitest";
import { paragraphsOf } from "../../src/adapters/pdf.ts";
import { restore } from "../../src/worker/pipeline.ts";
import { anonymizeFixture, ctx, expected, fixture, readDoc, text } from "./helpers.ts";

describe("PDF", () => {
  it("extrait le texte en Markdown avec toutes les entités, saut de page ---", async () => {
    const doc = await readDoc("sample.pdf", fixture("sample.pdf"));
    const all = doc.segments.map((s) => s.text).join("\n");
    for (const e of expected.fixtures["sample.pdf"] ?? []) expect(all, e.text).toContain(e.text);
    expect(all).toContain("---");
    expect(doc.outputExtension).toBe("md");
    expect(doc.warnings.join("\n")).not.toMatch(/scanné/);
  }, 30_000);

  it("produit un .md anonymisé sans aucune entité attendue", async () => {
    const r = await anonymizeFixture("sample.pdf");
    expect(r.document.name).toBe("sample.anonymise.md");
    const out = text(r.document.data);
    for (const e of expected.fixtures["sample.pdf"] ?? []) expect(out, e.text).not.toContain(e.text);
  }, 30_000);

  it("PDF scanné : avertissement et .md quasi vide, sans erreur", async () => {
    const r = await anonymizeFixture("scanned.pdf");
    expect(r.warnings.join("\n")).toMatch(/probablement scanné/);
    expect(r.warnings.join("\n")).toMatch(/1 page\(s\) contiennent des images/);
    expect(text(r.document.data).trim()).toBe("");
  }, 30_000);

  it("« Restaurer » refuse un .pdf", async () => {
    await expect(restore({ file: fixture("sample.pdf"), fileName: "a.pdf", mapping: "{}" }, ctx)).rejects.toMatchObject(
      {
        code: "UnsupportedFormat",
        message: expect.stringMatching(/déposez le fichier \.md/) as unknown,
      },
    );
  });

  it("regroupe en lignes puis en paragraphes (écart > 1,5 × hauteur)", () => {
    const it = (str: string, x: number, y: number) => ({ str, x, y, w: str.length * 5, h: 10 });
    expect(paragraphsOf([it("Jean", 0, 100), it("Dupont", 30, 100), it("suite", 0, 88), it("Autre", 0, 60)])).toEqual([
      "Jean Dupont suite",
      "Autre",
    ]);
  });
});
