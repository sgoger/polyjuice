// Protocole de messages typé entre l'interface et le Worker du moteur.
import type { Inspection } from "../adapters/inspect.ts";
import type { AnonymizeReport, CheckReport, RestoreReport } from "../engine/report.ts";
import type { Progress } from "../engine/types.ts";
import type { Locale } from "../i18n/index.ts";

export interface AnonymizeParams {
  file: ArrayBuffer;
  fileName: string;
  /** Contenu brut de la liste de noms (un terme par ligne, `#` pour les commentaires). */
  names: string;
  ner: boolean;
  /** En-têtes de colonnes à anonymiser intégralement (XLSX). */
  columns: string[];
  /** Mapping JSON existant à réutiliser, ou null. */
  mapping: string | null;
}

export interface CheckParams {
  file: ArrayBuffer;
  fileName: string;
  names: string;
  ner: boolean;
}

export interface RestoreParams {
  file: ArrayBuffer;
  fileName: string;
  mapping: string;
}

/** Inspection rapide au dépôt (commentaires, révisions, auteurs), sans extraction du texte. */
export interface InspectParams {
  file: ArrayBuffer;
  fileName: string;
}

export type { Inspection };

export interface OutputFile {
  name: string;
  mime: string;
  data: ArrayBuffer;
}

export interface AnonymizeResult {
  document: OutputFile;
  /** Autre version du document : le .md d'un PDF réécrit. */
  alternate?: OutputFile;
  mapping: OutputFile;
  report: OutputFile;
  /** Archive ZIP du document anonymisé et du mapping (sans le rapport), téléchargée automatiquement par l'interface. */
  archive: OutputFile;
  reportMarkdown: string;
  summary: AnonymizeReport;
  warnings: string[];
}

export interface CheckResult {
  report: CheckReport;
  reportMarkdown: string;
  warnings: string[];
}

export interface RestoreResult {
  document: OutputFile;
  report: OutputFile;
  reportMarkdown: string;
  summary: RestoreReport;
  /** Tokens au format valide présents dans le document mais absents du mapping. */
  unknownTokens: string[];
  warnings: string[];
}

export interface NerLoadResult {
  model: string;
  device: string;
  /** Fils de calcul WASM. */
  threads: number;
}

/** Requêtes : type → paramètres. */
export interface RequestMap {
  anonymize: AnonymizeParams;
  check: CheckParams;
  restore: RestoreParams;
  inspect: InspectParams;
  loadNer: Record<string, never>;
}

/** Résultats : type → valeur renvoyée. */
export interface ResultMap {
  anonymize: AnonymizeResult;
  check: CheckResult;
  restore: RestoreResult;
  /** null pour les formats sans commentaires ni révisions (.pdf, .md, .txt). */
  inspect: Inspection | null;
  loadNer: NerLoadResult;
}

export type RequestType = keyof RequestMap;

export type Request = {
  [K in RequestType]: {
    id: number;
    type: K;
    params: RequestMap[K];
    /** Langue des messages produits ; à défaut, celle déjà en cours dans le Worker. */
    locale?: Locale;
  };
}[RequestType];

export interface CancelMessage {
  id: number;
  type: "cancel";
}

export type ToWorker = Request | CancelMessage;

export const ERROR_CODES = [
  "NotImplemented",
  "UnsupportedFormat",
  "InvalidMapping",
  "InvalidDocument",
  "Cancelled",
  "NerUnavailable",
  "Internal",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export interface WorkerError {
  code: ErrorCode;
  message: string;
}

export type FromWorker =
  | { id: number; type: "progress"; done: number; total: number }
  | { id: number; type: "nerProgress"; progress: Progress }
  | { [K in RequestType]: { id: number; type: "result"; request: K; result: ResultMap[K] } }[RequestType]
  | { id: number; type: "error"; error: WorkerError };

/** Erreur typée levée côté moteur et transmise telle quelle à l'interface. */
export class EngineError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "EngineError";
  }
}
