// Spike 0.3 : réécriture OOXML sans perte (JSZip + DOMParser/XMLSerializer).
// Usage : npm run ooxml  (après `uv run ooxml-roundtrip/py_inputs.py out` pour les gabarits Microsoft)
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import JSZip from "jszip";
import { chromium, firefox, webkit } from "playwright";
import { makeDocx, makePptx, makeXlsx } from "./inputs.ts";
import { readCentralDirectory } from "./zipdir.ts";

const OUT = new URL("../out/", import.meta.url);
await mkdir(OUT, { recursive: true });

interface Case {
  name: string;
  buf: Uint8Array;
  part: string;
  textTag: string; // élément texte à modifier
  needle: string;
}

const cases: Case[] = [
  { name: "lib.docx", buf: await makeDocx(), part: "word/document.xml", textTag: "w:t", needle: "Kowalski" },
  { name: "lib.pptx", buf: await makePptx(), part: "ppt/slides/slide1.xml", textTag: "a:t", needle: "Kowalski" },
  { name: "lib.xlsx", buf: await makeXlsx(), part: "xl/sharedStrings.xml", textTag: "t", needle: "Dupont" },
];
for (const [file, part, tag, needle] of [
  ["word.docx", "word/document.xml", "w:t", "Kowalski"],
  ["ppt.pptx", "ppt/slides/slide1.xml", "a:t", "Kowalski"],
] as const) {
  const p = new URL(file, OUT);
  if (existsSync(p)) cases.push({ name: `ms-${file}`, buf: await readFile(p), part, textTag: tag, needle });
  else console.warn(`(absent : ${file} — lancer py_inputs.py)`);
}

const REPLACEMENT = " ⟦P-K7M2X⟧ & <x> \"q\" ";
const xmlStrings: Record<string, string> = {};

function firstDiff(a: string, b: string): string {
  if (a === b) return "identique";
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  return `diffère à ${i} : avant ${JSON.stringify(a.slice(Math.max(0, i - 40), i + 60))} / après ${JSON.stringify(b.slice(Math.max(0, i - 40), i + 60))}`;
}

const eq = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);

for (const c of cases) {
  console.log(`\n=== ${c.name} (${c.part})`);
  const zip = await JSZip.loadAsync(c.buf);
  const before = readCentralDirectory(c.buf);
  const xml = await zip.file(c.part)!.async("string");
  xmlStrings[c.name] = xml;

  // 1. parse → serialize sans modification
  const decl = /^<\?xml[^?]*\?>\r?\n?/.exec(xml)?.[0] ?? "";
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const plain = new XMLSerializer().serializeToString(doc);
  console.log(`déclaration d'origine : ${JSON.stringify(decl)}`);
  console.log(`déclaration après sérialisation xmldom : ${plain.startsWith("<?xml") ? "conservée" : "PERDUE"}`);
  console.log(`parse→serialize sans modification (xmldom) : ${firstDiff(xml, plain)}`);
  console.log(`CRLF dans la partie : ${xml.includes("\r\n")}`);

  // 2. modification d'un seul nœud texte
  const ts = Array.from(doc.getElementsByTagName(c.textTag));
  const target = ts.find((t) => (t.textContent ?? "").includes(c.needle));
  if (!target) throw new Error(`${c.needle} introuvable`);
  while (target.firstChild) target.removeChild(target.firstChild);
  target.appendChild(doc.createTextNode(REPLACEMENT));
  target.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
  let out = new XMLSerializer().serializeToString(doc);
  if (!out.startsWith("<?xml")) out = decl + out;
  const rootOpen = (s: string) => /<[^?!][^>]*>/.exec(s.replace(/^<\?xml[^?]*\?>/, ""))![0];
  console.log(`balise racine (namespaces, mc:Ignorable) : ${rootOpen(xml) === rootOpen(out) ? "identique" : "MODIFIÉE"}`);
  console.log(`mc:Ignorable présent : avant ${xml.includes("mc:Ignorable")} / après ${out.includes("mc:Ignorable")}`);
  console.log(`extrait modifié : ${/<[^>]*>[^<]*⟦P-K7M2X⟧[^<]*<\/[^>]*>/.exec(out)?.[0]}`);

  // 3a. ré-emballage JSZip naïf
  zip.file(c.part, out, { createFolders: false });
  const naive = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  // 3b. ré-emballage en restaurant la méthode de compression d'origine de chaque entrée
  const zip2 = await JSZip.loadAsync(c.buf, { createFolders: false });
  // Méthode d'origine lue dans le répertoire central (API publique ZipObject.options).
  for (const e of before) {
    const f = zip2.files[e.name];
    if (f) (f as unknown as { options: { compression: string } }).options.compression = e.method === 8 ? "DEFLATE" : "STORE";
  }
  zip2.file(c.part, out, { compression: "DEFLATE", createFolders: false });
  const kept = await zip2.generateAsync({ type: "uint8array" });

  for (const [label, buf] of [["naïf", naive], ["méthode conservée", kept]] as const) {
    const after = readCentralDirectory(buf);
    const order = before.map((e) => e.name).join("|") === after.map((e) => e.name).join("|");
    if (!order) {
      const i = before.findIndex((e, j) => e.name !== after[j]?.name);
      console.log(`  premier écart à l'entrée ${i} : avant ${before[i]?.name} / après ${after[i]?.name} (${before.length} → ${after.length} entrées)`);
    }
    let sameContent = 0, sameRaw = 0, sameMethod = 0, others = 0;
    const reloaded = await JSZip.loadAsync(buf);
    for (const e of before) {
      if (e.name === c.part || e.name.endsWith("/")) continue;
      others++;
      const a = after.find((x) => x.name === e.name)!;
      const orig = await zip2.file(e.name)!.async("uint8array");
      const now = await reloaded.file(e.name)!.async("uint8array");
      if (eq(orig, now)) sameContent++;
      if (eq(e.raw, a.raw)) sameRaw++;
      if (e.method === a.method) sameMethod++;
    }
    console.log(
      `[${label}] ordre ${order ? "conservé" : "MODIFIÉ"} ; autres parties : contenu identique ${sameContent}/${others}, méthode identique ${sameMethod}/${others}, octets compressés identiques ${sameRaw}/${others}`,
    );
  }
  await writeFile(new URL(`roundtrip-${c.name}`, OUT), kept);
}

// 4. Comparaison navigateur (DOMParser/XMLSerializer natifs) vs xmldom.
for (const bt of [chromium, firefox, webkit]) {
  let browser;
  try {
    browser = await bt.launch();
  } catch (e) {
    console.log(`\n[${bt.name()}] indisponible : ${(e as Error).message.split("\n")[0]}`);
    continue;
  }
  const page = await browser.newPage();
  const results = await page.evaluate((xs: Record<string, string>) => {
    const r: Record<string, string> = {};
    for (const [k, x] of Object.entries(xs)) {
      r[k] = new XMLSerializer().serializeToString(new DOMParser().parseFromString(x, "application/xml"));
    }
    return r;
  }, xmlStrings);
  console.log(`\n[${bt.name()} ${browser.version()}]`);
  for (const [k, s] of Object.entries(results)) {
    const xd = new XMLSerializer().serializeToString(new DOMParser().parseFromString(xmlStrings[k]!, "text/xml"));
    const strip = (x: string) => x.replace(/^<\?xml[^?]*\?>\s*/, "");
    console.log(`  ${k} : déclaration ${s.startsWith("<?xml") ? JSON.stringify(/^<\?xml[^?]*\?>\s*/.exec(s)?.[0]) : "perdue"}`);
    console.log(`    corps vs original : ${firstDiff(strip(xmlStrings[k]!), strip(s))}`);
    console.log(`    corps vs xmldom : ${firstDiff(strip(xd), strip(s))}`);
    const nsDecls = (x: string) => [...x.matchAll(/xmlns(?::[\w.-]+)?="[^"]*"/g)].map((m) => m[0]).sort().join(" ");
    console.log(`    déclarations xmlns (multiensemble) : ${nsDecls(xmlStrings[k]!.replace(/'/g, '"')) === nsDecls(s) ? "identiques" : "DIFFÉRENTES"}`);
    const attrs = (x: string) => [...x.matchAll(/\s([\w:.-]+)="/g)].length;
    console.log(`    nombre d'attributs : ${attrs(xmlStrings[k]!.replace(/'/g, '"'))} → ${attrs(s)}`);
  }
  await browser.close();
}
