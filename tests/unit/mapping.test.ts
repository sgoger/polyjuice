import { describe, expect, it } from "vitest";
import {
  localIsoDate,
  MappingStore,
  parseMapping,
  serializeMapping,
  sha256Hex,
  type NerInfo,
  type SourceInfo,
} from "../../src/engine/mapping.ts";
import { isToken } from "../../src/engine/tokens.ts";

const source: SourceInfo = { name: "rapport.docx", sha256: "a".repeat(64), format: "docx" };
const ner: NerInfo = { enabled: false, provider: null, model: null };

describe("mapping", () => {
  it("crée un mapping avec salt et compte les occurrences", async () => {
    const store = MappingStore.create(source, ner);
    const t1 = await store.getOrCreateToken("PERSON", "Paulina Kowalski", "names");
    const t2 = await store.getOrCreateToken("PERSON", "Paulina Kowalski", "names");
    const t3 = await store.getOrCreateToken("EMAIL_ADDRESS", "p.k@example.org", "regex");
    expect(t1).toBe(t2);
    expect(isToken(t3) && t3.startsWith("⟦E-")).toBe(true);
    const m = store.toMapping();
    expect(m.entities[t1]).toEqual({ original: "Paulina Kowalski", type: "PERSON", occurrences: 2, source: "names" });
    expect(m.entities[t3]?.occurrences).toBe(1);
    expect(m.salt).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });

  it("deux mappings donnent des tokens différents", async () => {
    const a = await MappingStore.create(source, ner).getOrCreateToken("PERSON", "Jean Dupont", "names");
    const b = await MappingStore.create(source, ner).getOrCreateToken("PERSON", "Jean Dupont", "names");
    expect(a).not.toBe(b);
  });

  it("round-trip : sérialisation stable puis validation", async () => {
    const store = MappingStore.create(source, ner);
    await store.getOrCreateToken("FR_NIR", "1 85 05 78 006 084 36", "regex");
    store.setWarnings(["1 image présente"]);
    const json = serializeMapping(store.toMapping());
    const parsed = parseMapping(json);
    expect(serializeMapping(parsed)).toBe(json);
    expect(Object.keys(JSON.parse(json) as object)).toEqual([...Object.keys(JSON.parse(json) as object)].sort());
  });

  it("la réutilisation conserve salt et entités et complète le mapping", async () => {
    const first = MappingStore.create(source, ner);
    const t = await first.getOrCreateToken("PERSON", "Jean Dupont", "names");
    const m1 = first.toMapping();
    const second = MappingStore.reuse(parseMapping(serializeMapping(m1)), { ...source, name: "autre.docx" }, ner);
    expect(await second.getOrCreateToken("PERSON", "Jean Dupont", "ner")).toBe(t);
    const t2 = await second.getOrCreateToken("PERSON", "Klaus Müller", "names");
    const m2 = second.toMapping();
    expect(m2.salt).toBe(m1.salt);
    expect(m2.created_at).toBe(m1.created_at);
    expect(Object.keys(m2.entities).sort()).toEqual([t, t2].sort());
    expect(m2.entities[t]?.source).toBe("names");
    expect(m2.source.name).toBe("autre.docx");
  });

  it("gère les collisions par suffixe numérique", async () => {
    const store = MappingStore.create(source, ner);
    const m = store.toMapping();
    // Collision simulée : un autre original occupe déjà le token de « Jean ».
    const t = await MappingStore.reuse(m, source, ner).getOrCreateToken("PERSON", "Jean", "names");
    m.entities[t] = { original: "Autre", type: "PERSON", occurrences: 1, source: "names" };
    const reused = MappingStore.reuse(m, source, ner);
    const t2 = await reused.getOrCreateToken("PERSON", "Jean", "names");
    expect(t2).toBe(t.slice(0, -1) + "2⟧");
    expect(reused.toMapping().entities[t2]?.collision).toBe(true);
    expect(parseMapping(serializeMapping(reused.toMapping())).entities[t2]?.original).toBe("Jean");
  });

  it("rejette un JSON malformé ou invalide avec un message explicite", () => {
    expect(() => parseMapping("{pas du json")).toThrow(/pas un fichier JSON valide/);
    expect(() => parseMapping("[]")).toThrow(/objet JSON/);
    expect(() => parseMapping("{}")).toThrow(/schema_version absent/);
    expect(() => parseMapping('{"schema_version": 2}')).toThrow(/Version de schéma du mapping inconnue : 2/);
    expect(() => parseMapping('{"schema_version": 1}')).toThrow(/Mapping invalide/);
  });

  it("rejette un token incohérent avec son type", async () => {
    const store = MappingStore.create(source, ner);
    const t = await store.getOrCreateToken("PERSON", "Jean", "names");
    const m = store.toMapping();
    const bad = serializeMapping(m).replace(t, t.replace("⟦P-", "⟦E-"));
    expect(() => parseMapping(bad)).toThrow(/incohérente/);
  });

  it("calcule le sha256 et formate la date avec décalage", async () => {
    expect(await sha256Hex(new TextEncoder().encode("abc").buffer)).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(localIsoDate(new Date())).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$/);
  });
});
