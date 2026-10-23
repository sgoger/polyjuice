// Textes de l'interface, en allemand (même structure que fr.tsx).
import type { UiMessages } from "./fr.tsx";

/** Accord en nombre à l'allemande : seul 1 est au singulier (« 0 Einträge »). */
const pl = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

const AGAIN = "dann speichern und die Datei erneut auswählen.";
function byPeople(n: number): string {
  return n === 1 ? " von einer Person" : n > 1 ? ` von ${n} Personen` : "";
}

export const de: UiMessages = {
  languageName: "Deutsch",
  languageLabel: "Sprache",
  tagline:
    "Ein Dokument pseudonymisieren, bevor es an ein externes Tool geht, und danach die Originaldaten wiederherstellen.",
  tabs: { label: "Aktionen", anonymize: "Anonymisieren", restore: "Wiederherstellen", check: "Prüfen (optional)" },
  footer: "🔒 Keine Daten verlassen Ihren Browser. Die erzeugten Dokumente bleiben personenbezogene Daten (DSGVO).",
  backend: {
    webgpu: "WebGPU (Grafikkarte)",
    wasm: (threads) => `WASM, ${threads} ${threads === 1 ? "Kern" : "Kerne"}`,
  },
  result: "Ergebnis",

  anonymize: {
    recapNer: (on) => (on ? "KI-Erkennung" : "Ohne KI-Erkennung"),
    recapNames: (n) => pl(n, "Name", "Namen"),
    recapColumns: (columns) => `Spalten: ${columns}`,
    recapMapping: (name) => `Wiederverwendetes Mapping: ${name}`,
    intro: (
      <>
        Das Dokument <strong>anonymisieren</strong>, an das externe Tool (KI, Übersetzung…) <strong>senden</strong> und
        dessen Antwort unter „Wiederherstellen“ <strong>wiederherstellen</strong>.
      </>
    ),
    step1: "Dokument auswählen",
    fileLabel: "Zu anonymisierendes Dokument",
    step2: "Optionen",
    xlsxNoNer:
      "Für Arbeitsmappen ist keine KI-Erkennung verfügbar: Es werden nur Muster (E-Mail, Telefon, IBAN…), das Glossar und die Spalten unten verwendet.",
    columnsLabel: "Zu anonymisierende Spalten",
    columnsHint: "(Überschriften, durch Kommas getrennt)",
    columnsPlaceholder: "Name, Vorname",
    columnsHelp: "Textzellen werden auf jedem Blatt vollständig ersetzt (Überschrift = erste nicht leere Zeile).",
    advanced: "Erweiterte Optionen",
    advancedMapping: (name) => ` (wiederverwendetes Mapping: ${name})`,
    mappingLabel: "Mapping wiederverwenden (optional)",
    mappingHint: "Gleiche Tokens; das Mapping wird ergänzt, nie gekürzt.",
    step3: "Anonymisieren",
    button: "Anonymisieren",
    willDownload: "Ein .zip-Archiv wird heruntergeladen.",
    needFile: "Wählen Sie zuerst ein Dokument aus.",
    success: (n) => `Dokument anonymisiert: ${pl(n, "Entität ersetzt", "Entitäten ersetzt")}.`,
    archiveDownloaded: "Heruntergeladenes Archiv: ",
    roleSend: "Senden",
    roleOrSend: "Oder senden",
    roleKeep: "Behalten, niemals senden",
    sendDocument: "für das externe Tool",
    sendOnly: "einzige zu sendende Datei",
    sendAlternate: "Textversion, falls das Tool PDFs schlecht liest",
    keepMapping: "Klartextdaten, für die Wiederherstellung",
    more: "Erneut herunterladen, Erkennungsbericht",
    moreIntro: "Einzelne Dateien:",
    dlArchive: "Archiv (.zip)",
    dlDocument: "Anonymisiertes Dokument",
    dlAlternate: "Textversion (Markdown)",
    dlMapping: "Mapping (JSON)",
    dlMappingNote: "Klartextdaten: niemals weitergeben.",
    dlReport: "Bericht (Markdown)",
    checkHint: "Optionale Kontrolle vor dem Senden: Tab „Prüfen“.",
    pdfTitle: "PDF: wenn möglich umgeschrieben, sonst in Text umgewandelt",
    pdfBody:
      "Die Daten werden im PDF durch Tokens ersetzt, das Layout bleibt erhalten; dazu kommt eine Textversion (.md). Lässt sich das PDF nicht gefahrlos umschreiben (besondere Schriftart, verschlüsseltes PDF, Formular, Scan…), wird nur die .md-Datei erzeugt.",
    learnMore: "Mehr erfahren",
  },

  check: {
    clean: "Nichts erkannt.",
    intro: "Optional: Findet in einem bereits anonymisierten Dokument, was noch nach personenbezogenen Daten aussieht.",
    step1: "Anonymisiertes Dokument auswählen",
    fileLabel: "Zu prüfendes anonymisiertes Dokument",
    step2: "Optionen",
    xlsxNoNer: "Für Arbeitsmappen ist keine KI-Erkennung verfügbar.",
    step3: "Prüfen",
    button: "Prüfen",
  },

  restore: {
    intro: "Setzt mithilfe des Mappings (der .json-Datei aus dem Archiv) die Originaldaten anstelle der Tokens ein.",
    step1: "Dateien auswählen",
    fileLabel: "Vom externen Tool zurückgegebenes Dokument",
    fileHint:
      "Formate: .docx, .pptx, .xlsx (sowie .docm, .pptm, .xlsm), .md, .txt. Für ein PDF dessen .md-Datei auswählen.",
    mappingLabel: "Mapping (.json)",
    step2: "Wiederherstellen",
    button: "Wiederherstellen",
    willDownload: "Das wiederhergestellte Dokument wird heruntergeladen.",
    needFiles: "Wählen Sie zuerst Dokument und Mapping aus.",
    unknown: (n) =>
      n === 1
        ? "1 Token fehlt im Mapping und wurde unverändert gelassen."
        : `${n} Tokens fehlen im Mapping und wurden unverändert gelassen.`,
    unknownBody: "Gehört das Mapping zu diesem Dokument? Trotzdem heruntergeladen: ",
    success: "Dokument wiederhergestellt.",
    downloaded: "Heruntergeladen: ",
    more: "Erneut herunterladen, Wiederherstellungsbericht",
    moreIntro: "Einzelne Dateien:",
    dlDocument: "Wiederhergestelltes Dokument",
    dlReport: "Wiederherstellungsbericht",
  },

  banner: {
    warning: "Warnung",
    success: "Erfolg",
    error: "Fehler",
    info: "Information",
    warnings: (n, beforeSending) => `${pl(n, "Warnung", "Warnungen")}${beforeSending ? " – vor dem Senden lesen" : ""}`,
  },

  fileDrop: {
    choose: "Datei auswählen",
    orDrop: "oder hierher ziehen",
    remove: "entfernen",
    removeLabel: (name) => `${name} entfernen`,
  },

  formatsHint: {
    formats: "Formate: .docx, .pptx, .xlsx (sowie .docm, .pptm, .xlsm), .pdf, .md, .txt.",
    legacyQuestion: "Und .doc, .xls, .ppt?",
    legacyAnswer:
      "Alte Binärformate von Office 97-2003: polyjuice bearbeitet nur die aktuellen XML-Formate. Öffnen Sie die Datei in Word, Excel oder PowerPoint, Datei → Speichern unter → .docx, .xlsx oder .pptx, und wählen Sie dann diese Datei aus.",
    otherFormats: "Dasselbe gilt für .rtf, .odt, .ods, .odp und .csv.",
  },

  names: {
    label: "Namensglossar",
    optional: "(optional)",
    load: ".txt laden",
    save: "Als .txt speichern",
    fileName: "glossar.txt",
    clear: "Leeren",
    help: "Werden immer ersetzt, auch wenn die KI sie übersieht. Ein Name pro Zeile, wie im Dokument geschrieben; # für einen Kommentar. Gilt für „Anonymisieren“ und „Prüfen“.",
    placeholder: "Thomas Müller\nAnna Schmidt",
    count: (n) => `${pl(n, "Eintrag", "Einträge")}.`,
    remembered: "In diesem Browser gespeichert.",
    notRemembered: "Nicht gespeichert: geht beim Neuladen verloren.",
    remember: "Dieses Glossar in diesem Browser speichern",
    rememberNote:
      "Bleibt gespeichert, bis Sie das Häkchen entfernen oder auf „Leeren“ klicken. Nicht auf gemeinsam genutzten Rechnern.",
    unavailable:
      "Nicht verfügbar: lokaler Speicher blockiert (privates Fenster?). Um das Glossar zu behalten, „Als .txt speichern“ verwenden.",
    saveFailed: "⚠ Speichern nicht möglich (Speicher voll oder blockiert). „Als .txt speichern“ verwenden.",
  },

  ner: {
    label: (mb) => `Namenserkennung per KI aktivieren (ca. ${mb} MB, einmaliger Download)`,
    note: "Personen und Orte. Das Modell bleibt im Browser-Cache; Ihre Dokumente werden nie gesendet.",
    progressLabel: "Laden des KI-Erkennungsmodells",
    initializing: "Modell wird initialisiert…",
    downloading: (pct, loadedMb, totalMb) => `Modell wird heruntergeladen: ${pct} % (${loadedMb} von ${totalMb} MB)`,
    preparing: "Modell wird vorbereitet…",
    cancel: "Download abbrechen",
    ready: "✓ Modell bereit.",
    backend: (backend) => ` Berechnung: ${backend}.`,
  },

  preflight: {
    pending: "Suche nach Kommentaren und nachverfolgten Änderungen…",
    comments: (n) => pl(n, "Kommentar", "Kommentare"),
    revisions: (n) => pl(n, "nachverfolgte Änderung", "nachverfolgte Änderungen"),
    notes: (n) => pl(n, "Notiz", "Notizen"),
    namesStay: (n) =>
      n === 1
        ? "Der Name dieser Person bleibt im anonymisierten Dokument im Klartext."
        : "Die Namen dieser Personen bleiben im anonymisierten Dokument im Klartext.",
    listStays: "Diese Namen bleiben im anonymisierten Dokument im Klartext.",
    textToo: "Auch ihr Text wird nicht anonymisiert.",
    docx: {
      contains: (found, authors) => `Dieses Dokument enthält ${found.join(" und ")}${byPeople(authors)}.`,
      remove: (revisions, comments) =>
        `Zum Entfernen: in Word, Registerkarte Überprüfen → ${[
          ...(revisions ? ["Annehmen → Alle Änderungen annehmen"] : []),
          ...(comments ? ["Löschen → Alle Kommentare im Dokument löschen"] : []),
        ].join(", dann ")}; ${AGAIN}`,
      peopleListToo: "Die Datei listet außerdem die Personen auf, die sie kommentiert oder geändert haben.",
      peopleList: "Dieses Dokument listet die Personen auf, die es kommentiert oder geändert haben.",
      tracking: "In diesem Dokument ist „Änderungen nachverfolgen“ aktiviert.",
      trackingDetail: (also) =>
        `${also ? "Außerdem ist „Änderungen nachverfolgen“ aktiviert: J" : "J"}ede spätere Änderung würde mit dem Namen der Person gespeichert, die sie vornimmt. Zum Deaktivieren: Registerkarte Überprüfen → Änderungen nachverfolgen; ${AGAIN}`,
    },
    pptx: {
      peopleList: "Diese Präsentation listet die Personen auf, die sie kommentiert haben.",
      contains: (comments, authors) =>
        `Diese Präsentation enthält ${pl(comments, "Kommentar", "Kommentare")}${byPeople(authors)}.`,
      remove: `Zum Entfernen: in PowerPoint, Registerkarte Überprüfen → Löschen → Alle Kommentare in dieser Präsentation löschen; ${AGAIN}`,
    },
    xlsx: {
      peopleList: "Diese Arbeitsmappe listet die Personen auf, die sie kommentiert haben.",
      contains: (found, authors) => `Diese Arbeitsmappe enthält ${found.join(" und ")}${byPeople(authors)}.`,
      remove: `Zum Entfernen: in Excel auf jedem Blatt Strg+A, dann Registerkarte Start → Löschen → Kommentare und Notizen löschen; ${AGAIN}`,
    },
  },

  recap: {
    label: "Verarbeitete Dateien",
    edit: "Einstellungen ändern",
    restart: "↺ Neu beginnen",
  },

  reports: {
    detection: "Erkennungsbericht",
    ner: (on) => `KI-Erkennung: ${on ? "aktiviert" : "deaktiviert"}`,
    stillDetected: "Weiterhin erkannte Elemente",
    unchanged: "(nicht geändert)",
    restore: "Wiederherstellungsbericht",
    unknownTokens: "Unbekannte Tokens (unverändert gelassen):",
    restored: (tokens, occurrences) =>
      `${pl(tokens, "Token wiederhergestellt", "Tokens wiederhergestellt")} (${occurrences} Vorkommen).`,
    missing: (n) =>
      n === 1
        ? "1 Token aus dem Mapping wurde in diesem Dokument nicht gefunden (Information)"
        : `${n} Tokens aus dem Mapping wurden in diesem Dokument nicht gefunden (Information)`,
  },

  running: {
    downloading: (pct) => `Download des KI-Modells: ${pct} %, danach beginnt die Verarbeitung.`,
    initializing: "KI-Modell wird initialisiert…",
    preparing: "KI-Modell wird vorbereitet…",
    progress: (done, total) => `Verarbeitung: ${done} / ${total} Segmente`,
    reading: "Dokument wird gelesen…",
    cancel: "Abbrechen",
    progressLabel: "Verarbeitungsfortschritt",
  },

  step: (n) => `Schritt ${n}: `,
  timer: { elapsed: "Verstrichene Zeit", duration: "Verarbeitungsdauer" },
  errors: {
    cancelled: "Verarbeitung abgebrochen.",
    unexpected: (detail) => `Unerwarteter Fehler: ${detail}`,
  },
};
