import { createContext, useEffect } from "react";
import type { Progress } from "../engine/types.ts";

/** Réglages partagés par les onglets Anonymiser et Vérifier (seul le glossaire peut être mémorisé). */
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

/** Mémorisation du glossaire de noms, fournie par App au champ NamesInput des deux onglets. */
export interface GlossaryPersistence {
  /** Faux si le navigateur bloque le stockage local : la case est alors désactivée. */
  available: boolean;
  remember: boolean;
  setRemember: (v: boolean) => void;
  /** Vrai si le dernier enregistrement a échoué (quota dépassé…). */
  saveFailed: boolean;
  /** Vide le glossaire et sa copie enregistrée. */
  clear: () => void;
}

export const GlossaryContext = createContext<GlossaryPersistence | null>(null);

export const DOC_EXTENSIONS = ["docx", "pptx", "xlsx", "pdf", "md", "txt"] as const;
export const RESTORE_EXTENSIONS = ["docx", "pptx", "xlsx", "md", "txt"] as const;
/** Nombre de termes du glossaire de noms (lignes non vides, hors commentaires `#`). */
export const countNames = (text: string): number =>
  text.split(/\r?\n/).filter((l) => l.replace(/#.*$/, "").trim()).length;

export const isXlsx = (f: File | null) => !!f && /\.xlsx$/i.test(f.name);
export const isPdf = (f: File | null) => !!f && /\.pdf$/i.test(f.name);

/** Le modèle se charge dès le dépôt d'un document qui en a besoin (jamais pour un .xlsx). */
export function useNerPreload(settings: SharedSettings, file: File | null): void {
  const { ner, ensureNer } = settings;
  const needed = !!file && !isXlsx(file);
  useEffect(() => {
    if (needed && ner) ensureNer();
  }, [needed, ner, ensureNer]);
}
