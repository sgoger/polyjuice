// Extensions acceptées par chaque onglet, et messages affichés quand un fichier est refusé.
// Importé à la fois par l'interface (au dépôt) et par le Worker (au traitement).
import { t, type Messages } from "../i18n/index.ts";

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

type TargetExt = "docx" | "xlsx" | "pptx";

const TARGETS: Record<string, TargetExt> = {
  docx: "docx",
  docm: "docx",
  xlsx: "xlsx",
  xlsm: "xlsx",
  pptx: "pptx",
  pptm: "pptx",
};

type Reason = keyof Messages["formats"]["reasons"];

/** Formats refusés partout : raison affichée et format vers lequel convertir. */
const REFUSED: Record<string, [reason: Reason, target: TargetExt]> = {
  doc: ["binaryWord", "docx"],
  dot: ["binaryWord", "docx"],
  rtf: ["rtf", "docx"],
  odt: ["openDocument", "docx"],
  dotx: ["template", "docx"],
  dotm: ["template", "docx"],
  xls: ["binaryExcel", "xlsx"],
  xlt: ["binaryExcel", "xlsx"],
  xlsb: ["binaryWorkbook", "xlsx"],
  ods: ["openDocument", "xlsx"],
  csv: ["csv", "xlsx"],
  xltx: ["template", "xlsx"],
  xltm: ["template", "xlsx"],
  ppt: ["binaryPowerPoint", "pptx"],
  pps: ["binaryPowerPoint", "pptx"],
  odp: ["openDocument", "pptx"],
  potx: ["template", "pptx"],
  potm: ["template", "pptx"],
  ppsx: ["slideShow", "pptx"],
  ppsm: ["slideShow", "pptx"],
};

/** Message affiché quand l'extension d'un fichier n'est pas dans la liste acceptée par l'onglet. */
export function refusalMessage(fileName: string, accept: readonly string[]): string {
  const m = t().formats;
  const ext = extensionOf(fileName);
  const refused = REFUSED[ext];
  if (refused) {
    const [reason, target] = refused;
    return m.refused(fileName, ext, m.reasons[reason], m.targets[target], target);
  }
  // Onglet « Restaurer » : un PDF est converti en Markdown à l'anonymisation.
  if (ext === "pdf") return m.pdfRestore(fileName);
  return m.notAccepted(fileName, accept.map((a) => `.${a}`).join(", "));
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
  const target = TARGETS[ext];
  if (!target) return null;
  const m = t().formats;
  if (head.length === 0) return m.empty(fileName);
  if (startsWith(head, ZIP)) return null;
  const { app } = m.targets[target];
  if (startsWith(head, OLE2)) return m.oldOffice(fileName, ext, app, target);
  return m.notReal(fileName, ext, app, target);
}
