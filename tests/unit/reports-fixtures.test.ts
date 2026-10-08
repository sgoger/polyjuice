import { describe, expect, it } from "vitest";
import { MappingStore, serializeMapping } from "../../src/engine/mapping.ts";
import { anonymizeFixture } from "./helpers.ts";

/** Mapping vide à salt fixe : tokens stables pour les instantanés. */
function fixedSaltMapping(name: string): string {
  const m = MappingStore.create(
    { name, sha256: "0".repeat(64), format: "txt" },
    { enabled: false, provider: null, model: null },
    new Date(Date.UTC(2026, 0, 1)),
  ).toMapping();
  m.salt = "cG9seWp1aWNlLXRlc3RzIQ==";
  m.created_at = "2026-01-01T00:00:00+00:00";
  return serializeMapping(m);
}

describe("rapports de détection sur chaque fixture", () => {
  it.each(["sample.docx", "sample.pptx", "sample.xlsx", "sample.pdf", "scanned.pdf", "sample.md", "sample.txt"])(
    "%s",
    async (name) => {
      const r = await anonymizeFixture(name, {
        mapping: fixedSaltMapping(name),
        ...(name.endsWith(".xlsx") ? { columns: ["Nom", "Prénom"] } : {}),
      });
      // Les avertissements de l'adaptateur figurent dans le rapport et dans le mapping.
      const mapping = JSON.parse(new TextDecoder().decode(r.mapping.data)) as { warnings: string[] };
      expect(mapping.warnings).toEqual(r.warnings);
      for (const w of r.warnings) expect(r.reportMarkdown).toContain(w);
      expect(r.reportMarkdown).toMatchSnapshot();
    },
    30_000,
  );
});
