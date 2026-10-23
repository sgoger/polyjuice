import { afterEach, describe, expect, it } from "vitest";
import { ANONYMIZE_EXTENSIONS, refusalMessage, signatureProblem } from "../../src/adapters/formats.ts";
import { uiMessagesFor } from "../../src/app/messages/index.ts";
import { preflightMessage } from "../../src/app/preflight.ts";
import { detectLocale, getLocale, setLocale } from "../../src/i18n/index.ts";
import { createDispatcher } from "../../src/worker/handler.ts";
import type { FromWorker } from "../../src/worker/protocol.ts";
import { check } from "../../src/worker/pipeline.ts";
import { anonymizeFixture, ctx, fixture, NAMES } from "./helpers.ts";

afterEach(() => {
  setLocale("fr");
});

describe("langue de départ", () => {
  it("allemand si la langue préférée du navigateur est l'allemand, français sinon", () => {
    expect(detectLocale(["de-DE", "en"])).toBe("de");
    expect(detectLocale(["de"])).toBe("de");
    expect(detectLocale(["de-CH"])).toBe("de");
    expect(detectLocale(["fr-FR", "de"])).toBe("fr");
    expect(detectLocale(["en-US"])).toBe("fr");
    expect(detectLocale(["dsb"])).toBe("fr");
    expect(detectLocale([])).toBe("fr");
  });
});

describe("messages en allemand", () => {
  it("refus au dépôt : chemin « Speichern unter » de l'Office allemand", () => {
    setLocale("de");
    expect(refusalMessage("rapport.doc", ANONYMIZE_EXTENSIONS)).toBe(
      "„rapport.doc“: .doc wird nicht unterstützt (altes Word-Binärformat 97-2003). Öffnen Sie die Datei in Word, Datei → Speichern unter → Word-Dokument (.docx), und wählen Sie dann die .docx-Datei aus.",
    );
    expect(signatureProblem("vide.xlsx", new Uint8Array())).toBe("„vide.xlsx“ ist leer.");
  });

  // Mots-outils français : leur présence trahit un message resté en français.
  const FRENCH = /\b(les|des|du|est|sont|pas|dans|leur|leurs|non|présents?|traitée?s?)\b|\s:\s/i;

  it.each(["sample.docx", "sample.pptx", "sample.xlsx", "sample.pdf", "sample.md", "revisions.docx"])(
    "%s : avertissements et rapport traduits",
    async (name) => {
      setLocale("de");
      const r = await anonymizeFixture(name);
      for (const w of r.warnings) expect(w).not.toMatch(FRENCH);
      expect(r.reportMarkdown).toContain("# Erkennungsbericht – ");
      expect(r.reportMarkdown).toContain("## Warnungen");
      expect(r.reportMarkdown).toContain("Das Mapping enthält die Daten im Klartext.");
      const c = await check({ file: fixture(name), fileName: name, names: NAMES, ner: false }, ctx);
      for (const n of c.report.notices) expect(n.where).not.toMatch(FRENCH);
    },
  );

  it("le Worker adopte la langue transmise avec la requête", async () => {
    const posted: FromWorker[] = [];
    const dispatch = createDispatcher((msg) => posted.push(msg));
    await dispatch({
      id: 1,
      type: "anonymize",
      params: { file: new ArrayBuffer(1), fileName: "a.odt", names: "", ner: false, columns: [], mapping: null },
      locale: "de",
    });
    expect(getLocale()).toBe("de");
    const [reply] = posted;
    expect(reply?.type).toBe("error");
    if (reply?.type === "error") expect(reply.error.message).toMatch(/^„a\.odt“: \.odt wird nicht unterstützt/);
  });

  it("inspection au dépôt : menus de Word en allemand", () => {
    const m = preflightMessage(
      {
        format: "docx",
        comments: 2,
        revisions: 1,
        notes: 0,
        authors: 1,
        peopleList: false,
        trackRevisions: false,
      },
      uiMessagesFor("de"),
    );
    expect(m?.title).toBe("Dieses Dokument enthält 2 Kommentare und 1 nachverfolgte Änderung von einer Person.");
    expect(m?.details).toContain(
      "Um sie vor dem Anonymisieren zu entfernen: in Word auf der Registerkarte Überprüfen → Annehmen → Alle Änderungen annehmen, dann Löschen → Alle Kommentare im Dokument löschen; speichern Sie die Datei und wählen Sie sie dann erneut aus.",
    );
  });
});
