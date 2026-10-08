// Calibration sur documents réels (phase 6.2). Les documents, mappings et annotations restent hors du
// dépôt (tests/real/ est ignoré par git).
//
// Usage : npx tsx scripts/calibrate.ts <dossier>
//
// Le dossier contient :
//   - les mappings JSON produits par « Anonymiser » (avec et/ou sans NER) ;
//   - annotations.csv (facultatif), saisi à la main après lecture des documents anonymisés :
//       document;type;erreur;source;texte
//       rapport.docx;PERSON;FN;;Mme Lefèvre          ← faux négatif : resté en clair
//       rapport.docx;LOCATION;FP;ner;Conseil         ← faux positif : remplacé à tort
//     `erreur` vaut FP ou FN ; `source` (ner | regex | names | columns) n'a de sens que pour un FP.
//     Le texte n'est pas affiché par ce script.
//
// Sortie : volume de détections par document, type et source ; FP/FN par type et par source ;
// précision estimée (1 − FP / détections) par source et par type. Rien n'est écrit sur disque.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseMapping, type Mapping } from "../src/engine/mapping.ts";
import { ENTITY_TYPES } from "../src/engine/types.ts";

const dir = process.argv[2];
if (!dir) {
  console.error("Usage : npx tsx scripts/calibrate.ts <dossier>");
  process.exit(2);
}

interface Annotation {
  document: string;
  type: string;
  error: "FP" | "FN";
  source: string;
}

const files = readdirSync(dir);
const mappings: Mapping[] = [];
for (const f of files.filter((n) => n.endsWith(".json"))) {
  try {
    mappings.push(parseMapping(readFileSync(join(dir, f), "utf8")));
  } catch (e) {
    console.warn(`${f} ignoré : ${e instanceof Error ? e.message : String(e)}`);
  }
}

const annotations: Annotation[] = [];
if (files.includes("annotations.csv")) {
  const lines = readFileSync(join(dir, "annotations.csv"), "utf8").split(/\r?\n/).slice(1);
  for (const [i, line] of lines.entries()) {
    if (!line.trim()) continue;
    const [document = "", type = "", error = "", source = ""] = line.split(";").map((c) => c.trim());
    if (error !== "FP" && error !== "FN") {
      console.warn(`annotations.csv ligne ${i + 2} : erreur « ${error} » (attendu FP ou FN)`);
      continue;
    }
    annotations.push({ document, type, error, source });
  }
}

// Détections (occurrences) par document, type et source.
type Counts = Record<string, number>;
const bump = (c: Counts, k: string, n = 1) => (c[k] = (c[k] ?? 0) + n);
const detectedBySource: Counts = {};
const detectedByType: Counts = {};
console.log(`\n${mappings.length} mapping(s)\n`);
console.log("document | NER | entités distinctes | occurrences | par source");
console.log("---|---|---:|---:|---");
for (const m of mappings) {
  const bySource: Counts = {};
  let occ = 0;
  for (const e of Object.values(m.entities)) {
    bump(bySource, e.source, e.occurrences);
    bump(detectedBySource, e.source, e.occurrences);
    bump(detectedByType, e.type, e.occurrences);
    occ += e.occurrences;
  }
  const detail = Object.entries(bySource)
    .map(([k, v]) => `${k} ${v}`)
    .join(", ");
  console.log(
    `${m.source.name} | ${m.ner.enabled ? "oui" : "non"} | ${Object.keys(m.entities).length} | ${occ} | ${detail}`,
  );
}

const fp = annotations.filter((a) => a.error === "FP");
const fn = annotations.filter((a) => a.error === "FN");
console.log(`\nAnnotations : ${fp.length} faux positif(s), ${fn.length} faux négatif(s)\n`);

console.log("source | détections | FP | précision estimée");
console.log("---|---:|---:|---:");
for (const [source, n] of Object.entries(detectedBySource)) {
  const f = fp.filter((a) => a.source === source).length;
  console.log(`${source} | ${n} | ${f} | ${n ? ((1 - f / n) * 100).toFixed(1) + " %" : "—"}`);
}

console.log("\ntype | détections | FP | FN");
console.log("---|---:|---:|---:");
for (const t of ENTITY_TYPES) {
  const n = detectedByType[t] ?? 0;
  const f = fp.filter((a) => a.type === t).length;
  const m = fn.filter((a) => a.type === t).length;
  if (n || f || m) console.log(`${t} | ${n} | ${f} | ${m}`);
}

const withNer = mappings.filter((m) => m.ner.enabled).length;
console.log(
  `\nÀ reporter dans docs/DEVIATIONS.md (calibration) : seuil NER, regex ajustées, modèle retenu ; ` +
    `${withNer} document(s) traités avec NER, ${mappings.length - withNer} sans.`,
);
