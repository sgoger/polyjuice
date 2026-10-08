// Utilitaires de test pour les adaptateurs OOXML.
import JSZip from "jszip";

export async function parts(buf: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const zip = await JSZip.loadAsync(buf);
  const out = new Map<string, Uint8Array>();
  for (const f of Object.values(zip.files)) if (!f.dir) out.set(f.name, await f.async("uint8array"));
  return out;
}

export async function partText(buf: ArrayBuffer, name: string): Promise<string> {
  const f = (await JSZip.loadAsync(buf)).file(name);
  if (!f) throw new Error(`partie absente : ${name}`);
  return f.async("string");
}

/** Parties qui diffèrent (contenu décompressé) entre deux paquets. */
export async function changedParts(a: ArrayBuffer, b: ArrayBuffer): Promise<string[]> {
  const pa = await parts(a);
  const pb = await parts(b);
  const names = new Set([...pa.keys(), ...pb.keys()]);
  return [...names].filter((n) => {
    const x = pa.get(n);
    const y = pb.get(n);
    return !x || !y || x.length !== y.length || x.some((v, i) => v !== y[i]);
  });
}

const unescapeXml = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

/** Texte brut (nœuds texte) de toutes les parties XML, hors parties exclues. */
export async function allXmlText(buf: ArrayBuffer, exclude: (name: string) => boolean = () => false): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  let out = "";
  for (const f of Object.values(zip.files)) {
    if (f.dir || !/\.(xml|rels)$/.test(f.name) || exclude(f.name)) continue;
    const xml = await f.async("string");
    out += unescapeXml(xml.replace(/<[^>]+>/g, "\u0001")) + "\n";
  }
  return out;
}

/**
 * Simule un outil de traduction : chaque token ⟦…⟧ d'un élément texte est découpé sur trois runs
 * de mises en forme différentes.
 */
export async function splitTokensAcrossRuns(
  buf: ArrayBuffer,
  partNames: RegExp,
  prefix: "w" | "a",
): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(buf);
  const rPr = (b: string) => (prefix === "w" ? `<w:rPr><w:${b}/></w:rPr>` : `<a:rPr lang="fr-FR" ${b}="1"/>`);
  const t = (s: string) => `<${prefix}:t xml:space="preserve">${s}</${prefix}:t>`;
  const re = new RegExp(`<${prefix}:t([^>]*)>([^<]*?)(⟦[A-Z]-[A-Z0-9]{5}\\d*⟧)([^<]*)</${prefix}:t>`, "u");
  for (const f of Object.values(zip.files)) {
    if (f.dir || !partNames.test(f.name)) continue;
    let xml = await f.async("string");
    for (let m = re.exec(xml); m; m = re.exec(xml)) {
      const [all, attrs = "", pre = "", tok = "", post = ""] = m;
      const close = `</${prefix}:r><${prefix}:r>`;
      const replacement =
        `<${prefix}:t${attrs}>${pre}${tok.slice(0, 3)}</${prefix}:t>${close}${rPr("b")}${t(tok.slice(3, 6))}` +
        `${close}${rPr("i")}${t(tok.slice(6) + post)}`;
      xml = xml.slice(0, m.index) + replacement + xml.slice(m.index + all.length);
    }
    zip.file(f.name, xml);
  }
  return zip.generateAsync({ type: "arraybuffer" });
}
