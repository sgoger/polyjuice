// Côté interface : promisifie les appels au Worker et expose la progression.
import type { Progress } from "../engine/types.ts";
import {
  EngineError,
  type FromWorker,
  type RequestMap,
  type RequestType,
  type ResultMap,
  type ToWorker,
} from "./protocol.ts";

/** Sous-ensemble de l'API Worker utilisé par le client (permet un Worker factice en test). */
export interface WorkerLike {
  postMessage(msg: ToWorker, transfer?: Transferable[]): void;
  terminate(): void;
  onmessage: ((e: MessageEvent<FromWorker>) => void) | null;
}

export interface CallOptions {
  onProgress?: (done: number, total: number) => void;
  onNerProgress?: (p: Progress) => void;
}

interface Pending {
  resolve(value: unknown): void;
  reject(reason: EngineError): void;
  options: CallOptions;
}

export interface Call<K extends RequestType> {
  id: number;
  promise: Promise<ResultMap[K]>;
}

export const createEngineWorker = (): WorkerLike =>
  new Worker(new URL("./engine.worker.ts", import.meta.url), { type: "module" });

export class WorkerClient {
  private worker: WorkerLike;
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();

  constructor(private readonly factory: () => WorkerLike = createEngineWorker) {
    this.worker = this.spawn();
  }

  private spawn(): WorkerLike {
    const w = this.factory();
    w.onmessage = (e) => {
      this.receive(e.data);
    };
    return w;
  }

  private receive(msg: FromWorker): void {
    const p = this.pending.get(msg.id);
    if (!p) return;
    switch (msg.type) {
      case "progress":
        p.options.onProgress?.(msg.done, msg.total);
        break;
      case "nerProgress":
        p.options.onNerProgress?.(msg.progress);
        break;
      case "result":
        this.pending.delete(msg.id);
        p.resolve(msg.result);
        break;
      case "error":
        this.pending.delete(msg.id);
        p.reject(new EngineError(msg.error.code, msg.error.message));
        break;
    }
  }

  call<K extends RequestType>(type: K, params: RequestMap[K], options: CallOptions = {}): Call<K> {
    const id = this.nextId++;
    const promise = new Promise<ResultMap[K]>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve, reject, options });
    });
    // Le fichier est copié puis transféré : l'appelant garde son ArrayBuffer intact.
    const file = (params as { file?: unknown }).file;
    const copy = file instanceof ArrayBuffer ? file.slice(0) : null;
    const sent = copy ? { ...params, file: copy } : params;
    this.worker.postMessage({ id, type, params: sent } as ToWorker, copy ? [copy] : []);
    return { id, promise };
  }

  /** Annule une requête en terminant le Worker ; toutes les requêtes en cours sont rejetées. */
  cancel(): void {
    this.worker.terminate();
    for (const [, p] of this.pending) p.reject(new EngineError("Cancelled", "Traitement annulé"));
    this.pending.clear();
    this.worker = this.spawn();
  }

  dispose(): void {
    this.worker.terminate();
    this.pending.clear();
  }
}
