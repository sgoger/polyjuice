// Spike « formats hérités », pistes .doc et .ppt : extrait le texte de chaque .doc / .ppt de
// tests/real/legacy/ et mesure sa couverture par rapport au document OOXML source (segments lus par les
// adaptateurs de polyjuice) : part des segments source retrouvés tels quels dans le texte extrait.
// Usage : npm run legacy:text
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { adapterFor } from "../../src/adapters/index.ts";
import { readPowerPoint } from "./readers/powerpoint.ts";
import { readWord } from "./readers/word.ts";

const DIR = join(import.meta.dirname, "../../tests/real/legacy");
const norm = (s: string) => s.replace(/\s+/g, " ").trim();
const ab = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

for (const f of readdirSync(DIR).filter((n) => /\.(doc|ppt)$/.test(n))) {
  const buf = readFileSync(join(DIR, f));
  const t0 = performance.now();
  let extracted: string;
  let info = "";
  if (f.endsWith(".doc")) {
    const w = readWord(new Uint8Array(buf));
    extracted = w.stories.map((s) => s.text).join("\n");
    info = `${w.stories.map((s) => `${s.story} ${s.text.length}`).join(", ")}, ${w.deleted} car. supprimés écartés`;
  } else {
    const p = readPowerPoint(new Uint8Array(buf));
    extracted = p.slides.map((t) => t.join("\n")).join("\n");
    const order = p.slides.every(
      (s, i) => !/^Diapositive \d+/.test(s[0] ?? "") || s[0]?.startsWith(`Diapositive ${i + 1} `),
    );
    info = `${p.slides.length} diapositives, ${p.slides.flat().length} blocs, ordre ${order ? "conforme" : "NON conforme"}`;
  }
  const ms = performance.now() - t0;
  const source = f.replace(/\.doc$/, ".docx").replace(/\.ppt$/, ".pptx");
  const src = readFileSync(join(DIR, "src", source));
  const found = adapterFor(source);
  if (!found) continue;
  const doc = await found.adapter.read(ab(src));
  const hay = norm(extracted);
  const segs = doc.segments.map((s) => norm(s.text)).filter(Boolean);
  const missing = segs.filter((s) => !hay.includes(s));
  console.log(`${f}: ${String(buf.length)} o, ${ms.toFixed(0)} ms, ${info}`);
  console.log(`  segments source retrouvés : ${segs.length - missing.length}/${segs.length}`);
  for (const m of missing.slice(0, 8)) console.log(`  - manquant : ${m.slice(0, 100)}`);
}
