import { describe, expect, it } from "vitest";
import {
  aggregate,
  alignTokens,
  detectWindowed,
  documentNer,
  makeWindows,
  type NerProvider,
  TooLong,
  type TokenPrediction,
} from "../../src/engine/detectors/ner.ts";
import type { Detection } from "../../src/engine/types.ts";

describe("alignement des sous-tokens", () => {
  it("retrouve les offsets, y compris les continuations et [UNK]", () => {
    const text = "Paulina Kowalski, à Łódź ☃ !";
    const tokens = ["[CLS]", "Paulina", "Ko", "##wal", "##ski", ",", "à", "Ł", "##ódź", "[UNK]", "!", "[SEP]"];
    const spans = alignTokens(text, tokens);
    expect(spans.map((s) => (s ? text.slice(s.start, s.end) : null))).toEqual([
      null,
      "Paulina",
      "Ko",
      "wal",
      "ski",
      ",",
      "à",
      "Ł",
      "ódź",
      "☃",
      "!",
      null,
    ]);
  });
});

const p = (token: string, label: string, score = 0.9): Omit<TokenPrediction, "span"> => ({ token, label, score });

function predictions(text: string, raw: Omit<TokenPrediction, "span">[]): TokenPrediction[] {
  const spans = alignTokens(
    text,
    raw.map((r) => r.token),
  );
  return raw.map((r, i) => ({ ...r, span: spans[i] ?? null }));
}

describe("agrégation au niveau du mot", () => {
  it("regroupe B/I et étend aux mots entiers", () => {
    const text = "Małgorzata Zielińska habite Mühlenstraße.";
    const preds = predictions(text, [
      p("[CLS]", "O"),
      p("Ma", "B-PER"),
      p("##ł", "B-PER", 0.6),
      p("##gorzata", "I-PER"),
      p("Zi", "I-PER"),
      p("##elińska", "I-PER"),
      p("habite", "O"),
      p("Mühle", "B-LOC"),
      p("##nstraße", "O"),
      p(".", "O"),
      p("[SEP]", "O"),
    ]);
    expect(aggregate(text, preds).map((d) => [d.text, d.type])).toEqual([
      ["Małgorzata Zielińska", "PERSON"],
      ["Mühlenstraße", "LOCATION"],
    ]);
  });

  it("un sous-token entité suffit à marquer le mot (rappel)", () => {
    const text = "Kowalski";
    const preds = predictions(text, [p("Ko", "O"), p("##walski", "I-PER", 0.8)]);
    expect(aggregate(text, preds).map((d) => d.text)).toEqual(["Kowalski"]);
  });

  it("applique le seuil de 0,5 et ignore MISC", () => {
    const text = "Jean Dupont Euro";
    const preds = predictions(text, [p("Jean", "B-PER", 0.4), p("Dupont", "B-PER", 0.7), p("Euro", "B-MISC", 0.99)]);
    expect(aggregate(text, preds).map((d) => d.text)).toEqual(["Dupont"]);
  });

  it("B démarre une nouvelle entité, type différent aussi", () => {
    const text = "Jean Paul Arte Lyon";
    const preds = predictions(text, [p("Jean", "B-PER"), p("Paul", "B-PER"), p("Arte", "B-ORG"), p("Lyon", "I-LOC")]);
    expect(aggregate(text, preds).map((d) => `${d.text}/${d.type}`)).toEqual([
      "Jean/PERSON",
      "Paul/PERSON",
      "Arte/ORGANIZATION",
      "Lyon/LOCATION",
    ]);
  });

  it("garde les traits d'union dans l'entité", () => {
    const text = "Jean-Baptiste Morel";
    const preds = predictions(text, [p("Jean", "B-PER"), p("-", "I-PER"), p("Baptiste", "I-PER"), p("Morel", "I-PER")]);
    expect(aggregate(text, preds).map((d) => d.text)).toEqual(["Jean-Baptiste Morel"]);
  });
});

describe("fenêtres", () => {
  const words = (n: number) => Array.from({ length: n }, (_, i) => `m${i}`).join(" ");

  it("une seule fenêtre pour un texte court", () => {
    expect(makeWindows("a b c")).toEqual([{ start: 0, end: 5, coreStart: 0, coreEnd: 5 }]);
  });

  it("les zones utiles couvrent tout le texte sans recouvrement", () => {
    const text = words(500);
    const ws = makeWindows(text, 120, 30);
    expect(ws.length).toBeGreaterThan(4);
    expect(ws[0]?.coreStart).toBe(0);
    expect(ws.at(-1)?.coreEnd).toBe(text.length);
    for (let i = 1; i < ws.length; i++) expect(ws[i]?.coreStart).toBe(ws[i - 1]?.coreEnd);
  });

  /** Faux modèle : détecte « Paulina Kowalski » seulement si le nom complet est dans la fenêtre. */
  const fake = async (w: string): Promise<Detection[]> => {
    await Promise.resolve();
    return [...w.matchAll(/Paulina Kowalski|Paulina/g)].map((m) => ({
      start: m.index,
      end: m.index + m[0].length,
      text: m[0],
      type: "PERSON" as const,
      source: "ner" as const,
      score: 0.9,
    }));
  };

  it("reconstitue les offsets et ne garde pas les entités coupées en bord de fenêtre", async () => {
    const text = `${words(89)} Paulina Kowalski ${words(200)} Paulina Kowalski fin`;
    const found = await detectWindowed(text, fake, 120, 30);
    expect(found.map((d) => text.slice(d.start, d.end))).toEqual(["Paulina Kowalski", "Paulina Kowalski"]);
    expect(found.every((d) => d.text === "Paulina Kowalski")).toBe(true);
  });

  it("redécoupe une fenêtre trop longue", async () => {
    const text = `${words(100)} Paulina Kowalski`;
    let calls = 0;
    const found = await detectWindowed(text, async (w) => {
      calls++;
      if (w.split(" ").length > 60) throw new TooLong();
      return fake(w);
    });
    expect(calls).toBeGreaterThan(1);
    expect(found.map((d) => text.slice(d.start, d.end))).toEqual(["Paulina Kowalski"]);
  });
});

describe("organisations (passe sur tout le document)", () => {
  const det = (text: string, value: string, type: Detection["type"]): Detection => {
    const start = text.indexOf(value);
    return { start, end: start + value.length, text: value, type, source: "ner", score: 0.9 };
  };
  const texts = [
    "Marysabelle COTE ouvre la séance.",
    "Marysabelle COTE : le CSE d'ARTE s'est réuni.",
    "Réponse de MARYSABELLE cote.",
  ];
  const fake: NerProvider = {
    id: "fake",
    model: "fake",
    load: () => Promise.resolve(),
    detect: (text) =>
      Promise.resolve(
        text === texts[0]
          ? [det(text, "Marysabelle COTE", "PERSON")]
          : text === texts[1]
            ? [
                det(text, "Marysabelle COTE", "ORGANIZATION"),
                det(text, "CSE", "ORGANIZATION"),
                det(text, "ARTE", "ORGANIZATION"),
              ]
            : [det(text, "MARYSABELLE cote", "ORGANIZATION")],
      ),
  };

  it("une organisation détectée ailleurs comme personne devient une personne, les autres sont écartées", async () => {
    const ner = await documentNer(fake, texts);
    const out = await Promise.all(texts.map((t) => ner.detect(t)));
    expect(out.map((ds) => ds.map((d) => `${d.text}/${d.type}`))).toEqual([
      ["Marysabelle COTE/PERSON"],
      ["Marysabelle COTE/PERSON"],
      ["MARYSABELLE cote/PERSON"],
    ]);
  });
});
