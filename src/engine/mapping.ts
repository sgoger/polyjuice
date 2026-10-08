// Modèle du mapping JSON : création, réutilisation, validation (zod) et sérialisation stable.
import { z } from "zod";
import { EngineError } from "../worker/protocol.ts";
import { deriveToken, isToken, TYPE_LETTERS, withSuffix } from "./tokens.ts";
import {
  DETECTION_SOURCES,
  ENTITY_TYPES,
  FORMATS,
  type DetectionSource,
  type EntityType,
  type Format,
} from "./types.ts";

export const POLYJUICE_VERSION = "0.1.0";
export const SCHEMA_VERSION = 1;
export const SALT_BYTES = 16;

const EntitySchema = z
  .object({
    original: z.string().min(1),
    type: z.enum(ENTITY_TYPES),
    occurrences: z.number().int().nonnegative(),
    source: z.enum(DETECTION_SOURCES),
    /** Présent quand le token porte un suffixe de collision. */
    collision: z.literal(true).optional(),
  })
  .strict();

const base64 = /^[A-Za-z0-9+/]+={0,2}$/;

export const MappingSchema = z
  .object({
    polyjuice_version: z.string(),
    schema_version: z.literal(SCHEMA_VERSION),
    created_at: z.string(),
    source: z
      .object({ name: z.string(), sha256: z.string().regex(/^[0-9a-f]{64}$/), format: z.enum(FORMATS) })
      .strict(),
    salt: z
      .string()
      .regex(base64)
      .refine((s) => fromBase64(s).length === SALT_BYTES, `le salt doit faire ${SALT_BYTES} octets`),
    ner: z.object({ enabled: z.boolean(), provider: z.string().nullable(), model: z.string().nullable() }).strict(),
    entities: z.record(z.string(), EntitySchema).superRefine((entities, ctx) => {
      for (const [token, e] of Object.entries(entities)) {
        if (!isToken(token)) ctx.addIssue({ code: "custom", message: `token invalide : ${token}`, path: [token] });
        else if (token[1] !== TYPE_LETTERS[e.type])
          ctx.addIssue({
            code: "custom",
            message: `lettre du token incohérente avec le type ${e.type}`,
            path: [token],
          });
      }
    }),
    warnings: z.array(z.string()),
  })
  .strict();

export type Mapping = z.infer<typeof MappingSchema>;
export type MappingEntity = z.infer<typeof EntitySchema>;

export interface SourceInfo {
  name: string;
  sha256: string;
  format: Format;
}

export interface NerInfo {
  enabled: boolean;
  provider: string | null;
  model: string | null;
}

// ---------------------------------------------------------------------------

export function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function fromBase64(s: string): Uint8Array {
  const bin = atob(s);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Date ISO 8601 avec le décalage horaire local, ex. 2026-10-09T10:12:00+02:00. */
export function localIsoDate(d = new Date()): string {
  const pad = (n: number) => String(Math.abs(n)).padStart(2, "0");
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.trunc(off / 60))}:${pad(off % 60)}`
  );
}

/** Valide un mapping JSON importé. Lève une EngineError `InvalidMapping` explicite. */
export function parseMapping(json: string): Mapping {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new EngineError("InvalidMapping", "Le mapping n'est pas un fichier JSON valide.");
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new EngineError("InvalidMapping", "Le mapping doit être un objet JSON.");
  }
  const version = (raw as Record<string, unknown>).schema_version;
  if (version !== SCHEMA_VERSION) {
    throw new EngineError(
      "InvalidMapping",
      version === undefined
        ? "Ce fichier n'est pas un mapping polyjuice (champ schema_version absent)."
        : `Version de schéma du mapping inconnue : ${JSON.stringify(version)} (cette version de polyjuice lit la version ${SCHEMA_VERSION}).`,
    );
  }
  const parsed = MappingSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".") || "(racine)"} : ${i.message}`)
      .join(" ; ");
    throw new EngineError("InvalidMapping", `Mapping invalide — ${issues}`);
  }
  return parsed.data;
}

/** Sérialisation stable : clés triées récursivement, indentation de 2, saut de ligne final. */
export function serializeMapping(m: Mapping): string {
  return JSON.stringify(sortKeys(m), null, 2) + "\n";
}

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.keys(v)
        .sort()
        .map((k) => [k, sortKeys((v as Record<string, unknown>)[k])]),
    );
  }
  return v;
}

// ---------------------------------------------------------------------------

/**
 * Mapping en cours de construction. Les occurrences sont celles du document traité : une entité
 * reprise d'un mapping existant et absente du document garde son ancien compteur.
 */
export class MappingStore {
  private readonly byOriginal = new Map<string, string>();
  private readonly runCounts = new Map<string, number>();
  private readonly salt: Uint8Array;

  private constructor(private readonly mapping: Mapping) {
    this.salt = fromBase64(mapping.salt);
    for (const [token, e] of Object.entries(mapping.entities)) this.byOriginal.set(key(e.type, e.original), token);
  }

  static create(source: SourceInfo, ner: NerInfo, now = new Date()): MappingStore {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    return new MappingStore({
      polyjuice_version: POLYJUICE_VERSION,
      schema_version: SCHEMA_VERSION,
      created_at: localIsoDate(now),
      source,
      salt: toBase64(salt),
      ner,
      entities: {},
      warnings: [],
    });
  }

  /** Reprend un mapping existant : salt et entités conservés, le mapping est complété. */
  static reuse(existing: Mapping, source: SourceInfo, ner: NerInfo): MappingStore {
    return new MappingStore({
      ...structuredClone(existing),
      polyjuice_version: POLYJUICE_VERSION,
      source,
      ner,
    });
  }

  /** Token de l'entité ; le crée si besoin. Compte une occurrence. */
  async getOrCreateToken(type: EntityType, original: string, source: DetectionSource): Promise<string> {
    const k = key(type, original);
    let token = this.byOriginal.get(k);
    if (!token) {
      const base = await deriveToken(this.salt, type, original);
      token = base;
      let n = 2;
      while (token in this.mapping.entities) token = withSuffix(base, n++);
      this.mapping.entities[token] = {
        original,
        type,
        occurrences: 0,
        source,
        ...(token === base ? {} : { collision: true as const }),
      };
      this.byOriginal.set(k, token);
    }
    this.runCounts.set(token, (this.runCounts.get(token) ?? 0) + 1);
    return token;
  }

  setWarnings(warnings: readonly string[]): void {
    this.mapping.warnings = [...warnings];
  }

  /** Mapping final, occurrences mises à jour. */
  toMapping(): Mapping {
    const m = structuredClone(this.mapping);
    for (const [token, count] of this.runCounts) {
      const e = m.entities[token];
      if (e) e.occurrences = count;
    }
    return m;
  }
}

const key = (type: EntityType, original: string) => `${type}\0${original}`;
