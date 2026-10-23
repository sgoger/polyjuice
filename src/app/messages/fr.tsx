// Textes de l'interface, en français (langue de référence : de.tsx suit la même structure).
import type { ReactNode } from "react";
import { agree, pl } from "../../engine/plural.ts";

const AGAIN = "enregistrez, puis déposez à nouveau le fichier.";
function byAuthors(n: number): string {
  return n === 1 ? " d'un auteur" : n > 1 ? ` de ${n} auteurs` : "";
}

export const fr = {
  languageName: "Français",
  languageLabel: "Langue",
  tagline: "Pseudonymisez un document avant de l'envoyer à un outil externe, puis restaurez les données d'origine.",
  tabs: { label: "Actions", anonymize: "Anonymiser", restore: "Restaurer", check: "Vérifier (facultatif)" },
  footer:
    "🔒 Aucune donnée ne quitte votre navigateur. Les documents produits restent des données personnelles (RGPD).",
  backend: {
    webgpu: "WebGPU (carte graphique)",
    wasm: (threads: number) => `WASM, ${threads} ${threads > 1 ? "cœurs" : "cœur"}`,
  },
  result: "Résultat",

  anonymize: {
    recapNer: (on: boolean): string => (on ? "Détection IA" : "Sans détection IA"),
    recapNames: (n: number) => pl(n, "nom", "noms"),
    recapColumns: (columns: string) => `Colonnes : ${columns}`,
    recapMapping: (name: string) => `Mapping réutilisé : ${name}`,
    intro: (
      <>
        <strong>Anonymisez</strong> le document, <strong>envoyez</strong>-le à l'outil externe (IA, traduction…), puis{" "}
        <strong>restaurez</strong> sa réponse dans « Restaurer ».
      </>
    ) as ReactNode,
    step1: "Déposer le document",
    fileLabel: "Document à anonymiser",
    step2: "Options",
    xlsxNoNer:
      "Détection par IA indisponible pour les classeurs : seuls les motifs (e-mails, téléphones, IBAN…), le glossaire et les colonnes ci-dessous sont utilisés.",
    columnsLabel: "Colonnes à anonymiser",
    columnsHint: "(en-têtes séparés par des virgules)",
    columnsPlaceholder: "Nom, Prénom",
    columnsHelp: "Cellules texte remplacées entièrement, sur chaque feuille (en-tête = première ligne non vide).",
    advanced: "Options avancées",
    advancedMapping: (name: string) => ` (mapping réutilisé : ${name})`,
    mappingLabel: "Réutiliser un mapping (facultatif)",
    mappingHint: "Mêmes tokens ; le mapping est complété, jamais tronqué.",
    step3: "Anonymiser",
    button: "Anonymiser",
    willDownload: "Une archive .zip sera téléchargée.",
    needFile: "Déposez d'abord un document.",
    success: (n: number) => `Document anonymisé : ${pl(n, "entité remplacée", "entités remplacées")}.`,
    archiveDownloaded: "Archive téléchargée : ",
    roleSend: "Envoyer",
    roleOrSend: "Ou envoyer",
    roleKeep: "Garder, ne jamais envoyer",
    sendDocument: "à transmettre à l'outil externe",
    sendOnly: "seul fichier à transmettre",
    sendAlternate: "version texte, si l'outil lit mal les PDF",
    keepMapping: "données en clair, pour restaurer",
    more: "Télécharger à nouveau, rapport de détection",
    moreIntro: "Fichiers séparés :",
    dlArchive: "Archive (.zip)",
    dlDocument: "Document anonymisé",
    dlAlternate: "Version texte (Markdown)",
    dlMapping: "Mapping (JSON)",
    dlMappingNote: "Données en clair : ne jamais le transmettre.",
    dlReport: "Rapport (Markdown)",
    checkHint: "Contrôle facultatif avant l'envoi : onglet « Vérifier ».",
    pdfTitle: "PDF : réécrit si possible, sinon converti en texte",
    pdfBody:
      "Les données sont remplacées par des tokens dans le PDF, mise en page conservée, avec en plus une version texte (.md). Si le PDF ne peut pas être réécrit sans risque (police particulière, PDF chiffré, formulaire, scan…), seul le .md est produit.",
    learnMore: "En savoir plus",
  },

  check: {
    clean: "Rien de détecté.",
    intro: "Facultatif : repère ce qui ressemble encore à une donnée personnelle dans un document déjà anonymisé.",
    step1: "Déposer le document anonymisé",
    fileLabel: "Document anonymisé à vérifier",
    step2: "Options",
    xlsxNoNer: "Détection par IA indisponible pour les classeurs.",
    step3: "Vérifier",
    button: "Vérifier",
  },

  restore: {
    intro: "Remet les données d'origine à la place des tokens, grâce au mapping (le .json de l'archive).",
    step1: "Déposer les fichiers",
    fileLabel: "Document renvoyé par l'outil externe",
    fileHint: "Formats : .docx, .pptx, .xlsx (et .docm, .pptm, .xlsm), .md, .txt. Pour un PDF, déposez son .md.",
    mappingLabel: "Mapping (.json)",
    step2: "Restaurer",
    button: "Restaurer",
    willDownload: "Le document restauré sera téléchargé.",
    needFiles: "Déposez d'abord le document et le mapping.",
    unknown: (n: number) =>
      `${pl(n, "token absent", "tokens absents")} du mapping, ${agree(n, "laissé tel quel", "laissés tels quels")}.`,
    unknownBody: "Le mapping correspond-il à ce document ? Téléchargé quand même : ",
    success: "Document restauré.",
    downloaded: "Téléchargé : ",
    more: "Télécharger à nouveau, rapport de restauration",
    moreIntro: "Fichiers séparés :",
    dlDocument: "Document restauré",
    dlReport: "Rapport de restauration",
  },

  banner: {
    warning: "Avertissement",
    success: "Succès",
    error: "Erreur",
    info: "Information",
    warnings: (n: number, beforeSending: boolean) =>
      `${pl(n, "avertissement", "avertissements")}${beforeSending ? " — à lire avant l'envoi" : ""}`,
  },

  fileDrop: {
    choose: "Choisir un fichier",
    orDrop: "ou glisser-déposer ici",
    remove: "retirer",
    removeLabel: (name: string) => `Retirer ${name}`,
  },

  formatsHint: {
    formats: "Formats : .docx, .pptx, .xlsx (et .docm, .pptm, .xlsm), .pdf, .md, .txt.",
    legacyQuestion: "Et les .doc, .xls, .ppt ?",
    legacyAnswer:
      "Anciens formats binaires d'Office 97-2003 : polyjuice ne modifie que les formats XML actuels. Ouvrez le fichier dans Word, Excel ou PowerPoint, Fichier → Enregistrer sous → .docx, .xlsx ou .pptx, puis déposez ce fichier.",
    otherFormats: "Idem pour .rtf, .odt, .ods, .odp et .csv.",
  },

  names: {
    label: "Glossaire de noms",
    optional: "(facultatif)",
    load: "Charger un .txt",
    save: "Enregistrer en .txt",
    fileName: "glossaire.txt",
    clear: "Effacer",
    help: "Toujours remplacés, même si l'IA les manque. Un nom par ligne, écrit comme dans le document ; # pour un commentaire. Commun à « Anonymiser » et « Vérifier ».",
    placeholder: "Thomas Rivière\nJean Dupont",
    count: (n: number) => `${pl(n, "terme", "termes")}.`,
    remembered: "Mémorisé dans ce navigateur.",
    notRemembered: "Non mémorisé : perdu au rechargement.",
    remember: "Mémoriser ce glossaire dans ce navigateur",
    rememberNote:
      "Conservé jusqu'à ce que vous décochiez la case ou cliquiez sur « Effacer ». Pas sur un poste partagé.",
    unavailable:
      "Indisponible : stockage local bloqué (navigation privée ?). Pour conserver le glossaire, utilisez « Enregistrer en .txt ».",
    saveFailed: "⚠ Mémorisation impossible (stockage plein ou bloqué). Utilisez « Enregistrer en .txt ».",
  },

  ner: {
    label: (mb: number) => `Activer la détection de noms par IA (~${mb} Mo, téléchargé une fois)`,
    note: "Personnes et lieux. Le modèle est gardé en cache par le navigateur ; vos documents ne sont jamais envoyés.",
    progressLabel: "Chargement du modèle de détection par IA",
    initializing: "Initialisation du modèle…",
    downloading: (pct: number, loadedMb: number, totalMb: number) =>
      `Téléchargement du modèle : ${pct} % (${loadedMb} Mo sur ${totalMb} Mo)`,
    preparing: "Préparation du modèle…",
    cancel: "Annuler le téléchargement",
    ready: "✓ Modèle prêt.",
    backend: (backend: string) => ` Calcul : ${backend}.`,
  },

  preflight: {
    pending: "Recherche de commentaires et de révisions…",
    comments: (n: number) => pl(n, "commentaire", "commentaires"),
    revisions: (n: number) => pl(n, "révision", "révisions"),
    notes: (n: number) => pl(n, "note", "notes"),
    namesStay: (n: number) =>
      `${agree(n, "Le nom de l'auteur restera", "Les noms des auteurs resteront")} en clair dans le document anonymisé.`,
    listStays: "Ces noms resteront en clair dans le document anonymisé.",
    textToo: "Leur texte n'est pas anonymisé non plus.",
    docx: {
      contains: (found: string[], authors: number) =>
        `Ce document contient ${found.join(" et ")}${byAuthors(authors)}.`,
      remove: (revisions: boolean, comments: boolean) =>
        `Pour les retirer : dans Word, onglet Révision → ${[
          ...(revisions ? ["Accepter → Accepter toutes les modifications"] : []),
          ...(comments ? ["Supprimer → Supprimer tous les commentaires du document"] : []),
        ].join(", puis ")} ; ${AGAIN}`,
      peopleListToo: "Le fichier liste aussi les personnes qui l'ont commenté ou révisé.",
      peopleList: "Ce document liste les personnes qui l'ont commenté ou révisé.",
      tracking: "Le suivi des modifications est activé dans ce document.",
      trackingDetail: (also: boolean) =>
        `${also ? "Le suivi des modifications est aussi activé : t" : "T"}oute modification ultérieure porterait le nom de son auteur. Pour le désactiver : onglet Révision → Suivi des modifications ; ${AGAIN}`,
    },
    pptx: {
      peopleList: "Cette présentation liste les auteurs de ses commentaires.",
      contains: (comments: number, authors: number) =>
        `Cette présentation contient ${pl(comments, "commentaire", "commentaires")}${byAuthors(authors)}.`,
      remove: `Pour les retirer : dans PowerPoint, onglet Révision → Supprimer → Supprimer tous les commentaires de la présentation ; ${AGAIN}`,
    },
    xlsx: {
      peopleList: "Ce classeur liste les auteurs de ses commentaires.",
      contains: (found: string[], authors: number) =>
        `Ce classeur contient ${found.join(" et ")}${byAuthors(authors)}.`,
      remove: `Pour les retirer : dans Excel, sur chaque feuille, Ctrl+A puis onglet Accueil → Effacer → Effacer les commentaires et les notes ; ${AGAIN}`,
    },
  },

  recap: {
    label: "Fichiers traités",
    edit: "Modifier les réglages",
    restart: "↺ Recommencer",
  },

  reports: {
    detection: "Rapport de détection",
    ner: (on: boolean) => `Détection par IA : ${on ? "activée" : "désactivée"}`,
    stillDetected: "Éléments encore détectés",
    unchanged: "(non modifié)",
    restore: "Rapport de restauration",
    unknownTokens: "Tokens inconnus (laissés tels quels) :",
    restored: (tokens: number, occurrences: number) =>
      `${pl(tokens, "token restauré", "tokens restaurés")} (${pl(occurrences, "occurrence", "occurrences")}).`,
    missing: (n: number) =>
      `${pl(n, "token du mapping non retrouvé", "tokens du mapping non retrouvés")} dans ce document (information)`,
  },

  running: {
    downloading: (pct: number) => `Téléchargement du modèle d'IA : ${pct} %, le traitement suivra.`,
    initializing: "Initialisation du modèle d'IA…",
    preparing: "Préparation du modèle d'IA…",
    progress: (done: number, total: number) => `Traitement : ${done} / ${total} segments`,
    reading: "Lecture du document…",
    cancel: "Annuler",
    progressLabel: "Progression du traitement",
  },

  step: (n: number) => `Étape ${n} : `,
  timer: { elapsed: "Temps écoulé", duration: "Durée du traitement" },
  errors: {
    cancelled: "Traitement annulé.",
    unexpected: (detail: string) => `Erreur inattendue : ${detail}`,
  },
};

export type UiMessages = typeof fr;
