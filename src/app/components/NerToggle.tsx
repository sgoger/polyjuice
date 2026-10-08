import { useId } from "react";
import { NER_DOWNLOAD_MB } from "../../engine/detectors/ner.ts";
import type { Progress } from "../../engine/types.ts";

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  onCancel: () => void;
  disabled: boolean;
  disabledReason?: string;
  progress: Progress | null;
  status: "idle" | "loading" | "ready" | "error";
  error?: string | null;
  backend?: string | null;
}

export function NerToggle({
  checked,
  onChange,
  onCancel,
  disabled,
  disabledReason,
  progress,
  status,
  error,
  backend,
}: Props) {
  const id = useId();
  const noteId = useId();
  const pct =
    progress?.status === "download" && progress.total
      ? Math.round(((progress.loaded ?? 0) / progress.total) * 100)
      : null;
  const active = checked && !disabled;
  return (
    <div className="space-y-1">
      <div className="flex items-start gap-2">
        <input
          id={id}
          type="checkbox"
          checked={active}
          disabled={disabled}
          aria-describedby={noteId}
          onChange={(e) => {
            onChange(e.target.checked);
          }}
          className="mt-1 size-4"
        />
        <label htmlFor={id} className={disabled ? "text-slate-500" : ""}>
          Activer la détection de noms par IA (modèle téléchargé une fois, ~{NER_DOWNLOAD_MB} Mo)
          {disabled && disabledReason && <span className="block text-sm">{disabledReason}</span>}
        </label>
      </div>
      <p id={noteId} className="pl-6 text-sm text-slate-600">
        Le modèle est téléchargé depuis le Hub Hugging Face lors de la première utilisation, puis gardé en cache par le
        navigateur. Seuls les poids du modèle sont téléchargés : aucune donnée de vos documents n'est envoyée.
      </p>
      {active && status === "loading" && (
        <div className="space-y-1 pl-6" aria-live="polite">
          <progress
            className="h-2 w-full"
            max={100}
            value={pct ?? undefined}
            aria-label="Chargement du modèle de détection par IA"
          />
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-slate-600">
              {progress?.status === "init" || progress?.status === "ready"
                ? "Initialisation du modèle…"
                : pct !== null
                  ? `Téléchargement du modèle : ${pct} % (${Math.round((progress?.loaded ?? 0) / 1e6)} Mo sur ${Math.round((progress?.total ?? 0) / 1e6)} Mo)`
                  : "Préparation du modèle…"}
            </p>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-slate-400 px-2 py-1 text-sm hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
            >
              Annuler le téléchargement
            </button>
          </div>
        </div>
      )}
      {active && status === "ready" && (
        <p className="pl-6 text-sm text-slate-700" aria-live="polite">
          ✓ Modèle prêt.{backend && ` Calcul : ${backend}.`}
        </p>
      )}
      {status === "error" && error && (
        <p role="alert" className="pl-6 text-sm text-red-700">
          ⚠ {error}
        </p>
      )}
    </div>
  );
}
