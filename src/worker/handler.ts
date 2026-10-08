// Traitement des requêtes, indépendant de l'objet Worker (testable en Node).
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

const notImplemented = (what: string) => () =>
  Promise.reject(new EngineError("NotImplemented", `${what} : pas encore implémenté`));

export const defaultHandlers: Handlers = {
  anonymize: notImplemented("Anonymiser"),
  check: notImplemented("Vérifier"),
  restore: notImplemented("Restaurer"),
  loadNer: notImplemented("Chargement NER"),
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
