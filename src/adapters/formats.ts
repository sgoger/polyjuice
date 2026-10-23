// Extensions acceptées par chaque onglet, et messages affichés quand un fichier est refusé.
// Aucune dépendance : importé à la fois par l'interface (au dépôt) et par le Worker (au traitement).

/** Office Open XML : paquets zip réécrits sans perte (variantes avec macros comprises). */
export const OOXML_EXTENSIONS = ["docx", "docm", "pptx", "pptm", "xlsx", "xlsm"] as const;

export const ANONYMIZE_EXTENSIONS = [...OOXML_EXTENSIONS, "pdf", "md", "txt"] as const;
export const RESTORE_EXTENSIONS = [...OOXML_EXTENSIONS, "md", "txt"] as const;
/** Classeurs : détection par IA indisponible, « Colonnes à anonymiser » disponible. */
export const SPREADSHEET_EXTENSIONS = ["xlsx", "xlsm"] as const;

export function extensionOf(fileName: string): string {
  const m = /\.([^./\\]+)$/.exec(fileName);
  return m?.[1]?.toLowerCase() ?? "";
}

export const isSpreadsheet = (fileName: string): boolean =>
  (SPREADSHEET_EXTENSIONS as readonly string[]).includes(extensionOf(fileName));

interface Target {
  app: string;
  /** Nom du type de fichier dans « Enregistrer sous ». */
  saveAs: string;
  ext: string;
}
const WORD: Target = { app: "Word", saveAs: "Document Word (.docx)", ext: "docx" };
const EXCEL: Target = { app: "Excel", saveAs: "Classeur Excel (.xlsx)", ext: "xlsx" };
const POWERPOINT: Target = { app: "PowerPoint", saveAs: "Présentation PowerPoint (.pptx)", ext: "pptx" };

const TARGETS: Record<string, Target> = {
  docx: WORD,
  docm: WORD,
  xlsx: EXCEL,
  xlsm: EXCEL,
  pptx: POWERPOINT,
  pptm: POWERPOINT,
};

/** Formats refusés partout : raison affichée et format vers lequel convertir. */
const REFUSED: Record<string, [reason: string, target: Target]> = {
  doc: ["ancien format binaire Word 97-2003", WORD],
  dot: ["ancien format binaire Word 97-2003", WORD],
  rtf: ["format RTF", WORD],
  odt: ["format OpenDocument", WORD],
  dotx: ["modèle", WORD],
  dotm: ["modèle", WORD],
  xls: ["ancien format binaire Excel 97-2003", EXCEL],
  xlt: ["ancien format binaire Excel 97-2003", EXCEL],
  xlsb: ["classeur binaire Excel", EXCEL],
  ods: ["format OpenDocument", EXCEL],
  csv: ["texte délimité, sans colonnes reconnues", EXCEL],
  xltx: ["modèle", EXCEL],
  xltm: ["modèle", EXCEL],
  ppt: ["ancien format binaire PowerPoint 97-2003", POWERPOINT],
  pps: ["ancien format binaire PowerPoint 97-2003", POWERPOINT],
  odp: ["format OpenDocument", POWERPOINT],
  potx: ["modèle", POWERPOINT],
  potm: ["modèle", POWERPOINT],
  ppsx: ["diaporama", POWERPOINT],
  ppsm: ["diaporama", POWERPOINT],
};

/** Message affiché quand l'extension d'un fichier n'est pas dans la liste acceptée par l'onglet. */
export function refusalMessage(fileName: string, accept: readonly string[]): string {
  const ext = extensionOf(fileName);
  const refused = REFUSED[ext];
  if (refused) {
    const [reason, t] = refused;
    return `« ${fileName} » : .${ext} n'est pas pris en charge (${reason}) : ouvrez-le dans ${t.app}, Fichier → Enregistrer sous → ${t.saveAs}, puis déposez le .${t.ext}.`;
  }
  // Onglet « Restaurer » : un PDF est converti en Markdown à l'anonymisation.
  if (ext === "pdf")
    return `« ${fileName} » : la restauration ne s'applique pas au .pdf d'origine : déposez le fichier .md (ou .txt) renvoyé par l'outil externe.`;
  return `« ${fileName} » n'est pas pris en charge ici. Formats acceptés : ${accept.map((a) => `.${a}`).join(", ")}.`;
}

const ZIP = [0x50, 0x4b];
const OLE2 = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const startsWith = (head: Uint8Array, sig: readonly number[]) => sig.every((b, i) => head[i] === b);

/**
 * Contenu incompatible avec l'extension, d'après les premiers octets : un .docx, .xlsx ou .pptx qui n'est
 * pas un paquet zip (fichier Office 97-2003 renommé, fichier protégé par mot de passe, export HTML).
 * `null` si rien à signaler.
 */
export function signatureProblem(fileName: string, head: Uint8Array): string | null {
  const ext = extensionOf(fileName);
  const t = TARGETS[ext];
  if (!t) return null;
  if (head.length === 0) return `« ${fileName} » est vide.`;
  if (startsWith(head, ZIP)) return null;
  const fake = `« ${fileName} » n'est pas un vrai .${ext}`;
  if (startsWith(head, OLE2))
    return `${fake} : c'est un fichier Office 97-2003 renommé, ou un fichier protégé par mot de passe. Ouvrez-le dans ${t.app}, retirez le mot de passe s'il y en a un, et enregistrez-le au format .${t.ext}.`;
  return `${fake} : ouvrez-le dans ${t.app} et enregistrez-le au format .${t.ext}.`;
}
