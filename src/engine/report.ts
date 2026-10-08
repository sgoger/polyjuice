// Rapports Markdown (§7) et structures parallèles pour l'affichage React.
// Les rapports ne contiennent jamais de valeur d'origine : les extraits de contexte sont pris dans le
// texte anonymisé (pour « Vérifier », dans le texte vérifié, qui est censé être déjà anonymisé).
import { pl } from "./plural.ts";
import type { Mapping } from "./mapping.ts";
import { ENTITY_TYPES, type EntityType, type Format, type SegmentKind } from "./types.ts";

export const CONTEXT_RADIUS = 40;
export const MAPPING_REMINDER = "Le mapping contient les données en clair. Ne pas transmettre.";

export const TYPE_LABELS: Readonly<Record<EntityType, string>> = {
  PERSON: "Personne",
  ORGANIZATION: "Organisation",
  LOCATION: "Lieu",
  EMAIL_ADDRESS: "E-mail",
  PHONE_NUMBER: "Téléphone",
  IBAN_CODE: "IBAN",
  CREDIT_CARD: "Carte bancaire",
  URL: "URL",
  IP_ADDRESS: "Adresse IP",
  FR_NIR: "NIR",
};

export const SOURCE_LABELS: Readonly<Record<string, string>> = {
  ner: "IA (NER)",
  regex: "motif",
  names: "liste de noms",
  columns: "colonne",
};

export const KIND_LABELS: Readonly<Record<SegmentKind, string>> = {
  body: "corps",
  header: "en-tête",
  footer: "pied de page",
  footnote: "note",
  comment: "commentaire",
  notes: "notes du présentateur",
  cell: "cellule",
};

export interface Context {
  before: string;
  match: string;
  after: string;
}

/** Extrait ±`radius` caractères autour de [start, end), sur une ligne. */
export function contextAround(text: string, start: number, end: number, radius = CONTEXT_RADIUS): Context {
  const flat = (s: string) => s.replace(/\s+/g, " ");
  const from = Math.max(0, start - radius);
  const to = Math.min(text.length, end + radius);
  return {
    before: (from > 0 ? "…" : "") + flat(text.slice(from, start)),
    match: text.slice(start, end),
    after: flat(text.slice(end, to)) + (to < text.length ? "…" : ""),
  };
}

const cell = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/[\r\n]+/g, " ");
const code = (s: string) => (s.includes("`") ? `\`\` ${s} \`\`` : `\`${s}\``);
const contextMd = (c: Context) => `${cell(c.before)}**${cell(c.match)}**${cell(c.after)}`;

function warningsSection(warnings: readonly string[]): string[] {
  return ["## Avertissements", "", ...(warnings.length ? warnings.map((w) => `- ${w}`) : ["Aucun."]), ""];
}

// ---------------------------------------------------------------------------
// Anonymiser

export interface AnonymizeRow {
  token: string;
  type: EntityType;
  source: string;
  occurrences: number;
  context: Context;
}

export interface AnonymizeReport {
  fileName: string;
  format: Format;
  ner: boolean;
  counts: Partial<Record<EntityType, number>>;
  rows: AnonymizeRow[];
  warnings: string[];
}

/**
 * `firstContexts` : contexte de la première occurrence de chaque token dans le document produit.
 * Seuls les tokens présents dans ce document figurent dans le rapport.
 */
export function buildAnonymizeReport(
  fileName: string,
  format: Format,
  mapping: Mapping,
  firstContexts: ReadonlyMap<string, Context>,
  warnings: readonly string[],
): AnonymizeReport {
  const rows: AnonymizeRow[] = [];
  const counts: Partial<Record<EntityType, number>> = {};
  for (const [token, context] of firstContexts) {
    const e = mapping.entities[token];
    if (!e) continue;
    rows.push({ token, type: e.type, source: e.source, occurrences: e.occurrences, context });
    counts[e.type] = (counts[e.type] ?? 0) + 1;
  }
  rows.sort((a, b) => ENTITY_TYPES.indexOf(a.type) - ENTITY_TYPES.indexOf(b.type) || a.token.localeCompare(b.token));
  return { fileName, format, ner: mapping.ner.enabled, counts, rows, warnings: [...warnings] };
}

export function anonymizeReportMarkdown(r: AnonymizeReport): string {
  const total = r.rows.length;
  return [
    `# Rapport de détection — ${r.fileName}`,
    "",
    `- Fichier : ${code(r.fileName)}`,
    `- Format : ${r.format}`,
    `- Détection par IA (NER) : ${r.ner ? "activée" : "désactivée"}`,
    `- Entités distinctes remplacées : ${total}`,
    ...ENTITY_TYPES.filter((t) => r.counts[t]).map((t) => `  - ${TYPE_LABELS[t]} : ${r.counts[t] ?? 0}`),
    "",
    "## Remplacements",
    "",
    ...(total
      ? [
          "| Token | Type | Source | Occurrences | Contexte (première occurrence) |",
          "|---|---|---|---:|---|",
          ...r.rows.map(
            (row) =>
              `| ${row.token} | ${TYPE_LABELS[row.type]} | ${SOURCE_LABELS[row.source] ?? row.source} | ${row.occurrences} | ${contextMd(row.context)} |`,
          ),
        ]
      : ["Aucune entité détectée."]),
    "",
    ...warningsSection(r.warnings),
    `> **${MAPPING_REMINDER}**`,
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Vérifier

export interface CheckRow {
  text: string;
  type: EntityType;
  source: string;
  kind: SegmentKind;
  context: Context;
}

export interface CheckReport {
  fileName: string;
  rows: CheckRow[];
  notices: { text: string; where: string }[];
  warnings: string[];
}

export function checkReportMarkdown(r: CheckReport): string {
  return [
    `# Vérification — ${r.fileName}`,
    "",
    r.rows.length === 0
      ? "Aucune donnée personnelle détectée (les tokens existants sont ignorés)."
      : `**${pl(r.rows.length, "élément ressemble", "éléments ressemblent")} encore à des données personnelles.**`,
    "",
    ...(r.rows.length
      ? [
          "| Texte | Type | Source | Emplacement | Contexte |",
          "|---|---|---|---|---|",
          ...r.rows.map(
            (row) =>
              `| ${cell(row.text)} | ${TYPE_LABELS[row.type]} | ${SOURCE_LABELS[row.source] ?? row.source} | ${KIND_LABELS[row.kind]} | ${contextMd(row.context)} |`,
          ),
          "",
        ]
      : []),
    ...(r.notices.length ? ["## À signaler", "", ...r.notices.map((n) => `- ${n.where} : ${cell(n.text)}`), ""] : []),
    ...warningsSection(r.warnings),
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Restaurer

export interface RestoreReport {
  fileName: string;
  found: { token: string; type: EntityType; occurrences: number }[];
  missing: { token: string; type: EntityType }[];
  unknown: { token: string; occurrences: number }[];
  warnings: string[];
}

export function buildRestoreReport(
  fileName: string,
  mapping: Mapping,
  found: ReadonlyMap<string, number>,
  unknown: ReadonlyMap<string, number>,
  warnings: readonly string[],
): RestoreReport {
  const typeOf = (t: string) => mapping.entities[t]?.type ?? "PERSON";
  return {
    fileName,
    found: [...found].map(([token, occurrences]) => ({ token, type: typeOf(token), occurrences })).sort(byToken),
    missing: Object.keys(mapping.entities)
      .filter((t) => !found.has(t))
      .sort()
      .map((token) => ({ token, type: typeOf(token) })),
    unknown: [...unknown].map(([token, occurrences]) => ({ token, occurrences })).sort(byToken),
    warnings: [...warnings],
  };
}

const byToken = (a: { token: string }, b: { token: string }) => a.token.localeCompare(b.token);

export function restoreReportMarkdown(r: RestoreReport): string {
  return [
    `# Rapport de restauration — ${r.fileName}`,
    "",
    ...(r.unknown.length
      ? [
          "## ⚠ Erreur : tokens inconnus",
          "",
          `${pl(r.unknown.length, "token au format polyjuice est absent du mapping et a été laissé tel quel", "tokens au format polyjuice sont absents du mapping et ont été laissés tels quels")}. Vérifiez que le mapping correspond bien à ce document.`,
          "",
          "| Token | Occurrences |",
          "|---|---:|",
          ...r.unknown.map((u) => `| ${u.token} | ${u.occurrences} |`),
          "",
        ]
      : []),
    "## Tokens restaurés",
    "",
    ...(r.found.length
      ? [
          "| Token | Type | Occurrences |",
          "|---|---|---:|",
          ...r.found.map((f) => `| ${f.token} | ${TYPE_LABELS[f.type]} | ${f.occurrences} |`),
        ]
      : ["Aucun token du mapping n'a été trouvé dans ce document."]),
    "",
    "## Tokens du mapping non retrouvés (information)",
    "",
    ...(r.missing.length ? r.missing.map((m) => `- ${m.token} (${TYPE_LABELS[m.type]})`) : ["Aucun."]),
    "",
    ...warningsSection(r.warnings),
  ].join("\n");
}
