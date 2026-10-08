import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { applyEdits, collect, DRAWING, WORD } from "../../src/adapters/ooxml/runs.ts";
import { centralDirectory, OoxmlPackage } from "../../src/adapters/ooxml/zip.ts";
import { elementsNS, NS, parseXml, serializeXml } from "../../src/adapters/ooxml/xml.ts";
import { fixture } from "./helpers.ts";

/** Octets compressés bruts de chaque entrée, via le répertoire central. */
function rawEntries(buf: ArrayBuffer): Map<string, Uint8Array> {
  const b = new Uint8Array(buf);
  const dv = new DataView(buf);
  let eocd = b.length - 22;
  while (dv.getUint32(eocd, true) !== 0x06054b50) eocd--;
  let p = dv.getUint32(eocd + 16, true);
  const out = new Map<string, Uint8Array>();
  for (let i = 0; i < dv.getUint16(eocd + 10, true); i++) {
    const csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true);
    const lho = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nlen));
    const start = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true);
    out.set(name, b.subarray(start, start + csize));
    p += 46 + nlen + dv.getUint16(p + 30, true) + dv.getUint16(p + 32, true);
  }
  return out;
}

describe("ooxml/zip", () => {
  it.each(["sample.docx", "sample.pptx", "sample.xlsx"])(
    "réécriture sans modification de %s : octets identiques",
    async (name) => {
      const src = fixture(name);
      const out = await (await OoxmlPackage.open(src)).generate();
      expect(new Uint8Array(out)).toEqual(new Uint8Array(src));
    },
  );

  it("une partie modifiée ne change ni l'ordre ni les octets des autres parties", async () => {
    const src = fixture("sample.docx");
    const pkg = await OoxmlPackage.open(src);
    pkg.setText("word/document.xml", (await pkg.readText("word/document.xml")).replace("Rapport", "Compte rendu"));
    const out = await pkg.generate();
    const before = rawEntries(src);
    const after = rawEntries(out);
    expect([...after.keys()]).toEqual([...before.keys()]);
    for (const [k, v] of before) if (k !== "word/document.xml") expect(after.get(k), k).toEqual(v);
    expect(await (await JSZip.loadAsync(out)).file("word/document.xml")?.async("string")).toContain("Compte rendu");
  });

  it("conserve la méthode STORE d'une entrée", async () => {
    const zip = new JSZip();
    zip.file("a.xml", "<a/>", { compression: "STORE" });
    zip.file("b.xml", "<b/>".repeat(50), { compression: "DEFLATE" });
    const src = await zip.generateAsync({ type: "arraybuffer" });
    const pkg = await OoxmlPackage.open(src);
    pkg.setText("b.xml", "<b>x</b>");
    const out = await pkg.generate();
    expect(centralDirectory(new Uint8Array(out)).map((e) => [e.name, e.method])).toEqual([
      ["a.xml", 0],
      ["b.xml", 8],
    ]);
  });

  it("supprime une partie", async () => {
    const pkg = await OoxmlPackage.open(fixture("sample.docx"));
    pkg.remove("docProps/custom.xml");
    expect(pkg.has("docProps/custom.xml")).toBe(false);
    const out = await OoxmlPackage.open(await pkg.generate());
    expect(out.names()).not.toContain("docProps/custom.xml");
  });
});

describe("ooxml/xml", () => {
  it("conserve la déclaration d'origine et l'ordre des attributs", () => {
    const xml = `<?xml version='1.0' encoding='UTF-8' standalone='yes'?>\r\n<w:document xmlns:w="${NS.w}" xmlns:w14="x" mc:Ignorable="w14" xmlns:mc="${NS.mc}"><w:body/></w:document>`;
    expect(serializeXml(parseXml(xml))).toBe(xml);
  });

  it("rejette un XML invalide", () => {
    expect(() => parseXml("<a><b></a>")).toThrow(/XML invalide/);
  });
});

const W = `xmlns:w="${NS.w}"`;
const para = (inner: string) => {
  const part = parseXml(`<w:document ${W}><w:body><w:p>${inner}</w:p></w:body></w:document>`);
  const p = elementsNS(part.doc, NS.w, "p")[0];
  if (!p) throw new Error("pas de paragraphe");
  return { part, p };
};
const run = (t: string, rPr = "") => `<w:r>${rPr}<w:t xml:space="preserve">${t}</w:t></w:r>`;
const bodyOf = (s: string) => /<w:p>(.*)<\/w:p>/s.exec(s)?.[1] ?? "";

describe("ooxml/runs : fusion", () => {
  it("remplacement à l'intérieur d'un seul run", () => {
    const { part, p } = para(run("Bonjour Jean Dupont !") + run(" Suite", "<w:rPr><w:b/></w:rPr>"));
    const c = collect(p, WORD);
    expect(c.text).toBe("Bonjour Jean Dupont ! Suite");
    applyEdits(c, [{ start: 8, end: 19, replacement: "⟦P-ABCDE⟧" }], WORD);
    expect(bodyOf(serializeXml(part))).toBe(run("Bonjour ⟦P-ABCDE⟧ !") + run(" Suite", "<w:rPr><w:b/></w:rPr>"));
  });

  it("remplacement à cheval sur deux runs : fusion dans le premier, mise en forme conservée", () => {
    const { part, p } = para(
      run("Par Paulina Kow", "<w:rPr><w:i/></w:rPr>") + run("alski le 3", "<w:rPr><w:b/></w:rPr>"),
    );
    const c = collect(p, WORD);
    applyEdits(c, [{ start: 4, end: 20, replacement: "⟦P-ABCDE⟧" }], WORD);
    expect(collect(p, WORD).text).toBe("Par ⟦P-ABCDE⟧ le 3");
    expect(bodyOf(serializeXml(part))).toBe(
      run("Par ⟦P-ABCDE⟧", "<w:rPr><w:i/></w:rPr>") + run(" le 3", "<w:rPr><w:b/></w:rPr>"),
    );
  });

  it("remplacement sur trois runs : le run du milieu est vidé mais conservé", () => {
    const { part, p } = para(run("a ⟦P-") + `<w:r><w:rPr><w:b/></w:rPr><w:t>AB</w:t></w:r>` + run("CDE⟧ b"));
    const c = collect(p, WORD);
    expect(c.text).toBe("a ⟦P-ABCDE⟧ b");
    applyEdits(c, [{ start: 2, end: 11, replacement: "Jean" }], WORD);
    expect(bodyOf(serializeXml(part))).toBe(
      run("a Jean") + `<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve"/></w:r>` + run(" b"),
    );
  });

  it("une tabulation au milieu d'un run compte pour un caractère et n'est pas touchée", () => {
    const { part, p } = para(`<w:r><w:t>Nom</w:t><w:tab/><w:t>Jean Dupont</w:t></w:r>`);
    const c = collect(p, WORD);
    expect(c.text).toBe("Nom\tJean Dupont");
    applyEdits(c, [{ start: 4, end: 15, replacement: "⟦P-ABCDE⟧" }], WORD);
    expect(bodyOf(serializeXml(part))).toBe(
      `<w:r><w:t>Nom</w:t><w:tab/><w:t xml:space="preserve">⟦P-ABCDE⟧</w:t></w:r>`,
    );
  });

  it("un run avec w:drawing garde son dessin quand son texte est vidé", () => {
    const drawing = "<w:drawing><wp:inline xmlns:wp='x'/></w:drawing>";
    const { part, p } = para(run("Jean ") + `<w:r>${drawing}<w:t>Dupont</w:t></w:r>` + run(" fin"));
    const c = collect(p, WORD);
    applyEdits(c, [{ start: 0, end: 11, replacement: "⟦P-ABCDE⟧" }], WORD);
    const out = serializeXml(part);
    expect(out).toContain("<wp:inline");
    expect(collect(p, WORD).text).toBe("⟦P-ABCDE⟧ fin");
  });

  it("ignore w:del, w:instrText et les paragraphes imbriqués ; traverse hyperlien et w:ins", () => {
    const { p } = para(
      `<w:hyperlink><w:r><w:t>a@b.fr</w:t></w:r></w:hyperlink><w:del><w:r><w:delText>X</w:delText></w:r></w:del>` +
        `<w:ins><w:r><w:t> ok</w:t></w:r></w:ins><w:r><w:instrText>HYPERLINK</w:instrText><w:br/></w:r>` +
        `<w:r><w:drawing><w:txbxContent><w:p><w:r><w:t>imbriqué</w:t></w:r></w:p></w:txbxContent></w:drawing></w:r>`,
    );
    expect(collect(p, WORD).text).toBe("a@b.fr ok\n");
  });

  it("plusieurs remplacements dans le même run", () => {
    const { p } = para(run("Jean et Paul et Marie"));
    const c = collect(p, WORD);
    const out = applyEdits(
      c,
      [
        { start: 0, end: 4, replacement: "⟦P-AAAAA⟧" },
        { start: 8, end: 12, replacement: "⟦P-BBBBB⟧" },
        { start: 16, end: 21, replacement: "⟦P-CCCCC⟧" },
      ],
      WORD,
    );
    expect(out).toBe("⟦P-AAAAA⟧ et ⟦P-BBBBB⟧ et ⟦P-CCCCC⟧");
    expect(collect(p, WORD).text).toBe(out);
  });

  it("DrawingML : a:fld ignoré, pas de xml:space", () => {
    const part = parseXml(
      `<a:p xmlns:a="${NS.a}"><a:r><a:t>Jean </a:t></a:r><a:fld type="slidenum"><a:t>3</a:t></a:fld><a:br/><a:r><a:t>Dupont</a:t></a:r></a:p>`,
    );
    const p = part.doc.documentElement;
    if (!p) throw new Error();
    const c = collect(p, DRAWING);
    expect(c.text).toBe("Jean \nDupont");
    applyEdits(c, [{ start: 6, end: 12, replacement: "⟦P-ABCDE⟧" }], DRAWING);
    expect(serializeXml(part)).toContain("<a:t>⟦P-ABCDE⟧</a:t>");
  });
});
