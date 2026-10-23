// Messages du moteur et des adaptateurs, en allemand (même structure que fr.ts).
import type { Messages, OfficeTarget } from "./fr.ts";

/** Accord en nombre à l'allemande : seul 1 est au singulier (« 0 Einträge »). */
const pl = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
const agree = (n: number, one: string, many: string): string => (n === 1 ? one : many);

export const de: Messages = {
  labels: {
    types: {
      PERSON: "Person",
      ORGANIZATION: "Organisation",
      LOCATION: "Ort",
      EMAIL_ADDRESS: "E-Mail",
      PHONE_NUMBER: "Telefon",
      IBAN_CODE: "IBAN",
      CREDIT_CARD: "Kreditkarte",
      URL: "URL",
      IP_ADDRESS: "IP-Adresse",
      FR_NIR: "NIR",
    },
    sources: {
      ner: "KI (NER)",
      regex: "Muster",
      names: "Namensglossar",
      columns: "Spalte",
    },
    kinds: {
      body: "Haupttext",
      header: "Kopfzeile",
      footer: "Fußzeile",
      footnote: "Fußnote",
      comment: "Kommentar",
      notes: "Notizen",
      cell: "Zelle",
    },
  },

  colon: ": ",
  mappingReminder: "Das Mapping enthält die Daten im Klartext. Nicht weitergeben.",
  cancelled: "Verarbeitung abgebrochen",
  stillLooksPersonal: (n) => `${pl(n, "Element sieht", "Elemente sehen")} noch nach personenbezogenen Daten aus.`,

  report: {
    warnings: "Warnungen",
    none: "Keine.",
    detectionTitle: (file) => `Erkennungsbericht – ${file}`,
    file: "Datei",
    format: "Format",
    ner: (on) => `KI-Erkennung (NER): ${on ? "aktiviert" : "deaktiviert"}`,
    replacedEntities: "Ersetzte unterschiedliche Entitäten",
    replacements: "Ersetzungen",
    token: "Token",
    type: "Typ",
    source: "Quelle",
    occurrences: "Vorkommen",
    firstContext: "Kontext (erstes Vorkommen)",
    noEntity: "Keine Entität erkannt.",
    checkTitle: (file) => `Prüfung – ${file}`,
    nothingDetected: "Keine personenbezogenen Daten erkannt (vorhandene Tokens werden ignoriert).",
    text: "Text",
    location: "Fundstelle",
    context: "Kontext",
    toReport: "Hinweise",
    restoreTitle: (file) => `Wiederherstellungsbericht – ${file}`,
    unknownTokensTitle: "⚠ Fehler: unbekannte Tokens",
    unknownTokens: (n) =>
      `${pl(n, "Token im polyjuice-Format fehlt im Mapping und wurde unverändert gelassen", "Tokens im polyjuice-Format fehlen im Mapping und wurden unverändert gelassen")}. Prüfen Sie, ob das Mapping wirklich zu diesem Dokument gehört.`,
    restoredTokens: "Wiederhergestellte Tokens",
    noTokenFound: "Keines der Tokens aus dem Mapping wurde in diesem Dokument gefunden.",
    missingTokens: "Nicht gefundene Tokens aus dem Mapping (Information)",
  },

  pipeline: {
    noExtension: "Datei ohne Dateiendung: Format unbekannt",
    unreadable: (detail) => `Dokument nicht lesbar: ${detail}`,
    nerUnavailable: "KI-Erkennung nicht verfügbar",
    nerLoadFailed: (detail) =>
      `Das KI-Erkennungsmodell konnte nicht geladen werden (${detail}). Prüfen Sie die Internetverbindung oder deaktivieren Sie die Option: Die Erkennung über Muster und Namensglossar funktioniert ohne Netzwerk.`,
    notice: (where, n) =>
      `${where}: ${pl(n, "Element enthält", "Elemente enthalten")} erkannte personenbezogene Daten und ${agree(n, "wird", "werden")} nicht geändert („Prüfen“ listet ${agree(n, "es", "sie")} auf).`,
  },

  mapping: {
    notJson: "Das Mapping ist keine gültige JSON-Datei.",
    notObject: "Das Mapping muss ein JSON-Objekt sein.",
    notPolyjuice: "Diese Datei ist kein polyjuice-Mapping (Feld schema_version fehlt).",
    unknownVersion: (found, expected) =>
      `Unbekannte Schemaversion des Mappings: ${found} (diese polyjuice-Version liest Version ${expected}).`,
    invalid: (issues) => `Ungültiges Mapping – ${issues}`,
    root: "(Wurzel)",
    saltBytes: (n) => `der Salt muss ${n} Byte lang sein`,
    invalidToken: (token) => `ungültiges Token: ${token}`,
    letterMismatch: (type) => `Buchstabe des Tokens passt nicht zum Typ ${type}`,
  },

  formats: {
    targets: {
      docx: { app: "Word", saveAs: "Word-Dokument (.docx)" },
      xlsx: { app: "Excel", saveAs: "Excel-Arbeitsmappe (.xlsx)" },
      pptx: { app: "PowerPoint", saveAs: "PowerPoint-Präsentation (.pptx)" },
    },
    reasons: {
      binaryWord: "altes Word-Binärformat 97-2003",
      binaryExcel: "altes Excel-Binärformat 97-2003",
      binaryPowerPoint: "altes PowerPoint-Binärformat 97-2003",
      rtf: "RTF-Format",
      openDocument: "OpenDocument-Format",
      template: "Vorlage",
      binaryWorkbook: "binäre Excel-Arbeitsmappe",
      csv: "Text mit Trennzeichen, ohne erkannte Spalten",
      slideShow: "Bildschirmpräsentation",
    },
    refused: (file, ext, reason, t: OfficeTarget, targetExt) =>
      `„${file}“: .${ext} wird nicht unterstützt (${reason}). Öffnen Sie die Datei in ${t.app}, Datei → Speichern unter → ${t.saveAs}, und wählen Sie dann die .${targetExt}-Datei aus.`,
    pdfRestore: (file) =>
      `„${file}“: Die Wiederherstellung gilt nicht für das ursprüngliche PDF. Wählen Sie die vom externen Tool zurückgegebene .md-Datei (oder .txt-Datei) aus.`,
    notAccepted: (file, accepted) => `„${file}“ wird hier nicht unterstützt. Zulässige Formate: ${accepted}.`,
    empty: (file) => `„${file}“ ist leer.`,
    oldOffice: (file, ext, app, targetExt) =>
      `„${file}“ ist keine echte .${ext}-Datei: Es handelt sich um eine umbenannte Office-97-2003-Datei oder um eine kennwortgeschützte Datei. Öffnen Sie sie in ${app}, entfernen Sie gegebenenfalls das Kennwort und speichern Sie sie im Format .${targetExt}.`,
    notReal: (file, ext, app, targetExt) =>
      `„${file}“ ist keine echte .${ext}-Datei: Öffnen Sie sie in ${app} und speichern Sie sie im Format .${targetExt}.`,
  },

  ooxml: {
    metadata: {
      creator: "Autor",
      lastModifiedBy: "zuletzt geändert von",
      title: "Titel",
      subject: "Betreff",
      keywords: "Stichwörter",
      description: "Beschreibung",
      category: "Kategorie",
      contentStatus: "Status",
      Company: "Firma",
      Manager: "Manager",
      custom: "benutzerdefinierte Eigenschaften",
      thumbnail: "Vorschaubild",
    },
    titles: (n) =>
      `Dokumenteigenschaften (docProps/app.xml): ${pl(n, "kopierter Titel", "kopierte Titel")} (Blattnamen, Folientitel…), unverändert beibehalten.`,
    metadataCleared: (labels) => `Metadaten geleert: ${labels} (Erstellungs- und Änderungsdatum neutralisiert).`,
    altText: "Alternativtext",
    linkTarget: "Linkziel",
    media: (n) =>
      `${pl(n, "Bild oder Medium vorhanden", "Bilder oder Medien vorhanden")}: Text in Bildern wird nicht verarbeitet.`,
    smartArt: "SmartArt-Grafiken vorhanden: ihr Text wird nicht verarbeitet.",
    charts: "Diagramme vorhanden: ihr Text wird nicht verarbeitet.",
    ole: (n) =>
      `${pl(n, "eingebettetes Objekt (OLE) vorhanden", "eingebettete Objekte (OLE) vorhanden")}: ${agree(n, "sein", "ihr")} Inhalt wird nicht verarbeitet.`,
    macros: (part) => `Makros vorhanden (${part}): unverändert übernommen, nicht analysiert.`,
    partUnreadable: (part, detail) => `Nicht lesbarer Teil, nicht verarbeitet: ${part} (${detail}).`,
    invalidXml: (detail) => `Ungültiges XML: ${detail}`,
    emptyXml: "leeres Dokument",
    invalidZip: "ungültiges ZIP-Archiv (zentrales Verzeichnis nicht gefunden)",
    missingPart: (part) => `fehlender Teil: ${part}`,
  },

  docx: {
    notWord: "word/document.xml fehlt: Dies ist kein Word-Dokument",
    fieldCode: "Feldfunktion",
    deletedRevisions:
      "Gelöschte Änderungen (Änderungen nachverfolgen) vorhanden: Ihr Text bleibt unverarbeitet in der Datei. Nehmen Sie die Änderungen vor dem Anonymisieren an oder lehnen Sie sie ab.",
    customXml:
      "Inhaltssteuerelemente, die an XML-Daten gebunden sind (customXml): Diese Daten werden nicht verarbeitet, und Word kann sie beim Öffnen wieder anzeigen.",
    authors: (n) =>
      `${pl(n, "Name einer Person", "Namen von Personen")}, die kommentiert oder Änderungen vorgenommen ${agree(n, "hat, bleibt", "haben, bleiben")} im Klartext: ${agree(n, "Er wird", "Sie werden")} nicht anonymisiert. Um ${agree(n, "ihn", "sie")} zu entfernen, nehmen Sie in Word alle Änderungen an, löschen Sie alle Kommentare und anonymisieren Sie das Dokument erneut.`,
    peopleList:
      "Liste der Personen, die das Dokument kommentiert oder geändert haben (word/people.xml), unverändert beibehalten.",
    trackRevisions:
      "„Änderungen nachverfolgen“ ist aktiviert: Jede spätere Änderung am anonymisierten Dokument wird dort mit dem Namen der Person gespeichert, die sie vornimmt.",
  },

  pptx: {
    notPresentation: "ppt/presentation.xml fehlt: Dies ist keine Präsentation",
    comments: (n) =>
      `${pl(n, "Folienkommentar", "Folienkommentare")}: Text und Namen der Verfasser bleiben im Klartext (nicht verarbeitet). Löschen Sie die Kommentare in PowerPoint und anonymisieren Sie die Präsentation erneut.`,
    peopleList: "Liste der Verfasser von Kommentaren unverändert beibehalten (Namen im Klartext).",
  },

  xlsx: {
    notWorkbook: "xl/workbook.xml fehlt: Dies ist keine Arbeitsmappe",
    comments: (n) =>
      `${pl(n, "Kommentar oder Zellnotiz", "Kommentare oder Zellnotizen")}: Text und Namen der Verfasser bleiben im Klartext (nicht verarbeitet). Löschen Sie sie in Excel und anonymisieren Sie die Arbeitsmappe erneut.`,
    peopleList: "Liste der Verfasser von Kommentaren (xl/persons) unverändert beibehalten (Namen im Klartext).",
    formulaResult: "Formelergebnis",
    headerFooter: "Kopf- oder Fußzeile eines Tabellenblatts",
    pivotTables: "PivotTables vorhanden: Ihr Cache (Kopie der Quelldaten) wird nicht verarbeitet.",
    externalLinks:
      "Verknüpfungen zu anderen Arbeitsmappen vorhanden: Ihre zwischengespeicherten Werte werden nicht verarbeitet.",
    sheetName: "Blattname",
    workbookUnreadable: "Nicht lesbarer Teil: xl/workbook.xml (Blattnamen nicht geprüft).",
    sharedStrings: (n) =>
      `${pl(n, "gemeinsam genutzte Zeichenfolge der anonymisierten Spalten wird", "gemeinsam genutzte Zeichenfolgen der anonymisierten Spalten werden")} in mehreren Spalten verwendet: Alle Zellen, die sie verwenden, werden ersetzt.`,
  },

  text: {
    unclosedFence:
      "Nicht geschlossener Markdown-Codeblock: Der gesamte Text nach dem Beginn des Blocks wird nicht verarbeitet.",
  },

  pdf: {
    scanned: (charsPerPage) =>
      `PDF wahrscheinlich gescannt (durchschnittlich ${charsPerPage} Zeichen pro Seite): Text in Bildern wird nicht extrahiert (keine Texterkennung/OCR).`,
    pagesWithImages: (n) =>
      `${pl(n, "Seite enthält", "Seiten enthalten")} Bilder: Text in Bildern wird nicht verarbeitet.`,
    notRewrittenScanned:
      "PDF nicht umgeschrieben (wahrscheinlich gescannt): Es wird nur der Text als Markdown (.md) erzeugt; die ursprüngliche Formatierung bleibt nicht erhalten.",
    notRewritten: (reason) =>
      `PDF nicht umgeschrieben (${reason}): Es wird nur der Text als Markdown (.md) erzeugt; die ursprüngliche Formatierung bleibt nicht erhalten.`,
    unexpected: (detail) => `unerwarteter Fehler: ${detail}`,
    rewritten:
      "PDF umgeschrieben: Die erkannten Daten werden aus der Datei entfernt und durch Tokens ersetzt (angezeigt in [ ], kopiert als ⟦ ⟧), das Layout bleibt erhalten. Zusätzlich wird eine Textversion (.md) erzeugt.",
    removed: (parts) => `Aus dem erzeugten PDF entfernt: ${parts}.`,
    removedParts: {
      metadata: "die Metadaten (Titel, Autor…)",
      annotations: (n) => `${n} ${n === 1 ? "Anmerkung" : "Anmerkungen"} (Links, Kommentare…)`,
      outlines: "die Lesezeichen",
      structure: "die Barrierefreiheitsstruktur (getaggtes PDF)",
      attachments: "die Dateianhänge",
      scripts: "die Aktionen und Skripte",
    },
    form: "PDF-Formular",
    layers: "Ebenen (optionale Inhalte)",
    encrypted: "verschlüsseltes PDF",
    unsupportedStructure: "nicht unterstützte PDF-Struktur",
    unreadableStream: (detail) => `nicht lesbarer Inhaltsstrom (${detail})`,
    ocr: "unsichtbarer Text über einem Bild (PDF mit Texterkennung)",
    cause: (fonts) => `; Ursache: ${fonts}`,
    doesNotOpen: "das erzeugte PDF lässt sich nicht öffnen",
    notRemoved: (n) =>
      n === 1
        ? `${n} erkannter Wert konnte nicht aus dem Text des PDFs entfernt werden`
        : `${n} erkannte Werte konnten nicht aus dem Text des PDFs entfernt werden`,
    unreadableTokens: (n) => `${pl(n, "Token", "Tokens")} im erzeugten PDF nicht lesbar`,
    remainsInStructure: (n) =>
      n === 1
        ? `${n} erkannter Wert verbleibt in der Struktur des PDFs`
        : `${n} erkannte Werte verbleiben in der Struktur des PDFs`,
    fonts: {
      noWidths: "Schriftart ohne Zeichenbreitentabelle",
      composite: (encoding) => `zusammengesetzte Schriftart (Kodierung ${encoding ?? "eingebettet"})`,
      compositeNoToUnicode: "zusammengesetzte Schriftart ohne ToUnicode-Tabelle",
      compositeMalformed: "fehlerhafte zusammengesetzte Schriftart",
      notFound: "Schriftart nicht gefunden",
      toUnicodeUnreadable: "ToUnicode-Tabelle nicht lesbar",
      other: (subtype) => `Schriftart ${subtype ?? "unbekannt"}`,
    },
    syntax: {
      unterminatedString: "nicht abgeschlossene Zeichenkette",
      unexpectedEnd: "unerwartetes Ende des Datenstroms",
      malformedArray: "fehlerhaftes Array",
      malformedDict: "fehlerhaftes Dictionary",
      unexpectedDelimiter: "unerwartetes Trennzeichen",
      unexpectedValue: (word) => `unerwarteter Wert: ${word}`,
      malformedInlineImage: "fehlerhaftes Inline-Bild",
      unterminatedInlineImage: "nicht abgeschlossenes Inline-Bild",
    },
  },
};
