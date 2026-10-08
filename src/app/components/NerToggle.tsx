import { useId } from "react";
import { NER_DOWNLOAD_MB } from "../../engine/detectors/ner.ts";
import type { Progress } from "../../engine/types.ts";

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled: boolean;
  disabledReason?: string;
  progress: Progress | null;
  status: "idle" | "loading" | "ready" | "error";
  error?: string | null;
}

export function NerToggle({ checked, onChange, disabled, disabledReason, progress, status, error }: Props) {
  const id = useId();
  const pct =
    progress?.status === "download" && progress.total
      ? Math.round(((progress.loaded ?? 0) / progress.total) * 100)
      : null;
  return (
    <div className="space-y-1">
      <div className="flex items-start gap-2">
        <input
          id={id}
          type="checkbox"
          checked={checked && !disabled}
          disabled={disabled}
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
      {checked && !disabled && status === "loading" && (
        <div className="space-y-1 pl-6" aria-live="polite">
          <progress
            className="h-2 w-full"
            max={100}
            value={pct ?? undefined}
            aria-label="Chargement du modèle de détection par IA"
          />
          <p className="text-sm text-slate-600">
            {progress?.status === "init"
              ? "Initialisation du modèle…"
              : pct !== null
                ? `Téléchargement du modèle : ${pct} % (${Math.round((progress?.loaded ?? 0) / 1e6)} Mo)`
                : "Préparation du modèle…"}
          </p>
        </div>
      )}
      {checked && !disabled && status === "ready" && (
        <p className="pl-6 text-sm text-slate-600" aria-live="polite">
          ✓ Modèle prêt.
        </p>
      )}
      {checked && !disabled && status === "error" && error && (
        <p role="alert" className="pl-6 text-sm text-red-700">
          ⚠ {error}
        </p>
      )}
    </div>
  );
}
