// Contrôle indépendant des PDF anonymisés écrits par export-samples.ts : texte extrait par pdftotext
// (poppler), qui ne doit contenir aucune valeur attendue de la fixture et doit contenir chaque token.
// Usage : npx tsx scripts/check-pdf-samples.ts <dossier>
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2] ?? "samples-out";
const expected = JSON.parse(readFileSync(join(import.meta.dirname, "../tests/fixtures/expected.json"), "utf8")) as {
  fixtures: Record<string, { text: string }[]>;
};
const flat = (s: string) => s.normalize("NFKC").replace(/\s+/g, "");

let failures = 0;
const pdfs = readdirSync(dir).filter((f) => f.endsWith(".anonymise.pdf"));
if (pdfs.length === 0) throw new Error(`aucun PDF anonymisé dans ${dir}`);
for (const pdf of pdfs) {
  const base = pdf.replace(/\.anonymise\.pdf$/, "");
  const text = execFileSync("pdftotext", ["-enc", "UTF-8", join(dir, pdf), "-"], { encoding: "utf8" });
  const mapping = JSON.parse(readFileSync(join(dir, `${base}.json`), "utf8")) as { entities: Record<string, unknown> };
  const left = (expected.fixtures[`${base}.pdf`] ?? []).filter((e) => flat(text).includes(flat(e.text)));
  const missing = Object.keys(mapping.entities).filter((t) => !text.includes(t));
  if (left.length || missing.length) failures++;
  console.log(`${pdf} : ${left.length} valeur(s) restante(s), ${missing.length} token(s) illisible(s)`);
}
process.exit(failures ? 1 : 0);
