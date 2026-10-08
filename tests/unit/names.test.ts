import { describe, expect, it } from "vitest";
import { NameMatcher, parseNames } from "../../src/engine/detectors/names.ts";

const texts = (m: NameMatcher, s: string) => m.detect(s).map((d) => d.text);

describe("liste de noms", () => {
  it("parse commentaires, lignes vides, espaces et doublons", () => {
    expect(parseNames("# titre\nMartin\n\n  Jean   Dupont  # collègue\r\nmartin\n#\n")).toEqual([
      "Martin",
      "Jean Dupont",
    ]);
  });

  it("respecte les frontières de mots", () => {
    const m = new NameMatcher(["Martin"]);
    expect(texts(m, "Martin est en Martinique, pas Saint-Martin ni MartinS.")).toEqual(["Martin", "Martin"]);
    expect(texts(m, "l'équipe de Martin_2")).toEqual([]);
  });

  it("est insensible à la casse mais respecte les accents", () => {
    const m = new NameMatcher(["Hélène"]);
    expect(texts(m, "HÉLÈNE, hélène et Helene")).toEqual(["HÉLÈNE", "hélène"]);
    expect(texts(new NameMatcher(["Müller"]), "Mueller, MÜLLER")).toEqual(["MÜLLER"]);
  });

  it("gère les termes multi-mots et préfère le plus long", () => {
    const m = new NameMatcher(["Jean", "Jean Dupont"]);
    expect(texts(m, "Jean Dupont et Jean Dupont puis Jean.")).toEqual(["Jean Dupont", "Jean Dupont", "Jean"]);
  });

  it("échappe les caractères spéciaux", () => {
    const m = new NameMatcher(["O'Brien (fils)", "J.-P. Sartre"]);
    expect(texts(m, "O'Brien (fils) et J.-P. Sartre, pas JX-P. Sartre")).toEqual(["O'Brien (fils)", "J.-P. Sartre"]);
  });

  it("ignore les tokens existants et retourne des PERSON", () => {
    const m = new NameMatcher(["ABCDE"]);
    expect(m.detect("⟦P-ABCDE⟧ et ABCDE")).toMatchObject([
      { text: "ABCDE", start: 13, type: "PERSON", source: "names" },
    ]);
  });

  it("reste rapide avec 2 000 termes", () => {
    const terms = Array.from({ length: 2000 }, (_, i) => `Nom${i} Prénom${i}`);
    const m = new NameMatcher(terms);
    const text = Array.from({ length: 200 }, (_, i) => `Bonjour Nom${i * 7} Prénom${i * 7}, comment allez-vous ?`).join(
      " ",
    );
    const t0 = performance.now();
    expect(m.detect(text)).toHaveLength(200);
    expect(performance.now() - t0).toBeLessThan(500);
  });
});
