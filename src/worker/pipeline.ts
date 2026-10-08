// Enchaînement adaptateur → moteur → adaptateur pour les trois onglets.
// Indépendant du Worker : testé directement en Node.
import { adapterFor, extensionOf } from "../adapters/index.ts";
import { detectSegment } from "../engine/detect.ts";
import { NameMatcher, parseNames } from "../engine/detectors/names.ts";
import type { NerProvider } from "../engine/detectors/ner.ts";
import { MappingStore, parseMapping, serializeMapping, sha256Hex } from "../engine/mapping.ts";
import { finalSpans, replaceDetections } from "../engine/replace.ts";
import {
  anonymizeReportMarkdown,
  buildAnonymizeReport,
  buildRestoreReport,
  checkReportMarkdown,
  contextAround,
  restoreReportMarkdown,
  type CheckRow,
  type Context,
} from "../engine/report.ts";
import { emptyInventory, restoreText } from "../engine/restore.ts";
import type { Adapter, Doc, Format } from "../engine/types.ts";
import {
  EngineError,
  type AnonymizeParams,
  type AnonymizeResult,
  type CheckParams,
  type CheckResult,
  type OutputFile,
  type RestoreParams,
  type RestoreResult,
} from "./protocol.ts";

export interface PipelineContext {
  progress(done: number, total: number): void;
  checkCancelled(): void;
  /** Fournit le modèle NER chargé (le charge au besoin). */
  getNer?: () => Promise<NerProvider>;
}

const MIME: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  md: "text/markdown;charset=utf-8",
  txt: "text/plain;charset=utf-8",
  json: "application/json",
};

/** Nombre de segments entre deux messages de progression. */
const PROGRESS_EVERY = 25;

export const baseName = (fileName: string): string => fileName.replace(/\.[^./\\]+$/, "");

const encode = (s: string): ArrayBuffer => new TextEncoder().encode(s).buffer;

function output(name: string, data: ArrayBuffer): OutputFile {
  return { name, mime: MIME[extensionOf(name)] ?? "application/octet-stream", data };
}

function resolveAdapter(fileName: string): { format: Format; adapter: Adapter } {
  const found = adapterFor(fileName);
  if (!found) {
    const ext = extensionOf(fileName);
    throw new EngineError(
      "UnsupportedFormat",
      ext ? `Format non pris en charge : .${ext}` : "Fichier sans extension : format inconnu",
    );
  }
  return found;
}

async function readDoc(adapter: Adapter, file: ArrayBuffer, columns?: readonly string[]): Promise<Doc> {
  try {
    return await adapter.read(file, columns ? { columns } : undefined);
  } catch (e) {
    if (e instanceof EngineError) throw e;
    throw new EngineError("InvalidDocument", `Document illisible : ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function nerFor(enabled: boolean, format: Format, ctx: PipelineContext): Promise<NerProvider | null> {
  // NER toujours désactivée sur les classeurs (§3).
  if (!enabled || format === "xlsx") return null;
  if (!ctx.getNer) throw new EngineError("NerUnavailable", "Détection par IA indisponible");
  return ctx.getNer();
}

// ---------------------------------------------------------------------------

export async function anonymize(params: AnonymizeParams, ctx: PipelineContext): Promise<AnonymizeResult> {
  const { format, adapter } = resolveAdapter(params.fileName);
  const existing = params.mapping ? parseMapping(params.mapping) : null;
  const doc = await readDoc(adapter, params.file, format === "xlsx" ? params.columns : undefined);
  const ner = await nerFor(params.ner, format, ctx);
  const names = new NameMatcher(parseNames(params.names));
  const source = { name: params.fileName, sha256: await sha256Hex(params.file), format };
  const nerInfo = ner
    ? { enabled: true, provider: ner.id, model: ner.model }
    : { enabled: false, provider: null, model: null };
  const store = existing ? MappingStore.reuse(existing, source, nerInfo) : MappingStore.create(source, nerInfo);

  const contexts = new Map<string, Context>();
  const total = doc.segments.length;
  for (const [i, segment] of doc.segments.entries()) {
    if (i % PROGRESS_EVERY === 0) {
      ctx.checkCancelled();
      ctx.progress(i, total);
    }
    const detections = await detectSegment(segment, { names, ner });
    if (detections.length === 0) continue;
    const r = await replaceDetections(segment.text, detections, store);
    segment.text = r.text;
    segment.edits = r.edits;
    finalSpans(r.edits).forEach((span, k) => {
      const token = r.tokens[k]?.token;
      if (token && !contexts.has(token)) contexts.set(token, contextAround(r.text, span.start, span.end));
    });
  }
  ctx.checkCancelled();
  ctx.progress(total, total);

  const warnings = [...doc.warnings];
  store.setWarnings(warnings);
  const mapping = store.toMapping();
  const data = await adapter.write(doc);
  const report = buildAnonymizeReport(params.fileName, format, mapping, contexts, warnings);
  const reportMarkdown = anonymizeReportMarkdown(report);
  const base = baseName(params.fileName);
  return {
    document: output(`${base}.anonymise.${doc.outputExtension}`, data),
    mapping: output(`${base}.json`, encode(serializeMapping(mapping))),
    report: output(`${base}.report.md`, encode(reportMarkdown)),
    reportMarkdown,
    summary: report,
    warnings,
  };
}

export async function check(params: CheckParams, ctx: PipelineContext): Promise<CheckResult> {
  const { format, adapter } = resolveAdapter(params.fileName);
  const doc = await readDoc(adapter, params.file);
  const ner = await nerFor(params.ner, format, ctx);
  const names = new NameMatcher(parseNames(params.names));
  const rows: CheckRow[] = [];
  const total = doc.segments.length;
  for (const [i, segment] of doc.segments.entries()) {
    if (i % PROGRESS_EVERY === 0) {
      ctx.checkCancelled();
      ctx.progress(i, total);
    }
    for (const d of await detectSegment({ ...segment, wholeCell: false }, { names, ner })) {
      rows.push({
        text: d.text,
        type: d.type,
        source: d.source,
        kind: segment.kind,
        context: contextAround(segment.text, d.start, d.end),
      });
    }
  }
  ctx.progress(total, total);
  const notices = (doc.notices ?? []).filter((n) => names.detect(n.text).length > 0);
  const report = { fileName: params.fileName, rows, notices, warnings: [...doc.warnings] };
  return { report, reportMarkdown: checkReportMarkdown(report), warnings: report.warnings };
}

export async function restore(params: RestoreParams, ctx: PipelineContext): Promise<RestoreResult> {
  if (extensionOf(params.fileName) === "pdf") {
    throw new EngineError(
      "UnsupportedFormat",
      "La restauration ne s'applique pas à un PDF : déposez le fichier .md (ou .txt) renvoyé par l'outil externe.",
    );
  }
  const { adapter } = resolveAdapter(params.fileName);
  const mapping = parseMapping(params.mapping);
  const doc = await readDoc(adapter, params.file);
  const inventory = emptyInventory();
  const total = doc.segments.length;
  for (const [i, segment] of doc.segments.entries()) {
    if (i % PROGRESS_EVERY === 0) {
      ctx.checkCancelled();
      ctx.progress(i, total);
    }
    const r = restoreText(segment.text, mapping.entities, inventory);
    if (r.edits.length === 0) continue;
    segment.text = r.text;
    segment.edits = r.edits;
  }
  ctx.progress(total, total);
  const data = await adapter.write(doc);
  const warnings = [...doc.warnings];
  const report = buildRestoreReport(params.fileName, mapping, inventory.found, inventory.unknown, warnings);
  const reportMarkdown = restoreReportMarkdown(report);
  const base = baseName(params.fileName).replace(/\.anonymise$/, "");
  return {
    document: output(`${base}.restaure.${doc.outputExtension}`, data),
    report: output(`${base}.restauration.md`, encode(reportMarkdown)),
    reportMarkdown,
    summary: report,
    unknownTokens: report.unknown.map((u) => u.token),
    warnings,
  };
}
