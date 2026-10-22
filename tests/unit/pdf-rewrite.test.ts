import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { parseContent, serializeOperand, serializeOperation } from "../../src/adapters/pdfContent.ts";
import { parseToUnicode } from "../../src/adapters/pdfFonts.ts";
import { remainingValues, rewritePdf, tokenFit, tokenGlyphs, valuePattern } from "../../src/adapters/pdfRewrite.ts";
import { anonymizeFixture, expected, fixture, text } from "./helpers.ts";

const bytes = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));
const str = (b: unknown) => (b instanceof Uint8Array ? String.fromCharCode(...b) : null);

describe("flux de contenu", () => {
  it("découpe opérandes et opérateurs, chaînes littérales et hexadécimales comprises", () => {
    const src = "BT /F1 11 Tf 1 0 0 1 50 700 Tm (a\\(b\\)\\\\c\\101\\n) Tj [<4A65> -250 (an)] TJ ET % commentaire\nq Q";
    const ops = parseContent(bytes(src));
    expect(ops.map((o) => o.op)).toEqual(["BT", "Tf", "Tm", "Tj", "TJ", "ET", "q", "Q"]);
    expect(ops[1]?.args).toEqual([{ name: "F1" }, 11]);
    expect(str(ops[3]?.args[0])).toBe("a(b)\\cA\n");
    const tj = ops[4]?.args[0] as unknown[];
    expect(str(tj[0])).toBe("Je");
    expect(tj[1]).toBe(-250);
    // Chaque opération garde sa plage d'origine, pour être recopiée à l'identique.
    expect(src.slice(ops[2]?.start, ops[2]?.end)).toBe("1 0 0 1 50 700 Tm");
  });

  it("dictionnaires en opérande (contenu marqué) et image en ligne", () => {
    const src = "/Span <</ActualText (X) /MCID 3>> BDC EMC BI /W 2 /H 1 /BPC 8 /CS /G ID \x00EI\xff EI Q";
    const ops = parseContent(bytes(src));
    expect(ops.map((o) => o.op)).toEqual(["BDC", "EMC", "BI", "Q"]);
    const props = ops[0]?.args[1] as Map<string, unknown>;
    expect(props.get("MCID")).toBe(3);
    expect(src.slice(ops[2]?.start, ops[2]?.end)).toBe("BI /W 2 /H 1 /BPC 8 /CS /G ID \x00EI\xff EI");
  });

  it("sérialise sans perte", () => {
    expect(serializeOperation("TJ", [[bytes("A)"), -12.5, bytes("b")]])).toBe("[<4129> -12.5 <62>] TJ");
    expect(serializeOperand({ name: "A B#" })).toBe("/A#20B#23");
    expect(serializeOperation("Tz", [100 / 3])).toBe("33.33333 Tz");
  });

  it("refuse un flux mal formé", () => {
    expect(() => parseContent(bytes("BT (non terminée Tj"))).toThrow();
  });
});

describe("ToUnicode", () => {
  it("bfchar, bfrange (incrément et tableau), cibles UTF-16 sur plusieurs unités", () => {
    const cmap = parseToUnicode(
      bytes(
        "2 beginbfchar <0003> <0020> <0010> <00660069> endbfchar 2 beginbfrange <0020> <0022> <0041> <0030> <0031> [<00E9> <0142>] endbfrange",
      ),
    );
    expect(cmap.get(3)).toBe(" ");
    expect(cmap.get(0x10)).toBe("fi");
    expect([cmap.get(0x20), cmap.get(0x21), cmap.get(0x22)]).toEqual(["A", "B", "C"]);
    expect([cmap.get(0x30), cmap.get(0x31)]).toEqual(["é", "ł"]);
  });
});

describe("valeurs et tokens", () => {
  it("motif : blancs souples, limites de mot", () => {
    const re = valuePattern("Jean Dupont");
    expect("M. Jean  Dupont.").toMatch(re ?? /$^/);
    expect("Jean\nDupont").toMatch(re ?? /$^/);
    expect("JeanDupont").toMatch(re ?? /$^/);
    expect(remainingValues("Jean Dupontel", ["Jean Dupont"])).toEqual([]);
    expect(remainingValues("Rose et Martin", ["Martin", "Paul"])).toEqual(["Martin"]);
    expect(remainingValues("écrire à a.b@example.org.", ["a.b@example.org"])).toEqual(["a.b@example.org"]);
  });

  it("⟦ ⟧ dessinés comme [ ] (Helvetica n'a pas ces glyphes)", () => {
    expect(tokenGlyphs("⟦P-K7M2X⟧")).toBe("[P-K7M2X]");
  });

  it("ajustement : compression horizontale, puis réduction du corps, puis débordement", () => {
    expect(tokenFit(2)).toEqual({ size: 1, stretch: 1 });
    expect(tokenFit(0.8)).toEqual({ size: 1, stretch: 0.8 });
    const small = tokenFit(0.45);
    expect(small.size * small.stretch).toBeCloseTo(0.45);
    const tiny = tokenFit(0.1);
    expect(tiny).toEqual({ size: 0.55, stretch: 0.6 });
  });
});

describe("refus de la réécriture", () => {
  it("PDF chiffré", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage().drawText("Jean Dupont", { font: await pdf.embedFont(StandardFonts.Helvetica) });
    pdf.context.trailerInfo.Encrypt = pdf.context.obj({ Filter: "Standard", V: 1, R: 2 });
    const r = await rewritePdf((await pdf.save()).slice().buffer, []);
    expect(r).toMatchObject({ ok: false, reason: "PDF chiffré" });
  });

  it("formulaire", async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage();
    pdf.getForm().createTextField("nom").addToPage(page);
    const r = await rewritePdf((await pdf.save()).slice().buffer, []);
    expect(r).toMatchObject({ ok: false, reason: "formulaire PDF" });
  });

  it("PDF océrisé (texte invisible sur une image) : .md seul", async () => {
    const r = await anonymizeFixture("pdf-ocr.pdf");
    expect(r.document.name).toBe("pdf-ocr.anonymise.md");
    expect(r.warnings[0]).toMatch(/^PDF non réécrit \(texte invisible superposé à une image \(PDF océrisé\)\)/);
    for (const e of expected.fixtures["pdf-ocr.pdf"] ?? []) expect(text(r.document.data)).not.toContain(e.text);
  }, 30_000);

  it("aucune valeur à retirer : le PDF est tout de même recopié sans métadonnées", async () => {
    const r = await rewritePdf(fixture("sample.pdf"), []);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const out = await PDFDocument.load(r.data, { updateMetadata: false });
    expect(out.getProducer()).toBeUndefined();
    expect(out.getPageCount()).toBe(2);
  });
});
