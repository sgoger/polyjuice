import { describe, expect, it } from "vitest";
import { restore } from "../../src/worker/pipeline.ts";
import { tokenRegex } from "../../src/engine/tokens.ts";
import { anonymizeFixture, ctx, expected, fixture, readDoc, roundTrip, text } from "./helpers.ts";
import { allXmlText, changedParts, partText, splitTokensAcrossRuns } from "./ooxml-helpers.ts";

const NAME = "sample.pptx";
const TEXT_PARTS =
  /^ppt\/(slides\/slide|notesSlides\/notesSlide|slideMasters\/slideMaster|slideLayouts\/slideLayout)\d+\.xml$/;
const METADATA = ["docProps/core.xml", "docProps/app.xml", "docProps/custom.xml", "_rels/.rels", "[Content_Types].xml"];

describe("PPTX", () => {
  it("lit formes, groupe imbriqué, tableau et notes avec le bon type de zone", async () => {
    const doc = await readDoc(NAME, fixture(NAME));
    for (const e of expected.fixtures[NAME] ?? []) {
      expect(
        doc.segments.some((s) => s.kind === e.kind && s.text.includes(e.text)),
        `${e.text} (${e.kind})`,
      ).toBe(true);
    }
    const texts = doc.segments.map((s) => s.text);
    expect(texts).toContain("Projet Atlas — Paulina Kowalski");
    expect(texts).toContain("Écrire à o.hughes@example.co.uk");
    expect(doc.warnings.join("\n")).toMatch(/1 image/);
  });

  it("aucune entité attendue en clair après anonymisation", async () => {
    const all = await allXmlText((await anonymizeFixture(NAME)).document.data);
    for (const e of expected.fixtures[NAME] ?? []) expect(all, e.text).not.toContain(e.text);
  });

  it("round-trip : texte identique ; seules les parties texte et métadonnées changent", async () => {
    const { anon, restored } = await roundTrip(NAME);
    const before = await readDoc(NAME, fixture(NAME));
    const after = await readDoc("x.pptx", restored.document.data);
    expect(after.segments.map((s) => [s.kind, s.text])).toEqual(before.segments.map((s) => [s.kind, s.text]));
    for (const out of [anon.document.data, restored.document.data]) {
      for (const n of await changedParts(fixture(NAME), out))
        expect(TEXT_PARTS.test(n) || METADATA.includes(n), n).toBe(true);
    }
  });

  it("pas de xml:space sur a:t ; fusion dans le premier run (gras conservé)", async () => {
    const xml = await partText((await anonymizeFixture(NAME)).document.data, "ppt/slides/slide1.xml");
    expect(xml).not.toMatch(/<a:t xml:space/);
    expect(xml).toMatch(/<a:rPr[^>]*b="1"[^>]*>(?:(?!<\/a:r>).)*?<a:t>⟦P-[A-Z0-9]{5}⟧<\/a:t>/su);
  });

  it("deux anonymisations avec le même mapping donnent des fichiers identiques", async () => {
    const first = await anonymizeFixture(NAME);
    const second = await anonymizeFixture(NAME, { mapping: text(first.mapping.data) });
    expect(new Uint8Array(second.document.data)).toEqual(new Uint8Array(first.document.data));
  });

  it("restaure des tokens découpés sur plusieurs runs", async () => {
    const anon = await anonymizeFixture(NAME);
    const translated = await splitTokensAcrossRuns(anon.document.data, TEXT_PARTS, "a");
    expect((await partText(translated, "ppt/slides/slide1.xml")).match(tokenRegex())).toBeNull();
    const r = await restore({ file: translated, fileName: "t.pptx", mapping: text(anon.mapping.data) }, ctx);
    const before = await readDoc(NAME, fixture(NAME));
    const after = await readDoc("x.pptx", r.document.data);
    expect(after.segments.map((s) => s.text)).toEqual(before.segments.map((s) => s.text));
  });
});
