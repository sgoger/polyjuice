import { env, pipeline, type TokenClassificationPipeline } from "@huggingface/transformers";
import { longText, SAMPLES } from "./corpus.ts";

env.allowLocalModels = false;
type Msg = { model: string; device: "wasm" | "webgpu"; dtype: string };

let downloaded = 0;
const fileSizes = new Map<string, number>();

self.onmessage = async (e: MessageEvent<Msg>) => {
  const { model, device, dtype } = e.data;
  try {
    const t0 = performance.now();
    const ner = (await pipeline("token-classification", model, {
      device,
      dtype: dtype as "q8",
      progress_callback: (p: { status: string; file?: string; total?: number }) => {
        if (p.status === "progress" && p.file && p.total) fileSizes.set(p.file, p.total);
      },
    })) as TokenClassificationPipeline;
    const loadMs = performance.now() - t0;
    downloaded = [...fileSizes.values()].reduce((a, b) => a + b, 0);

    // Phrases annotées
    const results = [];
    for (const s of SAMPLES) {
      const out = (await ner(s.text, { aggregation_strategy: "simple" } as never)) as unknown as {
        entity_group: string;
        score: number;
        word: string;
      }[];
      results.push({ ...s, pred: out.map((o) => ({ word: o.word, label: o.entity_group, score: o.score })) });
    }
    // Texte long (fenêtres de ~200 mots pour rester sous 512 sous-tokens)
    const words = longText().split(/\s+/);
    const t1 = performance.now();
    for (let i = 0; i < words.length; i += 200) await ner(words.slice(i, i + 200).join(" "));
    const longMs = performance.now() - t1;
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null;
    self.postMessage({ ok: true, loadMs, longMs, words: words.length, downloaded, mem, results });
  } catch (err) {
    self.postMessage({ ok: false, error: String((err as Error).stack ?? err) });
  }
};
