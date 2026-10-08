import { describe, expect, it } from "vitest";
import { detectSegment, resolveOverlaps } from "../../src/engine/detect.ts";
import { NameMatcher } from "../../src/engine/detectors/names.ts";
import type { NerProvider } from "../../src/engine/detectors/ner.ts";
import type { Detection, EntityType, Segment } from "../../src/engine/types.ts";

/** NER factice : renvoie les entités d'un dictionnaire fixe. */
class FakeNer implements NerProvider {
  readonly id = "fake";
  readonly model = "fake";
  constructor(private readonly entities: Record<string, EntityType>) {}
  load(): Promise<void> {
    return Promise.resolve();
  }
  detect(text: string): Promise<Detection[]> {
    const out: Detection[] = [];
    for (const [t, type] of Object.entries(this.entities)) {
      for (const m of text.matchAll(new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))) {
        out.push({ start: m.index, end: m.index + t.length, text: t, type, source: "ner", score: 0.8 });
      }
    }
    return Promise.resolve(out);
  }
}

const seg = (text: string, extra: Partial<Segment> = {}): Segment => ({ locator: 0, text, kind: "body", ...extra });
const summary = (ds: Detection[]) => ds.map((d) => `${d.type}:${d.text}:${d.source}`);

const ner = new FakeNer({
  "Paulina Kowalski": "PERSON",
  "Arte France": "ORGANIZATION",
  Strasbourg: "LOCATION",
  "Klaus Müller": "PERSON",
  Hamburg: "LOCATION",
  "Deutschen Bahn": "ORGANIZATION",
  "Oliver Hughes": "PERSON",
  BBC: "ORGANIZATION",
  Cardiff: "LOCATION",
  Kowalski: "PERSON",
});

describe("orchestration de la détection", () => {
  it.each([
    [
      "fr",
      "Paulina Kowalski (Arte France, Strasbourg) : p.kowalski@example.org, 06 12 34 56 78, NIR 1 85 05 78 006 084 91.",
      [
        "PERSON:Paulina Kowalski:ner",
        "ORGANIZATION:Arte France:ner",
        "LOCATION:Strasbourg:ner",
        "EMAIL_ADDRESS:p.kowalski@example.org:regex",
        "PHONE_NUMBER:06 12 34 56 78:regex",
        "FR_NIR:1 85 05 78 006 084 91:regex",
      ],
    ],
    [
      "de",
      "Klaus Müller (Deutschen Bahn, Hamburg), Tel. +49 30 12345678, IBAN DE89 3704 0044 0532 0130 00.",
      [
        "PERSON:Klaus Müller:ner",
        "ORGANIZATION:Deutschen Bahn:ner",
        "LOCATION:Hamburg:ner",
        "PHONE_NUMBER:+49 30 12345678:regex",
        "IBAN_CODE:DE89 3704 0044 0532 0130 00:regex",
      ],
    ],
    [
      "en",
      "Oliver Hughes (BBC, Cardiff) — https://example.co.uk/oh — 10.0.0.1 — card 4111 1111 1111 1111.",
      [
        "PERSON:Oliver Hughes:ner",
        "ORGANIZATION:BBC:ner",
        "LOCATION:Cardiff:ner",
        "URL:https://example.co.uk/oh:regex",
        "IP_ADDRESS:10.0.0.1:regex",
        "CREDIT_CARD:4111 1111 1111 1111:regex",
      ],
    ],
  ])("vérité terrain %s", async (_lang, text, want) => {
    expect(summary(await detectSegment(seg(text), { ner }))).toEqual(want);
  });

  it("un e-mail contenant un nom de la liste ne produit qu'une détection E", async () => {
    const names = new NameMatcher(["Kowalski"]);
    const found = await detectSegment(seg("Écrire à p.kowalski@example.org"), { names, ner });
    expect(summary(found)).toEqual(["EMAIL_ADDRESS:p.kowalski@example.org:regex"]);
  });

  it("ner désactivée : regex et liste seulement", async () => {
    const names = new NameMatcher(["Paulina Kowalski"]);
    const found = await detectSegment(seg("Paulina Kowalski (Arte France) 06 12 34 56 78"), { names });
    expect(summary(found)).toEqual(["PERSON:Paulina Kowalski:names", "PHONE_NUMBER:06 12 34 56 78:regex"]);
  });

  it("les tokens existants ne sont jamais détectés", async () => {
    const names = new NameMatcher(["K7M2X"]);
    const found = await detectSegment(seg("⟦P-K7M2X⟧ a écrit à ⟦E-R4N8Q⟧."), {
      names,
      ner: new FakeNer({ "⟦P-K7M2X⟧": "PERSON", "P-K7M2X": "PERSON" }),
    });
    expect(found).toEqual([]);
  });

  it("coupe aux tabulations et retire la ponctuation en bordure", async () => {
    const found = await detectSegment(seg("Jean\tDupont."), { ner: new FakeNer({ "Jean\tDupont.": "PERSON" }) });
    expect(summary(found)).toEqual(["PERSON:Jean:ner", "PERSON:Dupont:ner"]);
  });

  it("segment de colonne : remplacement intégral sans détection", async () => {
    expect(summary(await detectSegment(seg("  Dupont, Jean ", { wholeCell: true, kind: "cell" }), {}))).toEqual([
      "PERSON:Dupont, Jean:columns",
    ]);
    expect(await detectSegment(seg("⟦P-K7M2X⟧", { wholeCell: true }), {})).toEqual([]);
    expect(await detectSegment(seg("   ", { wholeCell: true }), {})).toEqual([]);
  });

  it("résout les chevauchements : plus long, puis plus confiant", () => {
    const d = (start: number, end: number, score: number, type: EntityType = "PERSON"): Detection => ({
      start,
      end,
      score,
      type,
      text: "",
      source: "ner",
    });
    expect(resolveOverlaps([d(0, 5, 0.9), d(0, 10, 0.6), d(8, 12, 1)])).toEqual([d(0, 10, 0.6)]);
    expect(resolveOverlaps([d(0, 5, 0.6, "LOCATION"), d(0, 5, 0.9), d(5, 7, 0.5)])).toEqual([
      d(0, 5, 0.9),
      d(5, 7, 0.5),
    ]);
  });
});
