import { describe, expect, it } from "vitest";
import { MappingStore } from "../../src/engine/mapping.ts";
import {
  anonymizeReportMarkdown,
  buildAnonymizeReport,
  buildRestoreReport,
  checkReportMarkdown,
  contextAround,
  restoreReportMarkdown,
} from "../../src/engine/report.ts";

const source = { name: "rapport.docx", sha256: "0".repeat(64), format: "docx" as const };

async function sample() {
  const store = MappingStore.create(source, { enabled: true, provider: "transformers-js", model: "m" });
  // Salt fixe pour des snapshots stables.
  const m0 = store.toMapping();
  m0.salt = "AAAAAAAAAAAAAAAAAAAAAA==";
  const fixed = MappingStore.reuse(m0, source, m0.ner);
  const p = await fixed.getOrCreateToken("PERSON", "Paulina Kowalski", "ner");
  await fixed.getOrCreateToken("PERSON", "Paulina Kowalski", "ner");
  const e = await fixed.getOrCreateToken("EMAIL_ADDRESS", "p.k@example.org", "regex");
  return { mapping: fixed.toMapping(), p, e };
}

describe("rapports", () => {
  it("extrait ±40 caractères sur une ligne", () => {
    const text = `${"a".repeat(50)}\n⟦P-ABCDE⟧\t${"b".repeat(50)}`;
    const c = contextAround(text, 51, 60);
    expect(c.before).toBe(`…${"a".repeat(39)} `);
    expect(c.match).toBe("⟦P-ABCDE⟧");
    expect(c.after).toBe(` ${"b".repeat(39)}…`);
  });

  it("rapport de détection", async () => {
    const { mapping, p, e } = await sample();
    const ctx = new Map([
      [p, contextAround(`Rédigé par ${p} | le 3 mars.`, 11, 11 + p.length)],
      [e, contextAround(`Contact : ${e}`, 10, 10 + e.length)],
    ]);
    const r = buildAnonymizeReport("rapport.docx", "docx", mapping, ctx, ["1 image présente : texte non traité"]);
    expect(r.counts).toEqual({ PERSON: 1, EMAIL_ADDRESS: 1 });
    const md = anonymizeReportMarkdown(r);
    expect(md).not.toContain("Paulina");
    expect(md).not.toContain("p.k@example.org");
    expect(md).toMatchSnapshot();
  });

  it("rapport de vérification", () => {
    expect(
      checkReportMarkdown({
        fileName: "a.md",
        rows: [
          {
            text: "Jean",
            type: "PERSON",
            source: "names",
            kind: "body",
            context: contextAround("Bonjour Jean", 8, 12),
          },
        ],
        notices: [{ where: "Nom de feuille", text: "Équipe Dupont" }],
        warnings: [],
      }),
    ).toMatchSnapshot();
    expect(checkReportMarkdown({ fileName: "a.md", rows: [], notices: [], warnings: [] })).toContain("Aucune donnée");
  });

  it("rapport de restauration", async () => {
    const { mapping, p, e } = await sample();
    const r = buildRestoreReport("rapport.docx", mapping, new Map([[p, 2]]), new Map([["⟦P-ZZZZZ⟧", 1]]), []);
    expect(r.missing).toEqual([{ token: e, type: "EMAIL_ADDRESS" }]);
    const md = restoreReportMarkdown(r);
    expect(md).toContain("Erreur : tokens inconnus");
    expect(md).toMatchSnapshot();
  });
});
