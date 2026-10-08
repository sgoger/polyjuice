import { describe, expect, it } from "vitest";
import { check } from "../../src/worker/pipeline.ts";
import { anonymizeFixture, ctx, expected, fixture, NAMES, readDoc, roundTrip, text } from "./helpers.ts";
import { changedParts, partText } from "./ooxml-helpers.ts";

const NAME = "sample.xlsx";
const columns = ["Nom", "Prénom"];
const METADATA = ["docProps/core.xml", "docProps/app.xml", "docProps/custom.xml", "_rels/.rels", "[Content_Types].xml"];

describe("XLSX", () => {
  it("lit chaînes partagées (simples et riches) et chaînes inline", async () => {
    const texts = (await readDoc(NAME, fixture(NAME))).segments.map((s) => s.text);
    expect(texts).toContain("Voir Paulina Kowalski (référente)");
    expect(texts).toContain("Rappeler Sabine Weber au +49 30 12345678");
    expect(texts).not.toContain("4030.5");
  });

  it("colonnes Nom, Prénom entièrement anonymisées ; en-têtes conservés ; aucune entité attendue en clair", async () => {
    const r = await anonymizeFixture(NAME, { columns });
    const sst = await partText(r.document.data, "xl/sharedStrings.xml");
    for (const e of expected.fixtures[NAME] ?? [])
      expect(sst + (await partText(r.document.data, "xl/worksheets/sheet2.xml")), e.text).not.toContain(e.text);
    expect(sst).toContain("<t>Nom</t>");
    expect(sst).toContain("<t>Prénom</t>");
    const mapping = JSON.parse(text(r.mapping.data)) as {
      entities: Record<string, { original: string; source: string }>;
    };
    const fromColumns = Object.values(mapping.entities)
      .filter((e) => e.source === "columns")
      .map((e) => e.original);
    expect(fromColumns.sort()).toEqual(["Bernard", "Dupont", "Hughes", "Jean", "Klaus", "Müller", "Oliver"]);
  });

  it("la chaîne partagée réutilisée dans deux colonnes est anonymisée partout et le rapport le dit", async () => {
    const r = await anonymizeFixture(NAME, { columns });
    expect(r.warnings.join("\n")).toMatch(/1 chaîne\(s\) partagée\(s\).*plusieurs colonnes/);
    expect(r.reportMarkdown).toMatch(/plusieurs colonnes/);
    const sheet = await partText(r.document.data, "xl/worksheets/sheet1.xml");
    // A5 et B5 pointent toujours sur le même index de chaîne partagée.
    const a5 = /<c r="A5"[^>]*><v>(\d+)<\/v>/.exec(sheet)?.[1];
    expect(a5).toBeDefined();
    expect(sheet).toMatch(new RegExp(`<c r="B5"[^>]*><v>${a5 ?? "x"}</v>`));
  });

  it("formules, nombres et dates intacts : la feuille sans chaîne inline n'est pas réécrite", async () => {
    const r = await anonymizeFixture(NAME, { columns });
    const changed = await changedParts(fixture(NAME), r.document.data);
    expect(changed).not.toContain("xl/worksheets/sheet1.xml");
    for (const n of changed) {
      expect(["xl/sharedStrings.xml", "xl/worksheets/sheet2.xml", ...METADATA].includes(n), n).toBe(true);
    }
    expect(await partText(r.document.data, "xl/worksheets/sheet1.xml")).toContain("<f>SUM(E2:E5)</f>");
  });

  it("round-trip : texte des chaînes restauré à l'identique", async () => {
    const { restored } = await roundTrip(NAME, { columns });
    const before = await readDoc(NAME, fixture(NAME));
    const after = await readDoc("x.xlsx", restored.document.data);
    expect(after.segments.map((s) => s.text)).toEqual(before.segments.map((s) => s.text));
  });

  it("les noms de feuilles ne sont jamais modifiés ; « Vérifier » signale ceux qui correspondent à la liste", async () => {
    const r = await anonymizeFixture(NAME, { columns });
    expect(await partText(r.document.data, "xl/workbook.xml")).toContain('name="Équipe Dupont"');
    const c = await check({ file: r.document.data, fileName: "a.xlsx", names: `${NAMES}\nDupont\n`, ner: false }, ctx);
    expect(c.report.notices).toEqual([{ text: "Équipe Dupont", where: "Nom de feuille" }]);
    expect(c.report.rows).toEqual([]);
  });

  it("la NER est toujours désactivée sur les classeurs", async () => {
    const r = await anonymizeFixture(NAME, { columns });
    expect((JSON.parse(text(r.mapping.data)) as { ner: { enabled: boolean } }).ner.enabled).toBe(false);
  });
});
