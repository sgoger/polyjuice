import { describe, expect, it } from "vitest";
import { detectSegment } from "../../src/engine/detect.ts";
import { NameMatcher } from "../../src/engine/detectors/names.ts";
import { MappingStore } from "../../src/engine/mapping.ts";
import { applyEdits, finalSpans, replaceDetections } from "../../src/engine/replace.ts";
import { emptyInventory, missingTokens, restoreText } from "../../src/engine/restore.ts";
import { tokenRegex } from "../../src/engine/tokens.ts";

const source = { name: "t.txt", sha256: "0".repeat(64), format: "txt" as const };
const ner = { enabled: false, provider: null, model: null };

// Générateur pseudo-aléatoire à graine fixe (mulberry32).
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES = ["Paulina Kowalski", "Jean Dupont", "Klaus Müller", "Oliver Hughes", "Ayşe Demir"];
const PIECES = [
  ...NAMES,
  "p.kowalski@example.org",
  "06 12 34 56 78",
  "+49 30 12345678",
  "FR76 3000 6000 0112 3456 7890 189",
  "https://example.org/a",
  "192.168.1.2",
  "1 85 05 78 006 084 91",
  "4111 1111 1111 1111",
];
const FILLER = [
  "Bonjour",
  "le dossier",
  "de",
  "et",
  "Hallo",
  "please contact",
  ",",
  ".",
  "—",
  "(voir)",
  "\t",
  "« note »",
];

describe("remplacement et restauration", () => {
  it("round-trip sur 50 cas générés", async () => {
    const rand = rng(42);
    const pick = <T>(a: readonly T[]) => a[Math.floor(rand() * a.length)] as T;
    const names = new NameMatcher(NAMES);
    for (let i = 0; i < 50; i++) {
      const parts = Array.from({ length: 4 + Math.floor(rand() * 8) }, () =>
        rand() < 0.4 ? pick(PIECES) : pick(FILLER),
      );
      const text = parts.join(" ");
      const store = MappingStore.create(source, ner);
      const detections = await detectSegment({ locator: 0, text, kind: "body" }, { names });
      const replaced = await replaceDetections(text, detections, store);
      for (const p of PIECES) if (text.includes(p)) expect(replaced.text, text).not.toContain(p);
      const mapping = store.toMapping();
      const inv = emptyInventory();
      expect(restoreText(replaced.text, mapping.entities, inv).text).toBe(text);
      expect(inv.unknown.size).toBe(0);
      expect(missingTokens(mapping.entities, inv)).toEqual([]);
    }
  });

  it("compte les occurrences et réutilise le même token", async () => {
    const store = MappingStore.create(source, ner);
    const text = "Jean Dupont, puis Jean Dupont et jean@example.org";
    const detections = await detectSegment(
      { locator: 0, text, kind: "body" },
      { names: new NameMatcher(["Jean Dupont"]) },
    );
    const r = await replaceDetections(text, detections, store);
    const tokens = r.text.match(tokenRegex()) ?? [];
    expect(tokens).toHaveLength(3);
    expect(tokens[0]).toBe(tokens[1]);
    const m = store.toMapping();
    expect(m.entities[tokens[0] ?? ""]?.occurrences).toBe(2);
    expect(r.edits.map((e) => text.slice(e.start, e.end))).toEqual(["Jean Dupont", "Jean Dupont", "jean@example.org"]);
    expect(finalSpans(r.edits).map((s) => r.text.slice(s.start, s.end))).toEqual(tokens);
  });

  it("signale les tokens inconnus et ceux du mapping non retrouvés", async () => {
    const store = MappingStore.create(source, ner);
    const a = await store.getOrCreateToken("PERSON", "Jean", "names");
    const b = await store.getOrCreateToken("PERSON", "Paul", "names");
    const m = store.toMapping();
    const inv = emptyInventory();
    const out = restoreText(`${a} et ⟦P-ZZZZZ⟧ et ${a} et ⟦P-ZZZZZ⟧`, m.entities, inv);
    expect(out.text).toBe("Jean et ⟦P-ZZZZZ⟧ et Jean et ⟦P-ZZZZZ⟧");
    expect(inv.found.get(a)).toBe(2);
    expect(inv.unknown.get("⟦P-ZZZZZ⟧")).toBe(2);
    expect(missingTokens(m.entities, inv)).toEqual([b]);
  });

  it("applyEdits applique de la fin vers le début", () => {
    expect(
      applyEdits("abcdef", [
        { start: 0, end: 1, replacement: "XX" },
        { start: 3, end: 5, replacement: "" },
      ]),
    ).toBe("XXbcf");
  });

  it("ne touche pas aux propriétés héritées d'Object", () => {
    const inv = emptyInventory();
    expect(restoreText("⟦P-ABCDE⟧", Object.create(null) as Record<string, never>, inv).text).toBe("⟦P-ABCDE⟧");
  });
});
