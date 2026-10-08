// Utilitaires de test partagés.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { adapterFor } from "../../src/adapters/index.ts";
import type { Doc } from "../../src/engine/types.ts";
import { anonymize, restore, type PipelineContext } from "../../src/worker/pipeline.ts";
import type { AnonymizeResult } from "../../src/worker/protocol.ts";

export const FIXTURES = join(import.meta.dirname, "../fixtures");

export interface ExpectedEntity {
  text: string;
  type: string;
  kind: string;
}

export const expected = JSON.parse(readFileSync(join(FIXTURES, "expected.json"), "utf8")) as {
  names: string[];
  columns: string[];
  protected: { md: string[] };
  fixtures: Record<string, ExpectedEntity[]>;
};

export const NAMES = readFileSync(join(FIXTURES, "fixture-names.txt"), "utf8");

export function fixture(name: string): ArrayBuffer {
  const b = readFileSync(join(FIXTURES, name));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
}

export const ctx: PipelineContext = { progress: () => undefined, checkCancelled: () => undefined };

export async function readDoc(fileName: string, file: ArrayBuffer, columns?: string[]): Promise<Doc> {
  const found = adapterFor(fileName);
  if (!found) throw new Error(`pas d'adaptateur pour ${fileName}`);
  return found.adapter.read(file, columns ? { columns } : undefined);
}

export async function anonymizeFixture(name: string, extra: { columns?: string[]; mapping?: string } = {}) {
  return anonymize(
    {
      file: fixture(name),
      fileName: name,
      names: NAMES,
      ner: false,
      columns: extra.columns ?? [],
      mapping: extra.mapping ?? null,
    },
    ctx,
  );
}

/** Anonymise puis restaure ; renvoie les deux résultats. */
export async function roundTrip(name: string, extra: { columns?: string[] } = {}) {
  const anon: AnonymizeResult = await anonymizeFixture(name, extra);
  const mapping = new TextDecoder().decode(anon.mapping.data);
  const restored = await restore({ file: anon.document.data.slice(0), fileName: anon.document.name, mapping }, ctx);
  return { anon, restored, mapping };
}

export const text = (b: ArrayBuffer): string => new TextDecoder().decode(b);
