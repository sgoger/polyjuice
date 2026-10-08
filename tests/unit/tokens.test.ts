import { describe, expect, it } from "vitest";
import { deriveToken, encodeDigest, isToken, tokenRanges, tokenRegex, withSuffix } from "../../src/engine/tokens.ts";

const salt = new Uint8Array(16).fill(7);

describe("tokens", () => {
  it("sont déterministes pour un même salt, type et original", async () => {
    const a = await deriveToken(salt, "PERSON", "Paulina Kowalski");
    expect(a).toBe(await deriveToken(salt, "PERSON", "Paulina Kowalski"));
    expect(a).toMatch(/^⟦P-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}⟧$/u);
    expect(isToken(a)).toBe(true);
  });

  it("dépendent du salt, du type et de l'original", async () => {
    const a = await deriveToken(salt, "PERSON", "Martin");
    expect(await deriveToken(new Uint8Array(16).fill(8), "PERSON", "Martin")).not.toBe(a);
    expect((await deriveToken(salt, "LOCATION", "Martin")).slice(3)).not.toBe(a.slice(3));
    expect(await deriveToken(salt, "PERSON", "martin")).not.toBe(a);
  });

  it("sont quasi uniques sur 100 000 entrées", async () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100_000; i++) seen.add(await deriveToken(salt, "PERSON", `Personne ${i}`));
    // 31^5 ≈ 28,6 M combinaisons : ~175 collisions attendues, gérées par suffixe.
    expect(seen.size).toBeGreaterThan(99_500);
  }, 60_000);

  it("encode sur l'alphabet sans caractères ambigus", () => {
    expect(encodeDigest(new Uint8Array([0, 0, 0, 0, 0]))).toBe("AAAAA");
    expect(encodeDigest(new Uint8Array([255, 255, 255, 255, 255]))).not.toMatch(/[ILO01]/);
  });

  it("gèrent le suffixe de collision", () => {
    expect(withSuffix("⟦P-ABCDE⟧", 2)).toBe("⟦P-ABCDE2⟧");
    expect(isToken("⟦P-ABCDE2⟧")).toBe(true);
    expect(isToken("⟦P-ABCDE12⟧")).toBe(true);
    expect(isToken("⟦P-ABCDE1⟧")).toBe(false);
    expect(isToken("⟦P-ABCDE0⟧")).toBe(false);
  });

  it("TOKEN_RE ne produit pas de faux positifs", () => {
    const text =
      "[P-ABCDE] ⟦ isolé ⟧ ⟦P-ABCD⟧ ⟦P-ABCDEF⟧ ⟦X-ABCDE⟧ ⟦P-ABCD1⟧ ⟦p-abcde⟧ ⟦P-ABCDO⟧ ⟦P ABCDE⟧ « crochets » [[lien]] ⟦";
    expect(text.match(tokenRegex())).toBeNull();
  });

  it("trouve les tokens et leurs plages", () => {
    const text = "Voir ⟦P-K7M2X⟧ et ⟦E-R4N8Q2⟧.";
    expect(text.match(tokenRegex())).toEqual(["⟦P-K7M2X⟧", "⟦E-R4N8Q2⟧"]);
    expect(tokenRanges(text)).toEqual([
      [5, 14],
      [18, 28],
    ]);
  });
});
