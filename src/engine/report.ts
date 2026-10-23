// Rapports Markdown (§7) et structures parallèles pour l'affichage React.
// Les rapports ne contiennent jamais de valeur d'origine : les extraits de contexte sont pris dans le
// texte anonymisé (pour « Vérifier », dans le texte vérifié, qui est censé être déjà anonymisé).
import { t } from "../i18n/index.ts";
import type { Mapping } from "./mapping.ts";
import { ENTITY_TYPES, type EntityType, type Format, type SegmentKind } from "./types.ts";

export const CONTEXT_RADIUS = 40;
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

const typeLabel = (type: EntityType) => t().labels.types[type];
const sourceLabel = (source: string) => t().labels.sources[source] ?? source;

function warningsSection(warnings: readonly string[]): string[] {
  const m = t().report;
  return [`## ${m.warnings}`, "", ...(warnings.length ? warnings.map((w) => `- ${w}`) : [m.none]), ""];
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
  const { report: m, colon } = t();
  return [
    `# ${m.detectionTitle(r.fileName)}`,
    "",
    `- ${m.file}${colon}${code(r.fileName)}`,
    `- ${m.format}${colon}${r.format}`,
    `- ${m.ner(r.ner)}`,
    `- ${m.replacedEntities}${colon}${total}`,
    ...ENTITY_TYPES.filter((type) => r.counts[type]).map(
      (type) => `  - ${typeLabel(type)}${colon}${r.counts[type] ?? 0}`,
    ),
    "",
    `## ${m.replacements}`,
    "",
    ...(total
      ? [
          `| ${m.token} | ${m.type} | ${m.source} | ${m.occurrences} | ${m.firstContext} |`,
          "|---|---|---|---:|---|",
          ...r.rows.map(
            (row) =>
              `| ${row.token} | ${typeLabel(row.type)} | ${sourceLabel(row.source)} | ${row.occurrences} | ${contextMd(row.context)} |`,
          ),
        ]
      : [m.noEntity]),
    "",
    ...warningsSection(r.warnings),
    `> **${t().mappingReminder}**`,
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
  const { report: m, colon } = t();
  return [
    `# ${m.checkTitle(r.fileName)}`,
    "",
    r.rows.length === 0 ? m.nothingDetected : `**${t().stillLooksPersonal(r.rows.length)}**`,
    "",
    ...(r.rows.length
      ? [
          `| ${m.text} | ${m.type} | ${m.source} | ${m.location} | ${m.context} |`,
          "|---|---|---|---|---|",
          ...r.rows.map(
            (row) =>
              `| ${cell(row.text)} | ${typeLabel(row.type)} | ${sourceLabel(row.source)} | ${t().labels.kinds[row.kind]} | ${contextMd(row.context)} |`,
          ),
          "",
        ]
      : []),
    ...(r.notices.length
      ? [`## ${m.toReport}`, "", ...r.notices.map((n) => `- ${n.where}${colon}${cell(n.text)}`), ""]
      : []),
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
  const m = t().report;
  return [
    `# ${m.restoreTitle(r.fileName)}`,
    "",
    ...(r.unknown.length
      ? [
          `## ${m.unknownTokensTitle}`,
          "",
          m.unknownTokens(r.unknown.length),
          "",
          `| ${m.token} | ${m.occurrences} |`,
          "|---|---:|",
          ...r.unknown.map((u) => `| ${u.token} | ${u.occurrences} |`),
          "",
        ]
      : []),
    `## ${m.restoredTokens}`,
    "",
    ...(r.found.length
      ? [
          `| ${m.token} | ${m.type} | ${m.occurrences} |`,
          "|---|---|---:|",
          ...r.found.map((f) => `| ${f.token} | ${typeLabel(f.type)} | ${f.occurrences} |`),
        ]
      : [m.noTokenFound]),
    "",
    `## ${m.missingTokens}`,
    "",
    ...(r.missing.length ? r.missing.map((x) => `- ${x.token} (${typeLabel(x.type)})`) : [m.none]),
    "",
    ...warningsSection(r.warnings),
  ].join("\n");
}
