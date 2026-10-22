import { describe, expect, it } from "vitest";
import {
  ANONYMIZE_EXTENSIONS,
  refusalMessage,
  RESTORE_EXTENSIONS,
  signatureProblem,
} from "../../src/adapters/formats.ts";
import { adapterFor } from "../../src/adapters/index.ts";
import { anonymize, check, restore } from "../../src/worker/pipeline.ts";
import { ctx, fixture, NAMES } from "./helpers.ts";

/** Début d'un fichier Office 97-2003 (conteneur OLE2), tel un .doc renommé en .docx. */
const OLE2 = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, ...new Array<number>(504).fill(0)]);

describe("formats acceptés", () => {
  it("chaque extension acceptée a un adaptateur ; les anciens formats binaires n'en ont pas", () => {
    for (const ext of ANONYMIZE_EXTENSIONS) expect(adapterFor(`a.${ext}`), ext).not.toBeNull();
    expect(adapterFor("a.DOCM")?.format).toBe("docm");
    for (const ext of ["doc", "xls", "ppt", "odt"]) expect(adapterFor(`a.${ext}`), ext).toBeNull();
  });
});

describe("messages de refus au dépôt", () => {
  it.each([
    [
      "rapport.doc",
      "« rapport.doc » : .doc n'est pas pris en charge (ancien format binaire Word 97-2003) : ouvrez-le dans Word, Fichier → Enregistrer sous → Document Word (.docx), puis déposez le .docx.",
    ],
    [
      "budget.xls",
      "« budget.xls » : .xls n'est pas pris en charge (ancien format binaire Excel 97-2003) : ouvrez-le dans Excel, Fichier → Enregistrer sous → Classeur Excel (.xlsx), puis déposez le .xlsx.",
    ],
    [
      "slides.ppt",
      "« slides.ppt » : .ppt n'est pas pris en charge (ancien format binaire PowerPoint 97-2003) : ouvrez-le dans PowerPoint, Fichier → Enregistrer sous → Présentation PowerPoint (.pptx), puis déposez le .pptx.",
    ],
  ])("%s", (name, message) => {
    expect(refusalMessage(name, ANONYMIZE_EXTENSIONS)).toBe(message);
    expect(refusalMessage(name, RESTORE_EXTENSIONS)).toBe(message);
  });

  it.each([
    ["notes.rtf", /\.rtf n'est pas pris en charge \(format RTF\) : ouvrez-le dans Word.*\.docx/],
    ["notes.odt", /\.odt n'est pas pris en charge \(format OpenDocument\) : ouvrez-le dans Word/],
    ["budget.ods", /\.ods n'est pas pris en charge \(format OpenDocument\) : ouvrez-le dans Excel/],
    ["export.csv", /\.csv n'est pas pris en charge .* Classeur Excel \(\.xlsx\), puis déposez le \.xlsx\./],
    ["slides.odp", /\.odp n'est pas pris en charge .* Présentation PowerPoint \(\.pptx\)/],
    ["show.ppsx", /\.ppsx n'est pas pris en charge \(diaporama\).*\.pptx/],
    ["photo.png", /« photo\.png » n'est pas pris en charge ici\. Formats acceptés : \.docx, \.docm/],
  ])("%s", (name, message) => {
    expect(refusalMessage(name, ANONYMIZE_EXTENSIONS)).toMatch(message);
  });

  it("« Restaurer » : un PDF d'origine → le .md converti à déposer", () => {
    expect(refusalMessage("a.pdf", RESTORE_EXTENSIONS)).toMatch(/déposez le fichier \.md \(ou \.txt\) renvoyé/);
  });
});

describe("contenu qui ne correspond pas à l'extension", () => {
  it("détecté d'après les premiers octets", () => {
    expect(signatureProblem("a.docx", new Uint8Array(fixture("sample.docx"), 0, 8))).toBeNull();
    expect(signatureProblem("a.docx", OLE2)).toMatch(
      /« a\.docx » n'est pas un vrai \.docx : c'est un fichier Office 97-2003 renommé, ou un fichier protégé par mot de passe\. Ouvrez-le dans Word/,
    );
    expect(signatureProblem("a.xlsx", new TextEncoder().encode("<html>"))).toBe(
      "« a.xlsx » n'est pas un vrai .xlsx : ouvrez-le dans Excel et enregistrez-le au format .xlsx.",
    );
    expect(signatureProblem("a.docx", new Uint8Array(0))).toBe("« a.docx » est vide.");
    expect(signatureProblem("a.md", OLE2)).toBeNull();
  });

  it("un .doc renommé en .docx produit une erreur explicite dans les trois onglets", async () => {
    const file = OLE2.buffer;
    const error = {
      code: "InvalidDocument",
      message: expect.stringMatching(/n'est pas un vrai \.docx.*enregistrez-le au format \.docx/) as unknown,
    };
    const params = { file, fileName: "rapport.docx", names: NAMES, ner: false };
    await expect(anonymize({ ...params, columns: [], mapping: null }, ctx)).rejects.toMatchObject(error);
    await expect(check(params, ctx)).rejects.toMatchObject(error);
    await expect(restore({ file, fileName: "rapport.docx", mapping: "{}" }, ctx)).rejects.toMatchObject(error);
  });

  it("format non pris en charge : même message côté moteur", async () => {
    await expect(
      anonymize(
        { file: new ArrayBuffer(4), fileName: "a.xls", names: "", ner: false, columns: [], mapping: null },
        ctx,
      ),
    ).rejects.toMatchObject({
      code: "UnsupportedFormat",
      message: expect.stringMatching(/Classeur Excel \(\.xlsx\)/) as unknown,
    });
  });
});
