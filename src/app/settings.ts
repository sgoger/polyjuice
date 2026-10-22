import { useEffect } from "react";
import type { Progress } from "../engine/types.ts";

/** Réglages partagés par les onglets Anonymiser et Vérifier (jamais persistés). */
export interface SharedSettings {
  names: string;
  setNames: (v: string) => void;
  ner: boolean;
  setNer: (v: boolean) => void;
  /** Lance le chargement du modèle si la case est cochée et qu'il n'est ni chargé ni en cours. */
  ensureNer: () => void;
  cancelNer: () => void;
  nerStatus: "idle" | "loading" | "ready" | "error";
  nerProgress: Progress | null;
  nerError: string | null;
  /** Moteur de calcul du modèle chargé, ex. « WASM, 4 cœurs ». */
  nerBackend: string | null;
}

export const DOC_EXTENSIONS = ["docx", "pptx", "xlsx", "pdf", "md", "txt"] as const;
export const RESTORE_EXTENSIONS = ["docx", "pptx", "xlsx", "md", "txt"] as const;
export const isXlsx = (f: File | null) => !!f && /\.xlsx$/i.test(f.name);

/** Le modèle se charge dès le dépôt d'un document qui en a besoin (jamais pour un .xlsx). */
export function useNerPreload(settings: SharedSettings, file: File | null): void {
  const { ner, ensureNer } = settings;
  const needed = !!file && !isXlsx(file);
  useEffect(() => {
    if (needed && ner) ensureNer();
  }, [needed, ner, ensureNer]);
}
