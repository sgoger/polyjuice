import { decodePDFRawStream, PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { extractPdf, paragraphsOf } from "../../src/adapters/pdf.ts";
import { parseContent } from "../../src/adapters/pdfContent.ts";
import { interpret, verifyPdf } from "../../src/adapters/pdfRewrite.ts";
import { restore } from "../../src/worker/pipeline.ts";
import { anonymizeFixture, ctx, expected, fixture, readDoc, text } from "./helpers.ts";

/** Texte extrait par pdf.js : paragraphes (comme pour la détection) et fragments bout à bout. */
async function pdfText(data: ArrayBuffer): Promise<string> {
  const x = await extractPdf(data);
  return `${x.markdown}\n${x.itemsText}`;
}

/** Contenu décodé de tous les objets du fichier (flux décompressés compris), en latin1 et UTF-16. */
async function allObjects(data: ArrayBuffer): Promise<string> {
  const doc = await PDFDocument.load(data);
  const out: string[] = [];
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFRawStream) {
      out.push(obj.dict.toString());
      const bytes = decodePDFRawStream(obj).decode();
      out.push(new TextDecoder("latin1").decode(bytes), new TextDecoder("utf-16be").decode(bytes));
    } else out.push(obj.toString());
  }
  return out.join("\n");
}

/** Glyphes des pages (texte, police, position arrondie), d'après l'interprétation des flux de contenu. */
async function glyphsOf(data: ArrayBuffer): Promise<string[]> {
  const doc = await PDFDocument.load(data);
  const out: string[] = [];
  doc.getPages().forEach((page, n) => {
    const contents = page.node.Contents();
    const streams = contents instanceof PDFArray ? contents.asArray() : [page.node.get(PDFName.of("Contents"))];
    const bytes = streams.map((s) => {
      const st = doc.context.lookup(s);
      return st instanceof PDFRawStream ? decodePDFRawStream(st).decode() : new Uint8Array();
    });
    const content = new Uint8Array(bytes.reduce((a, b) => a + b.length + 1, 0));
    let p = 0;
    for (const b of bytes) {
      content.set(b, p);
      p += b.length + 1;
      content[p - 1] = 10;
    }
    const resources = doc.context.lookup(page.node.getInheritableAttribute(PDFName.of("Resources")));
    const unit = interpret(doc.context, parseContent(content), resources instanceof PDFDict ? resources : undefined);
    for (const g of unit.glyphs) {
      const font = g.fontName.startsWith("PJTok") ? "/PJTok" : "";
      out.push(`${n} ${g.text}${font} ${g.trm[4].toFixed(3)} ${g.trm[5].toFixed(3)}`);
    }
  });
  return out;
}

const tokensOf = (mapping: ArrayBuffer) =>
  Object.keys((JSON.parse(text(mapping)) as { entities: Record<string, unknown> }).entities);

describe("PDF : extraction", () => {
  it("extrait le texte en Markdown avec toutes les entités, saut de page ---", async () => {
    const doc = await readDoc("sample.pdf", fixture("sample.pdf"));
    const all = doc.segments.map((s) => s.text).join("\n");
    for (const e of expected.fixtures["sample.pdf"] ?? []) expect(all, e.text).toContain(e.text);
    expect(all).toContain("---");
    expect(doc.outputExtension).toBe("md");
    expect(doc.warnings.join("\n")).not.toMatch(/scanné/);
  }, 30_000);

  it("regroupe en lignes puis en paragraphes (écart > 1,5 × hauteur)", () => {
    const it = (str: string, x: number, y: number) => ({ str, x, y, w: str.length * 5, h: 10 });
    expect(paragraphsOf([it("Jean", 0, 100), it("Dupont", 30, 100), it("suite", 0, 88), it("Autre", 0, 60)])).toEqual([
      "Jean Dupont suite",
      "Autre",
    ]);
  });
});

describe.each(["sample.pdf", "pdf-fragments.pdf", "pdf-composite.pdf"])("PDF réécrit : %s", (name) => {
  it("document principal .pdf sans aucune valeur d'origine, tokens intacts ; .md produit aussi", async () => {
    const r = await anonymizeFixture(name);
    const base = name.replace(/\.pdf$/, "");
    expect(r.document.name).toBe(`${base}.anonymise.pdf`);
    expect(r.document.mime).toBe("application/pdf");
    expect(r.alternate?.name).toBe(`${base}.anonymise.md`);
    expect(r.warnings[0]).toMatch(/^PDF réécrit/);

    const pdf = await pdfText(r.document.data);
    const md = text(r.alternate?.data ?? new ArrayBuffer(0));
    const raw = await allObjects(r.document.data);
    const entities = expected.fixtures[name] ?? [];
    expect(entities.length).toBeGreaterThan(0);
    for (const e of entities) {
      expect(pdf, `texte du PDF : ${e.text}`).not.toContain(e.text);
      expect(raw, `objets du PDF : ${e.text}`).not.toContain(e.text);
      expect(md, `.md : ${e.text}`).not.toContain(e.text);
    }
    // Chaque token attribué se lit dans le PDF produit, avec ⟦ ⟧.
    const tokens = tokensOf(r.mapping.data);
    expect(tokens.length).toBe(new Set(entities.map((e) => e.text)).size);
    for (const t of tokens) expect(pdf, t).toContain(t);
  }, 30_000);

  it("le PDF produit passe la vérification et le texte non détecté reste en place", async () => {
    const r = await anonymizeFixture(name);
    const replacements = Object.entries(
      (JSON.parse(text(r.mapping.data)) as { entities: Record<string, { original: string }> }).entities,
    ).map(([token, e]) => ({ token, original: e.original }));
    expect(await verifyPdf(new Uint8Array(r.document.data), replacements)).toBeNull();
    // L'original, lui, ne la passe pas.
    expect(await verifyPdf(new Uint8Array(fixture(name)), replacements)).toMatch(/pas pu être retirées? du texte/);
    // Mise en page conservée : chaque glyphe conservé est exactement à sa place d'origine.
    const kept = await glyphsOf(r.document.data);
    const before = new Set(await glyphsOf(fixture(name)));
    const tokens = kept.filter((g) => g.includes("/PJTok"));
    const others = kept.filter((g) => !g.includes("/PJTok"));
    expect(tokens.length).toBeGreaterThan(0);
    expect(others.length).toBeGreaterThan(0);
    for (const g of others) expect(before.has(g), g).toBe(true);
  }, 30_000);
});

describe("PDF réécrit : structure", () => {
  it("annotations, structure, métadonnées et texte de remplacement (ActualText) retirés", async () => {
    const r = await anonymizeFixture("pdf-fragments.pdf");
    const doc = await PDFDocument.load(r.document.data, { updateMetadata: false });
    expect(doc.getTitle()).toBeUndefined();
    expect(doc.getAuthor()).toBeUndefined();
    expect(doc.catalog.has(PDFName.of("StructTreeRoot"))).toBe(false);
    expect(doc.getPages()[0]?.node.Annots()).toBeUndefined();
    const raw = await allObjects(r.document.data);
    expect(raw).not.toContain("ActualText");
    expect(raw).not.toContain("mailto:");
    expect(r.warnings.join("\n")).toMatch(/Retirés du PDF produit : les métadonnées.*1 annotation.*structure/);
  }, 30_000);

  it("le même mapping redonne exactement le même PDF", async () => {
    const first = await anonymizeFixture("pdf-fragments.pdf");
    const second = await anonymizeFixture("pdf-fragments.pdf", { mapping: text(first.mapping.data) });
    expect(new Uint8Array(second.document.data)).toEqual(new Uint8Array(first.document.data));
  }, 30_000);
});

describe("PDF non réécrit : repli vers le .md", () => {
  it("police Type3 : PDF refusé, .md seul, avertissement explicite", async () => {
    const r = await anonymizeFixture("pdf-type3.pdf");
    expect(r.document.name).toBe("pdf-type3.anonymise.md");
    expect(r.alternate).toBeUndefined();
    expect(r.warnings[0]).toMatch(
      /^PDF non réécrit \(.*en cause : police Type3\) : seul le texte est produit, en Markdown/,
    );
    const md = text(r.document.data);
    for (const e of expected.fixtures["pdf-type3.pdf"] ?? []) expect(md, e.text).not.toContain(e.text);
    // L'avertissement ne cite aucune valeur d'origine.
    for (const e of expected.fixtures["pdf-type3.pdf"] ?? []) expect(r.warnings.join("\n")).not.toContain(e.text);
  }, 30_000);

  it("PDF scanné : avertissement et .md quasi vide, sans erreur", async () => {
    const r = await anonymizeFixture("scanned.pdf");
    expect(r.document.name).toBe("scanned.anonymise.md");
    expect(r.warnings.join("\n")).toMatch(/PDF non réécrit \(probablement scanné\)/);
    expect(r.warnings.join("\n")).toMatch(/probablement scanné \(0 caractères/);
    expect(r.warnings.join("\n")).toMatch(/1 page contient des images/);
    expect(text(r.document.data).trim()).toBe("");
  }, 30_000);

  it("PDF illisible par l'outil de réécriture : refus, pas d'erreur", async () => {
    const { rewritePdf } = await import("../../src/adapters/pdfRewrite.ts");
    const r = await rewritePdf(new TextEncoder().encode("%PDF-1.7\nnimporte quoi").buffer, []);
    expect(r).toMatchObject({ ok: false, reason: "structure du PDF non prise en charge" });
  });

  it("« Restaurer » refuse un .pdf", async () => {
    await expect(restore({ file: fixture("sample.pdf"), fileName: "a.pdf", mapping: "{}" }, ctx)).rejects.toMatchObject(
      {
        code: "UnsupportedFormat",
        message: expect.stringMatching(/déposez le fichier \.md/) as unknown,
      },
    );
  });
});
