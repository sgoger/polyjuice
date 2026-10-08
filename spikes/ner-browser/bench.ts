// Banc automatisé : Vite + Playwright (Chromium, WebKit ; Firefox si lançable).
// Mesure à froid (contexte neuf, cache vide) puis à chaud (même contexte, cache rempli).
import { writeFile } from "node:fs/promises";
import { chromium, firefox, webkit, type BrowserType } from "playwright";
import { createServer } from "vite";
import type { Gold } from "./corpus.ts";

const MODELS = (process.env.MODELS ?? "Xenova/bert-base-multilingual-cased-ner-hrl,Xenova/distilbert-base-multilingual-cased-ner-hrl").split(",");
const BROWSERS: BrowserType[] = (process.env.BROWSERS ?? "chromium,webkit,firefox")
  .split(",")
  .map((b) => ({ chromium, webkit, firefox })[b as "chromium"]);

const server = await createServer({ root: new URL(".", import.meta.url).pathname, logLevel: "error", server: { port: 5199 } });
await server.listen();
const url = "http://localhost:5199/";

const TYPES: Record<string, string> = { PER: "PERSON", ORG: "ORGANIZATION", LOC: "LOCATION" };
const norm = (s: string) => s.replace(/\s+/g, "").replace(/^##/, "");

interface Run {
  ok: boolean;
  error?: string;
  loadMs: number;
  longMs: number;
  words: number;
  downloaded: number;
  mem: number | null;
  results: { lang: string; text: string; gold: Gold[]; pred: { word: string; label: string; score: number }[] }[];
}

function score(r: Run) {
  const byLang: Record<string, { gold: number; exact: number; inexact: string[]; leaked: string[]; fp: string[] }> = {};
  for (const s of r.results) {
    const L = (byLang[s.lang] ??= { gold: 0, exact: 0, inexact: [], leaked: [], fp: [] });
    const preds = s.pred.filter((p) => p.score >= 0.5).map((p) => ({ w: norm(p.word), t: TYPES[p.label] ?? p.label }));
    for (const [text, type] of s.gold) {
      L.gold++;
      const g = norm(text);
      if (preds.some((p) => p.w === g && p.t === type)) L.exact++;
      // fuite : une partie du texte attendu n'est couverte par aucune prédiction
      else if (!preds.some((p) => g.includes(p.w) || p.w.includes(g))) L.leaked.push(text);
      else L.inexact.push(`${text}→${preds.filter((p) => g.includes(p.w) || p.w.includes(g)).map((p) => `${p.w}(${p.t})`).join("+")}`);
    }
    for (const p of preds) if (!s.gold.some(([t]) => norm(t).includes(p.w) || p.w.includes(norm(t)))) L.fp.push(`${p.w}(${p.t})`);
  }
  return byLang;
}

const report: unknown[] = [];
for (const bt of BROWSERS) {
  let browser;
  try {
    browser = await bt.launch({ args: bt === chromium ? ["--enable-unsafe-webgpu"] : [] });
  } catch (e) {
    console.log(`[${bt.name()}] non lançable : ${(e as Error).message.split("\n")[0]}`);
    continue;
  }
  const probe = await (await browser.newPage()).goto(url).then(async (res) => res);
  void probe;
  const p0 = await browser.newPage();
  await p0.goto(url);
  const webgpu = await p0.evaluate(() => (window as unknown as { hasWebGPU: () => Promise<boolean> }).hasWebGPU());
  await p0.close();
  const devices = webgpu ? ["wasm", "webgpu"] : ["wasm"];
  console.log(`\n[${bt.name()} ${browser.version()}] WebGPU : ${webgpu ? "oui" : "non"}`);
  for (const model of MODELS) {
    for (const device of devices) {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      page.setDefaultTimeout(0);
      const runs: Run[] = [];
      for (const phase of ["froid", "chaud"]) {
        await page.goto(url);
        const r = (await page
          .evaluate(
            ([m, d]) => (window as unknown as { runNer: (m: string, d: string, t: string) => Promise<unknown> }).runNer(m!, d!, "q8"),
            [model, device],
          )
          .catch((e: Error) => ({ ok: false, error: e.message }))) as Run;
        if (!r.ok) {
          console.log(`  ${model} ${device} ${phase} : ÉCHEC ${r.error?.split("\n")[0]}`);
          break;
        }
        runs.push(r);
        console.log(
          `  ${model} ${device} ${phase} : chargement ${(r.loadMs / 1000).toFixed(1)} s, ${r.words} mots en ${(r.longMs / 1000).toFixed(1)} s, téléchargé ${(r.downloaded / 1e6).toFixed(1)} Mo, tas JS ${r.mem ? (r.mem / 1e6).toFixed(0) + " Mo" : "n/d"}`,
        );
      }
      if (runs[0]) {
        const s = score(runs[0]);
        for (const [lang, v] of Object.entries(s))
          console.log(`    ${lang} : ${v.exact}/${v.gold} exactes ; inexactes ${JSON.stringify(v.inexact)} ; fuites ${JSON.stringify(v.leaked)} ; faux positifs ${JSON.stringify(v.fp)}`);
        report.push({ browser: bt.name(), version: browser.version(), model, device, runs: runs.map(({ results, ...rest }) => rest), score: s, raw: runs[0].results });
      }
      await ctx.close();
    }
  }
  await browser.close();
}
await writeFile(new URL("../out/ner-bench.json", import.meta.url), JSON.stringify(report, null, 2));
await server.close();
