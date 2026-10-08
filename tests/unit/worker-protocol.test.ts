import { describe, expect, it } from "vitest";
import { WorkerClient, type WorkerLike } from "../../src/worker/client.ts";
import { createDispatcher, defaultHandlers, type Handlers } from "../../src/worker/handler.ts";
import { EngineError, type FromWorker, type ToWorker } from "../../src/worker/protocol.ts";

/** Worker factice : relie le client au dispatcher dans le même thread. */
class FakeWorker implements WorkerLike {
  onmessage: ((e: MessageEvent<FromWorker>) => void) | null = null;
  terminated = false;
  readonly received: ToWorker[] = [];
  private readonly dispatch;

  constructor(handlers: Handlers = defaultHandlers) {
    this.dispatch = createDispatcher((msg) => {
      if (!this.terminated) this.onmessage?.({ data: msg } as MessageEvent<FromWorker>);
    }, handlers);
  }

  postMessage(msg: ToWorker): void {
    this.received.push(msg);
    queueMicrotask(() => void this.dispatch(msg));
  }

  terminate(): void {
    this.terminated = true;
  }
}

const txt = () => new TextEncoder().encode("Bonjour").buffer;

describe("protocole du Worker", () => {
  it("renvoie une erreur NotImplemented typée pour anonymize", async () => {
    const client = new WorkerClient(() => new FakeWorker());
    const call = client.call("anonymize", {
      file: txt(),
      fileName: "a.txt",
      names: "",
      ner: false,
      columns: [],
      mapping: null,
    });
    await expect(call.promise).rejects.toBeInstanceOf(EngineError);
    await expect(call.promise).rejects.toMatchObject({ code: "NotImplemented" });
  });

  it("transmet la progression et le résultat", async () => {
    const handlers: Handlers = {
      ...defaultHandlers,
      check: (params, ctx) => {
        ctx.progress(1, 2);
        ctx.progress(2, 2);
        return Promise.resolve({ findings: [], notices: [], warnings: [params.fileName], reportMarkdown: "" });
      },
    };
    const client = new WorkerClient(() => new FakeWorker(handlers));
    const progress: [number, number][] = [];
    const result = await client.call(
      "check",
      { file: txt(), fileName: "b.md", names: "", ner: false },
      { onProgress: (d, t) => progress.push([d, t]) },
    ).promise;
    expect(progress).toEqual([
      [1, 2],
      [2, 2],
    ]);
    expect(result.warnings).toEqual(["b.md"]);
  });

  it("ne détache pas le fichier de l'appelant", () => {
    const client = new WorkerClient(() => new FakeWorker());
    const file = txt();
    void client.call("check", { file, fileName: "c.txt", names: "", ner: false }).promise.catch(() => undefined);
    expect(file.byteLength).toBe(7);
  });

  it("transforme une exception quelconque en erreur Internal", async () => {
    const handlers: Handlers = { ...defaultHandlers, restore: () => Promise.reject(new Error("boum")) };
    const client = new WorkerClient(() => new FakeWorker(handlers));
    await expect(
      client.call("restore", { file: txt(), fileName: "d.txt", mapping: "{}" }).promise,
    ).rejects.toMatchObject({
      code: "Internal",
      message: "boum",
    });
  });

  it("annule en terminant le Worker et en recrée un", async () => {
    const workers: FakeWorker[] = [];
    const handlers: Handlers = { ...defaultHandlers, loadNer: () => new Promise(() => undefined) };
    const client = new WorkerClient(() => {
      const w = new FakeWorker(handlers);
      workers.push(w);
      return w;
    });
    const call = client.call("loadNer", {});
    client.cancel();
    await expect(call.promise).rejects.toMatchObject({ code: "Cancelled" });
    expect(workers).toHaveLength(2);
    expect(workers[0]?.terminated).toBe(true);
  });

  it("le message cancel interrompt un traitement coopératif", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => (release = r));
    const handlers: Handlers = {
      ...defaultHandlers,
      check: async (_p, ctx) => {
        await gate;
        ctx.checkCancelled();
        return { findings: [], notices: [], warnings: [], reportMarkdown: "" };
      },
    };
    const posted: FromWorker[] = [];
    const dispatch = createDispatcher((m) => posted.push(m), handlers);
    const done = dispatch({ id: 7, type: "check", params: { file: txt(), fileName: "e.txt", names: "", ner: false } });
    await dispatch({ id: 7, type: "cancel" });
    release();
    await done;
    expect(posted).toEqual([{ id: 7, type: "error", error: { code: "Cancelled", message: "Traitement annulé" } }]);
  });
});
