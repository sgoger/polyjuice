// Usage manuel : /?model=Xenova/bert-base-multilingual-cased-ner-hrl&device=wasm&dtype=q8
const q = new URLSearchParams(location.search);
const run = (model: string, device: string, dtype: string) =>
  new Promise<unknown>((resolve) => {
    const w = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (e) => {
      w.terminate();
      resolve(e.data);
    };
    w.postMessage({ model, device, dtype });
  });
(window as unknown as { runNer: typeof run }).runNer = run;
(window as unknown as { hasWebGPU: () => Promise<boolean> }).hasWebGPU = async () =>
  !!(await (navigator as unknown as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu?.requestAdapter().catch(() => null));
if (q.get("model")) {
  const out = document.getElementById("out")!;
  out.textContent = "Chargement…";
  run(q.get("model")!, q.get("device") ?? "wasm", q.get("dtype") ?? "q8").then((r) => (out.textContent = JSON.stringify(r, null, 2)));
}
