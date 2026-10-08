// Traitement des requêtes, indépendant de l'objet Worker (testable en Node).
import type { Progress } from "../engine/types.ts";
import { TransformersNerProvider } from "../engine/detectors/ner.ts";
import { anonymize, check, restore } from "./pipeline.ts";
import {
  EngineError,
  type FromWorker,
  type Request,
  type RequestType,
  type ResultMap,
  type ToWorker,
} from "./protocol.ts";

export type Post = (msg: FromWorker, transfer?: Transferable[]) => void;

export interface Context {
  /** Signale la progression (segments traités / total). */
  progress(done: number, total: number): void;
  /** Lève une erreur `Cancelled` si la requête a été annulée. */
  checkCancelled(): void;
  post: Post;
  id: number;
}

export type Handlers = {
  [K in RequestType]: (params: Extract<Request, { type: K }>["params"], ctx: Context) => Promise<ResultMap[K]>;
};

let ner: TransformersNerProvider | null = null;
let nerLoading: Promise<TransformersNerProvider> | null = null;

/** Charge le modèle NER une seule fois par Worker ; la progression est envoyée à la requête courante. */
function getNer(ctx: Context): Promise<TransformersNerProvider> {
  if (ner) return Promise.resolve(ner);
  nerLoading ??= (async () => {
    const provider = new TransformersNerProvider();
    try {
      await provider.load((progress: Progress) => {
        ctx.post({ id: ctx.id, type: "nerProgress", progress });
      });
    } catch (e) {
      nerLoading = null;
      throw new EngineError(
        "NerUnavailable",
        `Le modèle de détection par IA n'a pas pu être chargé (${e instanceof Error ? e.message : String(e)}). Vérifiez la connexion, ou décochez l'option : la détection par motifs et par liste fonctionne sans réseau.`,
      );
    }
    ner = provider;
    return provider;
  })();
  return nerLoading;
}

const withNer = (ctx: Context) => ({ ...ctx, getNer: () => getNer(ctx) });

export const defaultHandlers: Handlers = {
  anonymize: (params, ctx) => anonymize(params, withNer(ctx)),
  check: (params, ctx) => check(params, withNer(ctx)),
  restore: (params, ctx) => restore(params, ctx),
  loadNer: async (_params, ctx) => {
    const provider = await getNer(ctx);
    return { model: provider.model, device: provider.device ?? "?", threads: provider.threads };
  },
};

/** Crée la fonction de réception des messages du Worker. */
export function createDispatcher(post: Post, handlers: Handlers = defaultHandlers) {
  const cancelled = new Set<number>();
  return async (msg: ToWorker): Promise<void> => {
    if (msg.type === "cancel") {
      cancelled.add(msg.id);
      return;
    }
    const { id } = msg;
    const ctx: Context = {
      id,
      post,
      progress: (done, total) => {
        post({ id, type: "progress", done, total });
      },
      checkCancelled: () => {
        if (cancelled.has(id)) throw new EngineError("Cancelled", "Traitement annulé");
      },
    };
    try {
      const result = await run(msg, handlers, ctx);
      post(result, transferables(result));
    } catch (e) {
      const error =
        e instanceof EngineError
          ? { code: e.code, message: e.message }
          : { code: "Internal" as const, message: e instanceof Error ? e.message : String(e) };
      post({ id, type: "error", error });
    } finally {
      cancelled.delete(id);
    }
  };
}

async function run(msg: Request, handlers: Handlers, ctx: Context): Promise<FromWorker> {
  switch (msg.type) {
    case "anonymize":
      return { id: msg.id, type: "result", request: msg.type, result: await handlers.anonymize(msg.params, ctx) };
    case "check":
      return { id: msg.id, type: "result", request: msg.type, result: await handlers.check(msg.params, ctx) };
    case "restore":
      return { id: msg.id, type: "result", request: msg.type, result: await handlers.restore(msg.params, ctx) };
    case "loadNer":
      return { id: msg.id, type: "result", request: msg.type, result: await handlers.loadNer(msg.params, ctx) };
  }
}

/** Les ArrayBuffer des fichiers produits sont transférés, pas copiés. */
function transferables(msg: FromWorker): Transferable[] {
  if (msg.type !== "result") return [];
  const r = msg.result as unknown as Record<string, unknown>;
  return Object.values(r).flatMap((v) =>
    v && typeof v === "object" && "data" in v && v.data instanceof ArrayBuffer ? [v.data] : [],
  );
}
