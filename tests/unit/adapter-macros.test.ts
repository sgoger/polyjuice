import { describe, expect, it } from "vitest";
import { inspect } from "../../src/adapters/inspect.ts";
import { anonymizeFixture, fixture, roundTrip } from "./helpers.ts";
import { parts } from "./ooxml-helpers.ts";

describe.each([
  ["sample.docm", "word", "application/vnd.ms-word.document.macroEnabled.12"],
  ["sample.pptm", "ppt", "application/vnd.ms-powerpoint.presentation.macroEnabled.12"],
  ["sample.xlsm", "xl", "application/vnd.ms-excel.sheet.macroEnabled.12"],
])("%s (variante avec macros)", (name, root, mime) => {
  const extra = name.endsWith(".xlsm") ? { columns: ["Nom", "Prénom"] } : {};

  it("garde son extension, son type de contenu et son projet VBA à l'octet près ; les macros sont signalées", async () => {
    const r = await anonymizeFixture(name, extra);
    const ext = name.slice(-4);
    expect(r.document.name).toBe(`sample.anonymise.${ext}`);
    expect(r.document.mime).toBe(mime);
    const before = await parts(fixture(name));
    const after = await parts(r.document.data);
    const vba = `${root}/vbaProject.bin`;
    expect(after.get(vba)).toEqual(before.get(vba));
    expect(new TextDecoder().decode(after.get("[Content_Types].xml"))).toContain(".macroEnabled.main+xml");
    expect(r.warnings).toContain(`Macros présentes (${vba}) : copiées telles quelles, non analysées.`);
  });

  it("se restaure (« Restaurer » accepte l'extension)", async () => {
    const { restored } = await roundTrip(name, extra);
    expect(restored.document.name).toBe(`sample.restaure.${name.slice(-4)}`);
    expect(restored.unknownTokens).toEqual([]);
  });
});

describe("inspection au dépôt des variantes avec macros", () => {
  it.each(["sample.docm", "sample.pptm", "sample.xlsm"])("%s est inspecté comme son format de base", async (name) => {
    const base = name.replace(/m$/, "x");
    expect(await inspect(name, fixture(name))).toEqual(await inspect(base, fixture(base)));
  });
});
