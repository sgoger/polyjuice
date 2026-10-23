// Textes de l'interface, en allemand (même structure que fr.tsx).
import type { UiMessages } from "./fr.tsx";

/** Accord en nombre à l'allemande : seul 1 est au singulier (« 0 Einträge »). */
const pl = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

const AGAIN = "speichern Sie die Datei und wählen Sie sie dann erneut aus.";
function byPeople(n: number): string {
  return n === 1 ? " von einer Person" : n > 1 ? ` von ${n} Personen` : "";
}

export const de: UiMessages = {
  languageName: "Deutsch",
  languageLabel: "Sprache",
  tagline:
    "Ein Dokument pseudonymisieren, bevor es an ein externes Tool gesendet wird, und danach die Originaldaten wiederherstellen.",
  tabs: { label: "Aktionen", anonymize: "Anonymisieren", restore: "Wiederherstellen", check: "Prüfen (optional)" },
  footer:
    "🔒 Keine Daten verlassen Ihren Browser. Dieses Tool pseudonymisiert; die erzeugten Dokumente bleiben personenbezogene Daten im Sinne der DSGVO.",
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
        Das Dokument hier <strong>anonymisieren</strong>, das anonymisierte Dokument an das externe Tool (KI,
        Übersetzung…) <strong>senden</strong> und dessen Antwort anschließend im Tab „Wiederherstellen“ mit dem Mapping{" "}
        <strong>wiederherstellen</strong>.
      </>
    ),
    step1: "Dokument auswählen",
    fileLabel: "Zu anonymisierendes Dokument",
    step2: "Optionen",
    xlsxNoNer:
      "Für Arbeitsmappen ist keine KI-Erkennung verfügbar: Die Daten werden über Muster (E-Mail-Adressen, Telefonnummern, IBAN…), über das Namensglossar und über die unten angegebenen Spalten erkannt.",
    columnsLabel: "Zu anonymisierende Spalten",
    columnsHint: "(Spaltenüberschriften, durch Kommas getrennt)",
    columnsPlaceholder: "Name, Vorname",
    columnsHelp:
      "Alle Textzellen dieser Spalten werden auf jedem Tabellenblatt vollständig ersetzt (Überschrift = erste nicht leere Zeile).",
    advanced: "Erweiterte Optionen",
    advancedMapping: (name) => ` (wiederverwendetes Mapping: ${name})`,
    mappingLabel: "Vorhandenes Mapping wiederverwenden (optional)",
    mappingHint: "Verwendet denselben Salt und dieselben Tokens; das Mapping wird ergänzt, nie gekürzt.",
    step3: "Anonymisieren",
    button: "Anonymisieren",
    willDownload: "Ein .zip-Archiv wird automatisch heruntergeladen.",
    needFile: "Wählen Sie zuerst ein Dokument aus (Schritt 1).",
    success: (n) => `Dokument anonymisiert: ${pl(n, "Entität ersetzt", "Entitäten ersetzt")}.`,
    archiveDownloaded: "Heruntergeladenes Archiv: ",
    roleSend: "Senden",
    roleOrSend: "Oder senden",
    roleKeep: "Behalten, niemals senden",
    sendDocument: "Dokument, das an das externe Tool übermittelt wird",
    sendOnly: "einzige Datei, die an das externe Tool übermittelt wird",
    sendAlternate: "gleicher Inhalt als Text, für Tools, die PDFs schlecht lesen",
    keepMapping: "Daten im Klartext, für die Wiederherstellung erforderlich",
    more: "Erneut herunterladen, Erkennungsbericht",
    moreIntro: "Falls der Download nicht gestartet ist, oder für eine einzelne Datei:",
    dlArchive: "Archiv (.zip)",
    dlDocument: "Anonymisiertes Dokument",
    dlAlternate: "Textversion (Markdown)",
    dlMapping: "Mapping (JSON)",
    dlMappingNote: "Daten im Klartext: niemals weitergeben.",
    dlReport: "Bericht (Markdown)",
    checkHint: "Optionale Kontrolle vor dem Senden: das anonymisierte Dokument im Tab „Prüfen“ auswählen.",
    pdfTitle: "PDF: umgeschrieben, wenn das gefahrlos möglich ist, sonst in Text umgewandelt",
    pdfBody:
      "Die erkannten Daten werden aus dem PDF entfernt und durch Tokens ersetzt, das Layout bleibt erhalten; zusätzlich wird eine Textversion (.md) erzeugt. Stehen Daten in einem Text, den das Tool nicht mit Sicherheit umschreiben kann (besondere Schriftart, verschlüsseltes PDF, Formular, gescanntes PDF…), wird nur die .md-Datei erzeugt: Ein PDF ist kein bearbeitbarer Text, sondern eine Folge einzeln positionierter Glyphen.",
    learnMore: "Mehr erfahren",
  },

  check: {
    clean: "Nichts erkannt: keine personenbezogenen Daten gefunden.",
    intro:
      "Optional: Führt die Erkennung erneut auf einem bereits anonymisierten Dokument aus (zum Beispiel einem seither bearbeiteten) und listet auf, was noch nach personenbezogenen Daten aussieht. Es wird keine Datei erzeugt.",
    step1: "Anonymisiertes Dokument auswählen",
    fileLabel: "Zu prüfendes anonymisiertes Dokument",
    step2: "Optionen",
    xlsxNoNer: "Für Arbeitsmappen ist keine KI-Erkennung verfügbar.",
    step3: "Prüfen",
    button: "Prüfen",
  },

  restore: {
    intro:
      "Ersetzt die Tokens im vom externen Tool zurückgegebenen Dokument mithilfe des Mappings (der .json-Datei aus dem Archiv) durch die Originaldaten.",
    step1: "Dateien auswählen",
    fileLabel: "Vom externen Tool zurückgegebenes Dokument",
    fileHint:
      "Formate: .docx, .pptx, .xlsx (sowie .docm, .pptm, .xlsm), .md, .txt (für ein anonymisiertes PDF die erzeugte .md-Datei auswählen).",
    mappingLabel: "Bei der Anonymisierung erzeugtes Mapping (.json)",
    step2: "Wiederherstellen",
    button: "Wiederherstellen",
    willDownload: "Das wiederhergestellte Dokument wird automatisch heruntergeladen.",
    needFiles: "Wählen Sie zuerst das Dokument und das Mapping aus (Schritt 1).",
    unknown: (n) =>
      n === 1
        ? "1 Token fehlt im Mapping und wurde unverändert gelassen."
        : `${n} Tokens fehlen im Mapping und wurden unverändert gelassen.`,
    unknownBody: "Prüfen Sie, ob das Mapping zu diesem Dokument gehört. Trotzdem heruntergeladen: ",
    success: "Dokument wiederhergestellt.",
    downloaded: "Heruntergeladen: ",
    more: "Erneut herunterladen, Wiederherstellungsbericht",
    moreIntro: "Falls der Download nicht gestartet ist, oder für den Bericht:",
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
    formats: "Formate: .docx, .pptx, .xlsx (und ihre Varianten mit Makros .docm, .pptm, .xlsm), .pdf, .md, .txt.",
    legacyQuestion: "Und .doc, .xls, .ppt?",
    legacyAnswer:
      "Das sind die alten Binärformate von Office 97-2003. polyjuice bearbeitet Office-Dokumente direkt in ihrem XML, ohne den Rest anzutasten (Formatierung, Bilder, Diagramme); die Binärformate haben diese Struktur nicht. Öffnen Sie die Datei in Word, Excel oder PowerPoint, Datei → Speichern unter → .docx, .xlsx oder .pptx, und wählen Sie dann diese Datei aus.",
    otherFormats:
      "Dasselbe gilt für .rtf, .odt, .ods, .odp und .csv: Speichern Sie sie zuerst im Format .docx, .xlsx oder .pptx.",
  },

  names: {
    label: "Namensglossar",
    optional: "(optional)",
    load: ".txt laden",
    save: "Als .txt speichern",
    fileName: "glossar.txt",
    clear: "Leeren",
    help: "Die hier aufgeführten Namen werden immer ersetzt (Typ Person), auch wenn die KI-Erkennung sie übersieht. Ein Name pro Zeile, so geschrieben, wie er in den Dokumenten vorkommt („Thomas Müller“); # für einen Kommentar. Dasselbe Glossar gilt für die Tabs „Anonymisieren“ und „Prüfen“.",
    placeholder: "Thomas Müller\nAnna Schmidt",
    count: (n) => `${pl(n, "Eintrag", "Einträge")}.`,
    remembered: "In diesem Browser gespeichert.",
    notRemembered: "Nicht gespeichert: geht beim Neuladen der Seite verloren.",
    remember: "Dieses Glossar in diesem Browser speichern",
    rememberNote:
      "Das Glossar bleibt auf diesem Computer in diesem Browser gespeichert, bis Sie das Häkchen entfernen oder auf „Leeren“ klicken. Aktivieren Sie diese Option nicht auf einem gemeinsam genutzten Rechner.",
    unavailable:
      "Nicht verfügbar: Dieser Browser blockiert den lokalen Speicher (privates Fenster?). Das Glossar geht beim Neuladen der Seite verloren; verwenden Sie „Als .txt speichern“, um es zu behalten.",
    saveFailed:
      "⚠ Das Glossar konnte nicht gespeichert werden (Speicher voll oder blockiert). Verwenden Sie „Als .txt speichern“, um es zu behalten.",
  },

  ner: {
    label: (mb) => `Namenserkennung per KI aktivieren (Modell wird einmalig heruntergeladen, ca. ${mb} MB)`,
    note: "Erkennt Namen von Personen und Orten. Das Modell wird einmalig beim ersten ausgewählten Dokument heruntergeladen und danach vom Browser zwischengespeichert; es werden keine Daten aus Ihren Dokumenten gesendet.",
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
    listStays: "Ihre Namen bleiben im anonymisierten Dokument im Klartext.",
    docx: {
      contains: (found, authors) => `Dieses Dokument enthält ${found.join(" und ")}${byPeople(authors)}.`,
      remove: (revisions, comments) =>
        `Um sie vor dem Anonymisieren zu entfernen: in Word auf der Registerkarte Überprüfen → ${[
          ...(revisions ? ["Annehmen → Alle Änderungen annehmen"] : []),
          ...(comments ? ["Löschen → Alle Kommentare im Dokument löschen"] : []),
        ].join(", dann ")}; ${AGAIN}`,
      peopleListToo:
        "Die Datei enthält außerdem die Liste der Personen, die das Dokument kommentiert oder geändert haben.",
      peopleList: "Dieses Dokument enthält die Liste der Personen, die es kommentiert oder geändert haben.",
      tracking: "In diesem Dokument ist „Änderungen nachverfolgen“ aktiviert.",
      trackingDetail: (also) =>
        `${also ? "Außerdem ist „Änderungen nachverfolgen“ aktiviert: J" : "J"}ede spätere Änderung würde mit dem Namen der Person gespeichert, die sie vornimmt. Zum Deaktivieren: in Word auf der Registerkarte Überprüfen → Änderungen nachverfolgen; ${AGAIN}`,
    },
    pptx: {
      peopleList: "Diese Präsentation enthält die Liste der Personen, die sie kommentiert haben.",
      contains: (comments, authors) =>
        `Diese Präsentation enthält ${pl(comments, "Kommentar", "Kommentare")}${byPeople(authors)}.`,
      textToo: "Auch der Text der Kommentare wird nicht anonymisiert.",
      remove: `Um sie vor dem Anonymisieren zu entfernen: in PowerPoint auf der Registerkarte Überprüfen → Löschen → Alle Kommentare in dieser Präsentation löschen; ${AGAIN}`,
    },
    xlsx: {
      peopleList: "Diese Arbeitsmappe enthält die Liste der Personen, die sie kommentiert haben.",
      contains: (found, authors) => `Diese Arbeitsmappe enthält ${found.join(" und ")}${byPeople(authors)}.`,
      textToo: (comments, notes) =>
        `Auch der Text der ${notes && !comments ? "Notizen" : comments && !notes ? "Kommentare" : "Kommentare und Notizen"} wird nicht anonymisiert.`,
      remove: `Um sie vor dem Anonymisieren zu entfernen: in Excel auf jedem Tabellenblatt alle Zellen markieren (Strg+A), dann Registerkarte Start → Löschen → Kommentare und Notizen löschen; ${AGAIN}`,
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
    downloading: (pct) => `Download des KI-Erkennungsmodells: ${pct} % – die Verarbeitung beginnt danach.`,
    initializing: "KI-Erkennungsmodell wird initialisiert…",
    preparing: "KI-Erkennungsmodell wird vorbereitet…",
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
