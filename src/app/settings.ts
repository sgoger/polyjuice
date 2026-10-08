import type { Progress } from "../engine/types.ts";

/** Réglages partagés par les onglets Anonymiser et Vérifier (jamais persistés). */
export interface SharedSettings {
  names: string;
  setNames: (v: string) => void;
  ner: boolean;
  setNer: (v: boolean) => void;
  nerStatus: "idle" | "loading" | "ready" | "error";
  nerProgress: Progress | null;
  nerError: string | null;
}

export const DOC_EXTENSIONS = ["docx", "pptx", "xlsx", "pdf", "md", "txt"] as const;
export const RESTORE_EXTENSIONS = ["docx", "pptx", "xlsx", "md", "txt"] as const;
export const isXlsx = (f: File | null) => !!f && /\.xlsx$/i.test(f.name);
