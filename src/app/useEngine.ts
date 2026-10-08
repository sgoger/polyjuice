// Accès au Worker du moteur depuis React : état d'exécution, progression, annulation.
import { useCallback, useEffect, useRef, useState } from "react";
import type { Progress } from "../engine/types.ts";
import { WorkerClient } from "../worker/client.ts";
import { EngineError, type RequestMap, type RequestType, type ResultMap } from "../worker/protocol.ts";

export interface RunState {
  running: boolean;
  progress: { done: number; total: number } | null;
  nerProgress: Progress | null;
  error: string | null;
  /** Début du traitement en cours (Date.now()). */
  startedAt: number | null;
  /** Durée du dernier traitement terminé, en ms (conservée jusqu'au suivant). */
  duration: number | null;
}

const idle: RunState = {
  running: false,
  progress: null,
  nerProgress: null,
  error: null,
  startedAt: null,
  duration: null,
};

let shared: WorkerClient | null = null;
/** Un seul Worker pour toute la page : le modèle NER chargé est partagé entre les onglets. */
export function engine(): WorkerClient {
  shared ??= new WorkerClient();
  return shared;
}

export function useEngine() {
  const [state, setState] = useState<RunState>(idle);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  const run = useCallback(
    async <K extends RequestType>(type: K, params: RequestMap[K]): Promise<ResultMap[K] | null> => {
      const startedAt = Date.now();
      setState({ ...idle, running: true, startedAt });
      const duration = () => Date.now() - startedAt;
      try {
        const result = await engine().call(type, params, {
          onProgress: (done, total) => {
            if (active.current) setState((s) => ({ ...s, progress: { done, total } }));
          },
          onNerProgress: (p) => {
            if (active.current) setState((s) => ({ ...s, nerProgress: p }));
          },
        }).promise;
        if (active.current) setState({ ...idle, duration: duration() });
        return result;
      } catch (e) {
        const message =
          e instanceof EngineError
            ? e.code === "Cancelled"
              ? "Traitement annulé."
              : e.message
            : `Erreur inattendue : ${e instanceof Error ? e.message : String(e)}`;
        if (active.current) setState({ ...idle, error: message, duration: duration() });
        return null;
      }
    },
    [],
  );

  const cancel = useCallback(() => {
    engine().cancel();
  }, []);

  return { state, run, cancel };
}
