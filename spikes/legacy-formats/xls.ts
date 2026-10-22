// Spike « formats hérités », piste .xls : lit chaque .xls de tests/real/legacy/ avec le lecteur BIFF8
// maison et compare cellule par cellule avec SheetJS (référence, chargé hors dépôt) si SHEETJS=<chemin
// du paquet xlsx décompressé> est fourni. Écrit aussi le .xlsx converti pour l'ouvrir dans LibreOffice.
// Usage : npm run legacy:xls
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { readXls, type XlsValue } from "./readers/biff.ts";
import { conversionWarnings, xlsToXlsx } from "./readers/xls.ts";
import { xlsxAdapter } from "../../src/adapters/xlsx.ts";

const DIR = join(import.meta.dirname, "../../tests/real/legacy");
const OUT = join(DIR, "out");
const require = createRequire(import.meta.url);
interface SheetJsCell {
  t: string;
  v: unknown;
}
interface SheetJs {
  read(data: Uint8Array, opts: object): { SheetNames: string[]; Sheets: Record<string, Record<string, SheetJsCell>> };
  utils: { encode_cell(c: { r: number; c: number }): string };
}
const X = process.env.SHEETJS ? (require(join(process.env.SHEETJS, "xlsx.js")) as SheetJs) : null;

const same = (a: XlsValue, b: SheetJsCell | undefined): boolean => {
  if (!b) return a.t === "s" && a.v === "";
  if (a.t === "n") return b.t === "n" && Math.abs((b.v as number) - a.v) < 1e-9;
  if (a.t === "e") return b.t === "e";
  return a.v === b.v;
};

mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(DIR).filter((n) => n.endsWith(".xls"))) {
  const buf = readFileSync(join(DIR, f));
  const t0 = performance.now();
  const wb = readXls(new Uint8Array(buf));
  const xlsx = await xlsToXlsx(wb);
  const t1 = performance.now();
  const doc = await xlsxAdapter.read(xlsx, { columns: ["Nom", "Prénom"] });
  writeFileSync(join(OUT, f.replace(/\.xls$/, ".converted.xlsx")), new Uint8Array(xlsx));
  const cells = wb.sheets.reduce((n, s) => n + s.cells.length, 0);
  console.log(
    `${f}: ${String(buf.length)} o, ${wb.sheets.length} feuilles, ${cells} cellules, ${doc.segments.length} segments, ` +
      `${doc.segments.filter((s) => s.wholeCell).length} cellules « colonnes », ${(t1 - t0).toFixed(0)} ms`,
  );
  for (const w of conversionWarnings(wb)) console.log(`  ! ${w}`);
  if (!X) continue;
  const ref = X.read(new Uint8Array(buf), { type: "array", cellFormula: false });
  let ok = 0;
  const diffs: string[] = [];
  for (const s of wb.sheets) {
    const sheet = ref.Sheets[s.name] ?? {};
    for (const c of s.cells) {
      const addr = X.utils.encode_cell({ r: c.row, c: c.col });
      if (same(c.value, sheet[addr])) ok++;
      else diffs.push(`${s.name}!${addr}: ${JSON.stringify(c.value)} ≠ ${JSON.stringify(sheet[addr])}`);
    }
    const refCount = Object.keys(sheet).filter((k) => !k.startsWith("!") && sheet[k]?.t !== "z").length;
    const mine = s.cells.length;
    if (refCount !== mine) diffs.push(`${s.name}: ${mine} cellules lues, ${refCount} pour SheetJS`);
  }
  console.log(
    `  SheetJS : ${ok}/${cells} cellules identiques${diffs.length ? `, écarts :\n    ${diffs.slice(0, 10).join("\n    ")}` : ""}`,
  );
}
