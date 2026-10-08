import type { RunState } from "../useEngine.ts";

export function Running({ state, onCancel }: { state: RunState; onCancel: () => void }) {
  if (!state.running) return null;
  const { progress, nerProgress } = state;
  const ner =
    nerProgress?.status === "download" && nerProgress.total
      ? `Téléchargement du modèle : ${Math.round(((nerProgress.loaded ?? 0) / nerProgress.total) * 100)} %`
      : nerProgress?.status === "init"
        ? "Initialisation du modèle…"
        : null;
  return (
    <div className="space-y-2 rounded-lg border border-slate-300 bg-white p-4" aria-live="polite">
      <div className="flex items-center justify-between gap-4">
        <p>
          {ner ?? (progress ? `Traitement : ${progress.done} / ${progress.total} segments` : "Lecture du document…")}
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-slate-400 px-3 py-1.5 text-sm hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
        >
          Annuler
        </button>
      </div>
      <progress
        className="h-2 w-full"
        max={progress?.total ?? 1}
        value={progress ? progress.done : undefined}
        aria-label="Progression du traitement"
      />
    </div>
  );
}
