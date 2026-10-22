import type { ReactNode } from "react";
import { SecondaryButton } from "./PrimaryButton.tsx";

interface Props {
  /** Fichiers traités. */
  files: readonly string[];
  /** Réglages utilisés, ex. « Détection IA », « 8 noms ». */
  details?: readonly string[];
  running: boolean;
  onRestart: () => void;
  /** Revenir aux étapes avec les mêmes fichiers. */
  onEdit?: () => void;
  /** Progression, minuteur. */
  children?: ReactNode;
}

/** Une fois le traitement lancé, remplace les étapes de préparation par un résumé d'une ligne. */
export function Recap({ files, details = [], running, onRestart, onEdit, children }: Props) {
  return (
    <section aria-label="Fichiers traités" className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-sm font-medium break-all">{files.join(" + ")}</p>
          {details.length > 0 && <p className="text-sm text-slate-600">{details.join(" · ")}</p>}
        </div>
        {!running && (
          <div className="flex flex-wrap gap-2">
            {onEdit && <SecondaryButton onClick={onEdit}>Modifier les réglages</SecondaryButton>}
            <SecondaryButton onClick={onRestart}>↺ Recommencer</SecondaryButton>
          </div>
        )}
      </div>
      {children}
    </section>
  );
}
