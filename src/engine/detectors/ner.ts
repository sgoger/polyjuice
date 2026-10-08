// Reconnaissance d'entités nommées (optionnelle) : interface NerProvider et implémentation transformers.js.
//
// Le pipeline `token-classification` de transformers.js ne fournit ni offsets ni découpage au-delà de
// 512 sous-tokens (voir docs/DEVIATIONS.md, spike 0.2) : on tokenise nous-mêmes, on aligne les
// sous-tokens sur le texte, on agrège au niveau du mot et on découpe les textes longs en fenêtres.
import type { Detection, EntityType, Progress } from "../types.ts";

/** Modèle ONNX retenu par le spike 0.2. */
export const NER_MODEL = "Xenova/bert-base-multilingual-cased-ner-hrl";
export const NER_PROVIDER_ID = "transformers-js";
/** Taille approximative du téléchargement (poids quantifiés + tokeniseur), en Mo. */
export const NER_DOWNLOAD_MB = 181;
export const NER_THRESHOLD = 0.5;

export interface NerProvider {
  readonly id: string;
  readonly model: string;
  load(onProgress: (p: Progress) => void): Promise<void>;
  /** Types renvoyés : PERSON | ORGANIZATION | LOCATION. */
  detect(text: string): Promise<Detection[]>;
}

const TAGS: Readonly<Record<string, EntityType>> = { PER: "PERSON", ORG: "ORGANIZATION", LOC: "LOCATION" };
const SPECIAL = new Set(["[CLS]", "[SEP]", "[PAD]", "[MASK]"]);

// ---------------------------------------------------------------------------
// Fonctions pures (testées sans modèle)

/** Ponctuation au sens du pré-tokeniseur BERT : chaque caractère est un mot à part. */
const isPunct = (c: string) => /[\p{P}\p{S}]/u.test(c);
const isSpace = (c: string) => /[\s\p{Cc}\p{Cf}]/u.test(c);

export interface Span {
  start: number;
  end: number;
}

/**
 * Retrouve la plage de chaque sous-token WordPiece dans le texte (null pour les jetons spéciaux et
 * les jetons introuvables). `##` marque un sous-token qui continue le mot précédent.
 */
export function alignTokens(text: string, tokens: readonly string[]): (Span | null)[] {
  let cursor = 0;
  return tokens.map((tok) => {
    if (SPECIAL.has(tok)) return null;
    if (tok === "[UNK]") {
      while (cursor < text.length && isSpace(text.charAt(cursor))) cursor++;
      const start = cursor;
      if (cursor < text.length && isPunct(text.charAt(cursor))) cursor++;
      else while (cursor < text.length && !isSpace(text.charAt(cursor)) && !isPunct(text.charAt(cursor))) cursor++;
      return start < cursor ? { start, end: cursor } : null;
    }
    const piece = tok.startsWith("##") ? tok.slice(2) : tok;
    if (!piece) return null;
    const idx = text.startsWith(piece, cursor) ? cursor : text.indexOf(piece, cursor);
    if (idx < 0 || idx - cursor > 64) return null;
    cursor = idx + piece.length;
    return { start: idx, end: cursor };
  });
}

export interface TokenPrediction {
  /** Sous-token WordPiece (`##` pour une continuation). */
  token: string;
  span: Span | null;
  /** Étiquette BIO, ex. B-PER, I-LOC, O. */
  label: string;
  score: number;
}

interface Word {
  start: number;
  end: number;
  prefix: "B" | "I" | "O";
  tag: string;
  score: number;
}

/**
 * Agrégation au niveau du mot : un mot est une entité si l'un de ses sous-tokens l'est (on retient
 * l'étiquette la plus confiante), puis les mots consécutifs B/I de même type sont regroupés.
 * Le mot entier est remplacé, jamais une partie (cf. « Mühle|nstraße » dans le spike 0.2).
 */
export function aggregate(text: string, preds: readonly TokenPrediction[], threshold = NER_THRESHOLD): Detection[] {
  const words: Word[] = [];
  let current: { start: number; end: number; best: TokenPrediction | null } | null = null;
  const flush = () => {
    if (!current) return;
    const best = current.best;
    const [p, t] = best ? splitLabel(best.label) : (["O", "O"] as const);
    words.push({ start: current.start, end: current.end, prefix: p, tag: t, score: best?.score ?? 0 });
    current = null;
  };
  for (const pred of preds) {
    if (!pred.span) continue;
    const continuation = pred.token.startsWith("##") && current !== null;
    if (!continuation) flush();
    current ??= { start: pred.span.start, end: pred.span.end, best: null };
    current.end = pred.span.end;
    if (pred.label !== "O" && pred.score >= threshold && (!current.best || pred.score > current.best.score)) {
      current.best = pred;
    }
  }
  flush();

  const out: Detection[] = [];
  let open: { start: number; end: number; tag: string; scores: number[] } | null = null;
  const close = () => {
    if (open) {
      const type = TAGS[open.tag];
      const score = open.scores.reduce((a, b) => a + b, 0) / open.scores.length;
      if (type && score >= threshold) {
        out.push({
          start: open.start,
          end: open.end,
          text: text.slice(open.start, open.end),
          type,
          source: "ner",
          score,
        });
      }
    }
    open = null;
  };
  for (const w of words) {
    if (w.prefix === "O") {
      close();
      continue;
    }
    if (open && w.prefix === "I" && open.tag === w.tag && !/[\n\t]/.test(text.slice(open.end, w.start))) {
      open.end = w.end;
      open.scores.push(w.score);
    } else {
      close();
      open = { start: w.start, end: w.end, tag: w.tag, scores: [w.score] };
    }
  }
  close();
  return out;
}

function splitLabel(label: string): ["B" | "I", string] {
  const m = /^([BIES])-(.+)$/.exec(label);
  if (!m) return ["I", label];
  return [m[1] === "B" || m[1] === "S" ? "B" : "I", m[2] ?? label];
}

export interface Window {
  start: number;
  end: number;
  /** Zone dont les entités sont retenues (les bords des fenêtres se recouvrent). */
  coreStart: number;
  coreEnd: number;
}

/** Découpe en fenêtres de `size` mots avec `overlap` mots de recouvrement. */
export function makeWindows(text: string, size = 120, overlap = 30): Window[] {
  const words = [...text.matchAll(/\S+/g)].map((m) => ({ start: m.index, end: m.index + m[0].length }));
  if (words.length <= size) return [{ start: 0, end: text.length, coreStart: 0, coreEnd: text.length }];
  const step = size - overlap;
  const out: Window[] = [];
  for (let i = 0; ; i += step) {
    const last = i + size >= words.length;
    const first = words[i];
    const lastWord = words[Math.min(i + size, words.length) - 1];
    if (!first || !lastWord) break;
    const half = Math.floor(overlap / 2);
    out.push({
      start: first.start,
      end: lastWord.end,
      coreStart: i === 0 ? 0 : (words[i + half]?.start ?? first.start),
      coreEnd: last ? text.length : (words[i + step + half]?.start ?? lastWord.end),
    });
    if (last) break;
  }
  return out;
}

/**
 * Applique `run` sur chaque fenêtre et recompose les détections en coordonnées du texte complet.
 * `run` reçoit le texte de la fenêtre ; s'il lève `TooLong`, la fenêtre est redécoupée.
 */
export async function detectWindowed(
  text: string,
  run: (windowText: string) => Promise<Detection[]>,
  size = 120,
  overlap = 30,
): Promise<Detection[]> {
  const out = new Map<string, Detection>();
  for (const w of makeWindows(text, size, overlap)) {
    let found: Detection[];
    try {
      found = await run(text.slice(w.start, w.end));
    } catch (e) {
      if (e instanceof TooLong && size > 8) {
        found = await detectWindowed(text.slice(w.start, w.end), run, Math.floor(size / 2), Math.floor(overlap / 2));
      } else throw e;
    }
    for (const d of found) {
      const start = d.start + w.start;
      if (start < w.coreStart || start >= w.coreEnd) continue;
      const g = { ...d, start, end: d.end + w.start };
      const k = `${g.start}:${g.end}:${g.type}`;
      const prev = out.get(k);
      if (!prev || prev.score < g.score) out.set(k, g);
    }
  }
  return [...out.values()].sort((a, b) => a.start - b.start || b.end - a.end);
}

export class TooLong extends Error {}

// ---------------------------------------------------------------------------
// Implémentation transformers.js

type Device = "webgpu" | "wasm" | "cpu";

interface Tokenizer {
  (text: string, options?: { truncation?: boolean }): Record<string, unknown> & { input_ids: { dims: number[] } };
  tokenize(text: string, options?: { add_special_tokens?: boolean }): string[];
}

interface TokenClassifier {
  (inputs: Record<string, unknown>): Promise<{ logits: { dims: number[]; data: ArrayLike<number> } }>;
  config: { id2label: Record<string, string> };
}

interface RawProgress {
  status: string;
  file?: string;
  loaded?: number;
  total?: number;
}

const MAX_TOKENS = 512;

export class TransformersNerProvider implements NerProvider {
  readonly id = NER_PROVIDER_ID;
  device: Device | null = null;
  private tokenizer: Tokenizer | null = null;
  private classifier: TokenClassifier | null = null;

  constructor(
    readonly model = NER_MODEL,
    /** Backends à essayer dans l'ordre ; par défaut WebGPU si un adaptateur existe, puis WASM. */
    private readonly devices: readonly Device[] | null = null,
  ) {}

  async load(onProgress: (p: Progress) => void): Promise<void> {
    if (this.classifier) return;
    const tf = await import("@huggingface/transformers");
    tf.env.allowLocalModels = false;
    const devices = this.devices ?? (await availableDevices());
    if (!devices.includes("cpu")) {
      const { wasmPaths } = await import("./ortAssets.ts");
      const onnx = tf.env.backends.onnx as { wasm?: { wasmPaths?: unknown } };
      if (onnx.wasm) onnx.wasm.wasmPaths = wasmPaths(devices.includes("webgpu"));
    }
    const files = new Map<string, { loaded: number; total: number }>();
    const progress_callback = (raw: RawProgress) => {
      if (raw.status === "progress" && raw.file) {
        files.set(raw.file, { loaded: raw.loaded ?? 0, total: raw.total ?? 0 });
        let loaded = 0;
        let total = 0;
        for (const f of files.values()) {
          loaded += f.loaded;
          total += f.total;
        }
        onProgress({ status: "download", loaded, total, file: raw.file });
      }
    };
    this.tokenizer = await tf.AutoTokenizer.from_pretrained(this.model, {
      progress_callback,
    });
    let lastError: unknown = null;
    for (const device of devices) {
      try {
        this.classifier = (await tf.AutoModelForTokenClassification.from_pretrained(this.model, {
          dtype: "q8",
          device,
          progress_callback,
        } as never)) as unknown as TokenClassifier;
        onProgress({ status: "init" });
        // Inférence de contrôle : un backend peut se charger puis échouer à l'exécution.
        await this.runWindow("Paris");
        this.device = device;
        onProgress({ status: "ready" });
        return;
      } catch (e) {
        lastError = e;
        this.classifier = null;
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  async detect(text: string): Promise<Detection[]> {
    if (!/\p{L}/u.test(text)) return [];
    return detectWindowed(text, (w) => this.runWindow(w));
  }

  private async runWindow(text: string): Promise<Detection[]> {
    const { tokenizer, classifier: model } = this;
    if (!tokenizer || !model) throw new Error("Modèle NER non chargé");
    const tokens = tokenizer.tokenize(text, { add_special_tokens: true });
    if (tokens.length > MAX_TOKENS) throw new TooLong();
    const inputs = tokenizer(text, { truncation: false });
    const { logits } = await model(inputs);
    const [, seq = 0, nLabels = 0] = logits.dims;
    if (seq !== tokens.length) throw new Error(`Désalignement tokeniseur (${seq} ≠ ${tokens.length})`);
    const spans = alignTokens(text, tokens);
    const preds: TokenPrediction[] = tokens.map((token, i) => {
      const row = Array.from({ length: nLabels }, (_, j) => logits.data[i * nLabels + j] ?? 0);
      const max = Math.max(...row);
      const exps = row.map((x) => Math.exp(x - max));
      const sum = exps.reduce((a, b) => a + b, 0);
      const best = row.indexOf(max);
      return {
        token,
        span: spans[i] ?? null,
        label: model.config.id2label[best] ?? "O",
        score: (exps[best] ?? 0) / sum,
      };
    });
    return aggregate(text, preds);
  }
}

/**
 * WebGPU seulement si le navigateur fournit réellement un adaptateur (l'API peut exister sans GPU
 * utilisable) ; WASM mono-thread en repli. En Node (tests) : CPU.
 */
async function availableDevices(): Promise<Device[]> {
  const nav = (globalThis as { navigator?: { gpu?: { requestAdapter(): Promise<unknown> } } }).navigator;
  if (typeof window === "undefined" && typeof self === "undefined") return ["cpu"];
  const adapter = await nav?.gpu?.requestAdapter().catch(() => null);
  return adapter ? ["webgpu", "wasm"] : ["wasm"];
}
