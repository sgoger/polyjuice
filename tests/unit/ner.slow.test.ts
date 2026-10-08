// Test lent : télécharge le modèle réel (~181 Mo). Exécuté par la CI nightly (NER_SLOW=1).
import { describe, expect, it } from "vitest";
import { NER_MODEL, TransformersNerProvider } from "../../src/engine/detectors/ner.ts";
import { NER_CORPUS } from "./ner-corpus.ts";

describe.skipIf(!process.env.NER_SLOW)(`NER réelle (${NER_MODEL})`, () => {
  it("rappel sur 10 phrases par langue (valeur consignée, pas de seuil bloquant)", async () => {
    const ner = new TransformersNerProvider(NER_MODEL, ["cpu"]);
    await ner.load(() => undefined);
    const byLang: Record<string, { gold: number; covered: number; missed: string[] }> = {};
    for (const s of NER_CORPUS) {
      const found = await ner.detect(s.text);
      const L = (byLang[s.lang] ??= { gold: 0, covered: 0, missed: [] });
      for (const [text] of s.gold) {
        L.gold++;
        const start = s.text.indexOf(text);
        const end = start + text.length;
        const covered = found.some((d) => d.start <= start && d.end >= end);
        if (covered) L.covered++;
        else L.missed.push(text);
      }
      for (const d of found) expect(s.text.slice(d.start, d.end)).toBe(d.text);
    }
    console.log("Rappel NER (entité entièrement couverte) :", JSON.stringify(byLang, null, 2));
    const total = Object.values(byLang).reduce((a, b) => a + b.covered, 0) / NER_CORPUS.flatMap((s) => s.gold).length;
    expect(total).toBeGreaterThan(0.5);
  }, 600_000);
});
