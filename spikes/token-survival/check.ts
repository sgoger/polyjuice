// Usage : tsx token-survival/check.ts <fichier traduit .docx|.md|.txt>
// Classe chaque occurrence attendue : intacte / déformée / absente. Code 0 si 100 % intactes.
import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import { TOKENS } from "./sentences.ts";

const path = process.argv[2];
if (!path) {
  console.error("Usage : check.ts <fichier traduit>");
  process.exit(2);
}
const expected = JSON.parse(
  await readFile(new URL("./out/token_survival.expected.json", import.meta.url), "utf8"),
) as Record<string, number>;

async function extractText(p: string): Promise<string> {
  const buf = await readFile(p);
  if (!p.endsWith(".docx")) return buf.toString("utf8");
  const zip = await JSZip.loadAsync(buf);
  const parts = Object.keys(zip.files).filter((n) => /^word\/(document|footnotes|endnotes|header\d*|footer\d*)\.xml$/.test(n));
  let text = "";
  for (const name of parts) {
    const xml = await zip.file(name)!.async("string");
    // Concatène les w:t par paragraphe (les tokens peuvent être coupés sur plusieurs runs).
    for (const p of xml.split(/<\/w:p>/)) {
      text += [...p.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join("") + "\n";
    }
  }
  return text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

const text = await extractText(path);
const STRICT = /⟦[A-Z]-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}\d*⟧/gu;
// Permissive : crochets de toute sorte, espaces, tirets typographiques, casse.
const LOOSE = /[⟦\[【〚«(]\s*([A-Za-z])\s*[-‐‑–—_]?\s*([A-Za-z0-9]{5})\s*[⟧\]】〛»)]/gu;

let failures = 0;
for (const token of TOKENS) {
  const want = expected[token] ?? 0;
  const intact = text.split(token).length - 1;
  const [, letter, code] = /^⟦(.)-(.{5})⟧$/u.exec(token)!;
  const deformed = [...text.matchAll(LOOSE)].filter(
    (m) => m[0] !== token && m[1]!.toUpperCase() === letter && m[2]!.toUpperCase() === code,
  );
  const missing = Math.max(0, want - intact - deformed.length);
  if (intact !== want) failures++;
  console.log(`${token}  attendu ${want}  intacts ${intact}  déformés ${deformed.length}  absents ${missing}`);
  for (const d of deformed) console.log(`    déformé : ${JSON.stringify(d[0])}`);
}
const unknown = [...text.matchAll(STRICT)].map((m) => m[0]).filter((t) => !(TOKENS as readonly string[]).includes(t));
if (unknown.length) console.log("Tokens inconnus :", unknown);
const total = Object.values(expected).reduce((a, b) => a + b, 0);
console.log(failures === 0 ? `OK : ${total}/${total} intacts` : "ÉCHEC : tokens non intacts");
process.exit(failures === 0 && unknown.length === 0 ? 0 : 1);
