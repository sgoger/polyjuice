import type { Progress } from "../../engine/types.ts";
import { useT } from "../messages/index.ts";
import type { RunState } from "../useEngine.ts";

interface Props {
  state: RunState;
  onCancel: () => void;
  /**
   * Chargement du modèle lancé avant le traitement (au dépôt du document) : le traitement l'attend,
   * mais la progression arrive à la requête de chargement, pas à celle-ci.
   */
  modelLoading?: { progress: Progress | null } | null;
}

export function Running({ state, onCancel, modelLoading }: Props) {
  const m = useT().running;
  if (!state.running) return null;
  const { progress } = state;
  const nerProgress = state.nerProgress ?? modelLoading?.progress ?? null;
  const ner =
    nerProgress?.status === "download" && nerProgress.total
      ? m.downloading(Math.round(((nerProgress.loaded ?? 0) / nerProgress.total) * 100))
      : nerProgress?.status === "init"
        ? m.initializing
        : modelLoading && !progress
          ? m.preparing
          : null;
  return (
    <div className="space-y-2 rounded-lg border border-slate-300 bg-white p-4" aria-live="polite" aria-busy="true">
      <div className="flex items-center justify-between gap-4">
        <p>{ner ?? (progress ? m.progress(progress.done, progress.total) : m.reading)}</p>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-slate-400 px-3 py-1.5 text-sm hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
        >
          {m.cancel}
        </button>
      </div>
      <progress
        className="h-2 w-full"
        max={progress?.total ?? 1}
        value={progress ? progress.done : undefined}
        aria-label={m.progressLabel}
      />
    </div>
  );
}
