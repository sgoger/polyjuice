import { describe, expect, it } from "vitest";
import { parseXml } from "../../src/adapters/ooxml/xml.ts";
import { tokenRegex } from "../../src/engine/tokens.ts";
import { check, restore } from "../../src/worker/pipeline.ts";
import { anonymizeFixture, ctx, expected, fixture, NAMES, readDoc, roundTrip, text } from "./helpers.ts";
import { allXmlText, changedParts, partText, parts, splitTokensAcrossRuns } from "./ooxml-helpers.ts";

const NAME = "sample.docx";
const TEXT_PARTS = /^word\/(document|header\d*|footer\d*|footnotes|endnotes|comments)\.xml$/;
const METADATA = ["docProps/core.xml", "docProps/app.xml", "docProps/custom.xml", "_rels/.rels", "[Content_Types].xml"];

describe("DOCX : lecture", () => {
  it("toutes les entités attendues sont dans les segments, avec le bon type de zone", async () => {
    const doc = await readDoc(NAME, fixture(NAME));
    for (const e of expected.fixtures[NAME] ?? []) {
      expect(
        doc.segments.some((s) => s.kind === e.kind && s.text.includes(e.text)),
        `${e.text} (${e.kind})`,
      ).toBe(true);
    }
  });

  it("le nom coupé sur deux runs apparaît entier ; l'e-mail de l'hyperlien est présent", async () => {
    const texts = (await readDoc(NAME, fixture(NAME))).segments.map((s) => s.text);
    expect(texts).toContain("Rédigé par Paulina Kowalski le 3 mars 2026.");
    expect(texts).toContain("Écrire à jean.dupont@example.fr.");
  });

  it("zone de texte : les deux branches de mc:AlternateContent sont lues", async () => {
    const texts = (await readDoc(NAME, fixture(NAME))).segments.map((s) => s.text);
    expect(texts.filter((t) => t.startsWith("Encadré"))).toHaveLength(2);
  });

  it("w:tab compte comme une tabulation", async () => {
    const texts = (await readDoc(NAME, fixture(NAME))).segments.map((s) => s.text);
    expect(texts).toContain("Dossier de Mehmet Yılmaz\tsuivi par Emily Clarke.");
  });

  it("avertissements : image, métadonnées, auteurs ; cible de lien signalée", async () => {
    const doc = await readDoc(NAME, fixture(NAME));
    expect(doc.warnings.join("\n")).toMatch(/1 image/);
    expect(doc.warnings.join("\n")).toMatch(/Métadonnées vidées : auteur/);
    expect(doc.warnings.join("\n")).toMatch(/auteur de commentaires/);
    expect(doc.notices).toContainEqual({ text: "mailto:jean.dupont@example.fr", where: "Cible de lien" });
  });
});

describe("DOCX : écriture", () => {
  it("aucune entité attendue en clair dans les parties texte du document anonymisé", async () => {
    const r = await anonymizeFixture(NAME);
    // La cible mailto: des relations n'est pas modifiée (avertissement) : exclue ici.
    const all = await allXmlText(r.document.data, (n) => n.endsWith(".rels"));
    for (const e of expected.fixtures[NAME] ?? []) expect(all, e.text).not.toContain(e.text);
    expect(r.warnings.join("\n")).toMatch(/Cible de lien : 1 élément/);
  });

  it("round-trip : texte restauré identique segment par segment", async () => {
    const { restored } = await roundTrip(NAME);
    const before = await readDoc(NAME, fixture(NAME));
    const after = await readDoc("x.docx", restored.document.data);
    expect(after.segments.map((s) => [s.kind, s.text])).toEqual(before.segments.map((s) => [s.kind, s.text]));
    expect(restored.unknownTokens).toEqual([]);
  });

  it("seules les parties texte et les métadonnées changent ; le reste est identique octet pour octet", async () => {
    const { anon, restored } = await roundTrip(NAME);
    for (const out of [anon.document.data, restored.document.data]) {
      const changed = await changedParts(fixture(NAME), out);
      for (const n of changed) expect(TEXT_PARTS.test(n) || METADATA.includes(n), n).toBe(true);
    }
    // Les parties sans entité (styles, thème, image, relations) ne sont même pas réécrites.
    expect(await changedParts(fixture(NAME), anon.document.data)).not.toContain("word/styles.xml");
  });

  it("la mise en forme des runs non touchés est préservée", async () => {
    const r = await anonymizeFixture(NAME);
    // xmldom réécrit &apos; en ' (équivalent, voir DEVIATIONS) : on compare après normalisation.
    const norm = (xml: string) => xml.replace(/&apos;/g, "'").replace(/&quot;/g, '"');
    const para = (xml: string, needle: string) => {
      const i = xml.indexOf(needle);
      return xml.slice(xml.lastIndexOf("<w:p>", i), xml.indexOf("</w:p>", i));
    };
    const before = norm(await partText(fixture(NAME), "word/document.xml"));
    const after = norm(await partText(r.document.data, "word/document.xml"));
    expect(para(after, "Rapport d'activité")).toBe(para(before, "Rapport d'activité"));
    expect(para(after, "Nom</w:t>")).toBe(para(before, "Nom</w:t>"));
    // Le run en gras « alski » est vidé mais garde sa mise en forme ; « le 3 mars » est intact.
    const split = para(after, "le 3 mars 2026.");
    expect(split).toMatch(/<w:i\/>.*<w:t xml:space="preserve">Paulina ⟦P-|<w:i\/>.*Rédigé par|⟦P-/s);
    expect(split).toContain("<w:b/>");
    expect(split).toContain(" le 3 mars 2026.</w:t>");
  });

  it("métadonnées vidées, dates neutralisées, custom.xml supprimé avec ses références", async () => {
    const out = (await anonymizeFixture(NAME)).document.data;
    const core = await partText(out, "docProps/core.xml");
    expect(core).not.toMatch(/Paulina|Jean Dupont|Fixture polyjuice|Rapport Paulina/);
    expect(core).toContain(">2000-01-01T00:00:00Z<");
    const p = await parts(out);
    expect(p.has("docProps/custom.xml")).toBe(false);
    expect(await partText(out, "_rels/.rels")).not.toContain("custom.xml");
    expect(await partText(out, "[Content_Types].xml")).not.toContain("custom.xml");
  });

  it("deux anonymisations avec le même mapping donnent des fichiers identiques", async () => {
    const first = await anonymizeFixture(NAME);
    const second = await anonymizeFixture(NAME, { mapping: text(first.mapping.data) });
    expect(new Uint8Array(second.document.data)).toEqual(new Uint8Array(first.document.data));
  });

  it("toutes les parties XML du document produit sont bien formées", async () => {
    const out = (await anonymizeFixture(NAME)).document.data;
    for (const [name, data] of await parts(out)) {
      if (/\.(xml|rels)$/.test(name)) expect(() => parseXml(new TextDecoder().decode(data)), name).not.toThrow();
    }
  });

  it("« Vérifier » ne trouve rien sur le document anonymisé, hors cible de lien signalée", async () => {
    const r = await anonymizeFixture(NAME);
    const c = await check({ file: r.document.data, fileName: "a.docx", names: NAMES, ner: false }, ctx);
    expect(c.report.rows).toEqual([]);
    expect(c.report.notices).toEqual([{ text: "mailto:jean.dupont@example.fr", where: "Cible de lien" }]);
  });
});

describe("DOCX : restauration après découpage des tokens par un traducteur", () => {
  it("tokens coupés sur trois runs de mises en forme différentes : texte restauré identique", async () => {
    const anon = await anonymizeFixture(NAME);
    const translated = await splitTokensAcrossRuns(anon.document.data, TEXT_PARTS, "w");
    // Le découpage a bien eu lieu
    expect((await partText(translated, "word/document.xml")).match(tokenRegex())).toBeNull();
    const r = await restore({ file: translated, fileName: "trad.docx", mapping: text(anon.mapping.data) }, ctx);
    const before = await readDoc(NAME, fixture(NAME));
    const after = await readDoc("x.docx", r.document.data);
    expect(after.segments.map((s) => s.text)).toEqual(before.segments.map((s) => s.text));
    expect(r.unknownTokens).toEqual([]);
    expect(r.summary.missing).toEqual([]);
    expect(r.summary.found.reduce((a, f) => a + f.occurrences, 0)).toBe(
      Object.values(
        (JSON.parse(text(anon.mapping.data)) as { entities: Record<string, { occurrences: number }> }).entities,
      ).reduce((a, e) => a + e.occurrences, 0),
    );
  });
});
