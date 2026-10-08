// Anonymise puis restaure chaque fixture Office et écrit les résultats dans un dossier,
// pour un contrôle d'ouverture par LibreOffice (CI) ou à la main.
// Usage : npx tsx scripts/export-samples.ts <dossier>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { anonymize, restore, type PipelineContext } from "../src/worker/pipeline.ts";

const out = process.argv[2] ?? "samples-out";
mkdirSync(out, { recursive: true });
const FIX = join(import.meta.dirname, "../tests/fixtures");
const names = readFileSync(join(FIX, "fixture-names.txt"), "utf8");
const ctx: PipelineContext = { progress: () => undefined, checkCancelled: () => undefined };

for (const name of ["sample.docx", "sample.pptx", "sample.xlsx"]) {
  const b = readFileSync(join(FIX, name));
  const file = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
  let anon;
  try {
    anon = await anonymize({ file, fileName: name, names, ner: false, columns: ["Nom", "Prénom"], mapping: null }, ctx);
  } catch (e) {
    console.warn(`${name} : ignoré (${e instanceof Error ? e.message : String(e)})`);
    continue;
  }
  writeFileSync(join(out, anon.document.name), new Uint8Array(anon.document.data));
  const restored = await restore(
    { file: anon.document.data, fileName: anon.document.name, mapping: new TextDecoder().decode(anon.mapping.data) },
    ctx,
  );
  writeFileSync(join(out, restored.document.name), new Uint8Array(restored.document.data));
  console.log(`${name} → ${anon.document.name}, ${restored.document.name}`);
}
