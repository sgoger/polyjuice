// Types partagés par le moteur, les adaptateurs, le Worker et l'interface.

export const ENTITY_TYPES = [
  "PERSON",
  "ORGANIZATION",
  "LOCATION",
  "EMAIL_ADDRESS",
  "PHONE_NUMBER",
  "IBAN_CODE",
  "CREDIT_CARD",
  "URL",
  "IP_ADDRESS",
  "FR_NIR",
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const DETECTION_SOURCES = ["ner", "regex", "names", "columns"] as const;
export type DetectionSource = (typeof DETECTION_SOURCES)[number];

export const FORMATS = ["docx", "pptx", "xlsx", "pdf", "md", "txt"] as const;
export type Format = (typeof FORMATS)[number];

/** Une entité détectée dans le texte d'un segment (offsets en unités UTF-16, fin exclue). */
export interface Detection {
  start: number;
  end: number;
  text: string;
  type: EntityType;
  source: DetectionSource;
  score: number;
}

export type SegmentKind = "body" | "header" | "footer" | "footnote" | "comment" | "notes" | "cell";

/** Remplacement d'une plage du texte d'origine d'un segment. */
export interface Edit {
  start: number;
  end: number;
  replacement: string;
}

export interface Segment {
  /** Opaque pour le moteur, propre à l'adaptateur. */
  locator: unknown;
  text: string;
  kind: SegmentKind;
  /**
   * Renseigné par le moteur quand il modifie le segment : plages remplacées, en coordonnées du texte
   * d'origine. Les adaptateurs OOXML s'en servent pour projeter les remplacements sur les runs.
   */
  edits?: Edit[];
  /** Positionné par l'adaptateur XLSX : segment à remplacer intégralement (« Colonnes à anonymiser »). */
  wholeCell?: boolean;
}

export interface Doc {
  format: Format;
  /** Extension du fichier produit par `write`. */
  outputExtension: string;
  segments: Segment[];
  warnings: string[];
  /** Informations signalées par « Vérifier » sans modification (ex. noms de feuilles). */
  notices?: { text: string; where: string }[];
  /** État interne de l'adaptateur. */
  state: unknown;
}

export interface ReadOptions {
  /** En-têtes de colonnes à anonymiser intégralement (XLSX). */
  columns?: readonly string[];
}

export interface Adapter {
  readonly extensions: readonly string[];
  read(file: ArrayBuffer, options?: ReadOptions): Promise<Doc>;
  /** Réécrit les segments dont `text` a changé. */
  write(doc: Doc): Promise<ArrayBuffer>;
}

export interface Progress {
  status: "download" | "init" | "ready";
  /** Octets téléchargés / total, quand connus. */
  loaded?: number;
  total?: number;
  file?: string;
}
