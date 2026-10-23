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
  tagline: "Pseudonymiser un document avant de l'envoyer à un outil externe, puis restaurer les données d'origine.",
  tabs: { label: "Actions", anonymize: "Anonymiser", restore: "Restaurer", check: "Vérifier (facultatif)" },
  footer:
    "🔒 Aucune donnée ne quitte votre navigateur. Cet outil pseudonymise ; les documents produits restent des données personnelles au sens du RGPD.",
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
        <strong>Anonymisez</strong> le document ici, <strong>envoyez</strong> le document anonymisé à l'outil externe
        (IA, traduction…), puis <strong>restaurez</strong> sa réponse dans l'onglet « Restaurer » avec le mapping.
      </>
    ) as ReactNode,
    step1: "Déposer le document",
    fileLabel: "Document à anonymiser",
    step2: "Options",
    xlsxNoNer:
      "Détection par IA indisponible pour les classeurs : les données sont repérées par motifs (e-mails, téléphones, IBAN…), par la liste de noms et par les colonnes ci-dessous.",
    columnsLabel: "Colonnes à anonymiser",
    columnsHint: "(en-têtes séparés par des virgules)",
    columnsPlaceholder: "Nom, Prénom",
    columnsHelp:
      "Toutes les cellules texte de ces colonnes sont remplacées intégralement, sur chaque feuille (en-tête = première ligne non vide).",
    advanced: "Options avancées",
    advancedMapping: (name: string) => ` (mapping réutilisé : ${name})`,
    mappingLabel: "Mapping existant à réutiliser (facultatif)",
    mappingHint: "Réutilise le même salt et les mêmes tokens ; le mapping est complété, jamais tronqué.",
    step3: "Anonymiser",
    button: "Anonymiser",
    willDownload: "Une archive .zip sera téléchargée automatiquement.",
    needFile: "Déposez d'abord un document (étape 1).",
    success: (n: number) => `Document anonymisé : ${pl(n, "entité remplacée", "entités remplacées")}.`,
    archiveDownloaded: "Archive téléchargée : ",
    roleSend: "Envoyer",
    roleOrSend: "Ou envoyer",
    roleKeep: "Garder, ne jamais envoyer",
    sendDocument: "document à transmettre à l'outil externe",
    sendOnly: "seul fichier à transmettre à l'outil externe",
    sendAlternate: "même contenu en texte, pour les outils qui lisent mal les PDF",
    keepMapping: "données en clair, nécessaire pour restaurer",
    more: "Télécharger à nouveau, rapport de détection",
    moreIntro: "Si le téléchargement n'a pas démarré, ou pour un seul fichier :",
    dlArchive: "Archive (.zip)",
    dlDocument: "Document anonymisé",
    dlAlternate: "Version texte (Markdown)",
    dlMapping: "Mapping (JSON)",
    dlMappingNote: "Données en clair : ne jamais le transmettre.",
    dlReport: "Rapport (Markdown)",
    checkHint: "Contrôle facultatif avant l'envoi : déposez le document anonymisé dans l'onglet « Vérifier ».",
    pdfTitle: "PDF : réécrit si c'est sans risque, sinon converti en texte",
    pdfBody:
      "Les données détectées sont retirées du PDF et remplacées par des tokens, la mise en page est conservée ; une version texte (.md) est aussi produite. Si une donnée se trouve dans un texte que l'outil ne sait pas réécrire avec certitude (police particulière, PDF chiffré, formulaire, PDF scanné…), seul le .md est produit : un PDF n'est pas un texte modifiable, mais des glyphes positionnés un par un.",
    learnMore: "En savoir plus",
  },

  check: {
    clean: "Rien de détecté : aucune donnée personnelle reconnue.",
    intro:
      "Facultatif : relance la détection sur un document déjà anonymisé (par exemple modifié depuis) et liste ce qui ressemble encore à une donnée personnelle. Rien n'est produit.",
    step1: "Déposer le document anonymisé",
    fileLabel: "Document anonymisé à vérifier",
    step2: "Options",
    xlsxNoNer: "Détection par IA indisponible pour les classeurs.",
    step3: "Vérifier",
    button: "Vérifier",
  },

  restore: {
    intro:
      "Remplace les tokens du document renvoyé par l'outil externe par les données d'origine, grâce au mapping (le fichier .json de l'archive).",
    step1: "Déposer les fichiers",
    fileLabel: "Document renvoyé par l'outil externe",
    fileHint:
      "Formats : .docx, .pptx, .xlsx (et .docm, .pptm, .xlsm), .md, .txt (pour un PDF anonymisé, déposez le .md produit).",
    mappingLabel: "Mapping (.json) produit lors de l'anonymisation",
    step2: "Restaurer",
    button: "Restaurer",
    willDownload: "Le document restauré sera téléchargé automatiquement.",
    needFiles: "Déposez d'abord le document et le mapping (étape 1).",
    unknown: (n: number) =>
      `${pl(n, "token absent", "tokens absents")} du mapping, ${agree(n, "laissé tel quel", "laissés tels quels")}.`,
    unknownBody: "Vérifiez que le mapping correspond à ce document. Téléchargé quand même : ",
    success: "Document restauré.",
    downloaded: "Téléchargé : ",
    more: "Télécharger à nouveau, rapport de restauration",
    moreIntro: "Si le téléchargement n'a pas démarré, ou pour le rapport :",
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
    formats: "Formats : .docx, .pptx, .xlsx (et leurs variantes avec macros .docm, .pptm, .xlsm), .pdf, .md, .txt.",
    legacyQuestion: "Et les .doc, .xls, .ppt ?",
    legacyAnswer:
      "Ce sont les anciens formats binaires d'Office 97-2003. polyjuice modifie les documents Office directement dans leur XML, sans toucher au reste (mise en forme, images, graphiques) ; les formats binaires n'ont pas cette structure. Ouvrez le fichier dans Word, Excel ou PowerPoint, Fichier → Enregistrer sous → .docx, .xlsx ou .pptx, puis déposez ce fichier.",
    otherFormats:
      "Même chose pour .rtf, .odt, .ods, .odp et .csv : enregistrez-les d'abord au format .docx, .xlsx ou .pptx.",
  },

  names: {
    label: "Glossaire de noms",
    optional: "(facultatif)",
    load: "Charger un .txt",
    save: "Enregistrer en .txt",
    fileName: "glossaire.txt",
    clear: "Effacer",
    help: "Les noms listés ici sont toujours remplacés (type Personne), même si la détection par IA les manque. Un nom par ligne, écrit tel qu'il apparaît dans les documents (« Thomas Rivière ») ; # pour un commentaire. Le même glossaire sert aux onglets Anonymiser et Vérifier.",
    placeholder: "Thomas Rivière\nJean Dupont",
    count: (n: number) => `${pl(n, "terme", "termes")}.`,
    remembered: "Mémorisé dans ce navigateur.",
    notRemembered: "Non mémorisé : perdu au rechargement de la page.",
    remember: "Mémoriser ce glossaire dans ce navigateur",
    rememberNote:
      "Le glossaire reste sur cet ordinateur, dans ce navigateur, jusqu'à ce que vous décochiez la case ou cliquiez sur « Effacer ». Ne cochez pas cette case sur un poste partagé.",
    unavailable:
      "Indisponible : ce navigateur bloque le stockage local (navigation privée ?). Le glossaire sera perdu au rechargement de la page ; utilisez « Enregistrer en .txt » pour le conserver.",
    saveFailed:
      "⚠ Le glossaire n'a pas pu être mémorisé (stockage plein ou bloqué). Utilisez « Enregistrer en .txt » pour le conserver.",
  },

  ner: {
    label: (mb: number) => `Activer la détection de noms par IA (modèle téléchargé une fois, ~${mb} Mo)`,
    note: "Repère les noms de personnes et de lieux. Le modèle est téléchargé une fois, au premier document déposé, puis gardé en cache par le navigateur ; aucune donnée de vos documents n'est envoyée.",
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
      `${agree(n, "Le nom de cet auteur restera", "Les noms de ces auteurs resteront")} en clair dans le document anonymisé.`,
    listStays: "Leurs noms resteront en clair dans le document anonymisé.",
    docx: {
      contains: (found: string[], authors: number) =>
        `Ce document contient ${found.join(" et ")}${byAuthors(authors)}.`,
      remove: (revisions: boolean, comments: boolean) =>
        `Pour les retirer avant d'anonymiser : dans Word, onglet Révision → ${[
          ...(revisions ? ["Accepter → Accepter toutes les modifications"] : []),
          ...(comments ? ["Supprimer → Supprimer tous les commentaires du document"] : []),
        ].join(", puis ")} ; ${AGAIN}`,
      peopleListToo: "Le fichier contient aussi la liste des personnes qui l'ont commenté ou révisé.",
      peopleList: "Ce document contient la liste des personnes qui l'ont commenté ou révisé.",
      tracking: "Le suivi des modifications est activé dans ce document.",
      trackingDetail: (also: boolean) =>
        `${also ? "Le suivi des modifications est aussi activé : t" : "T"}oute modification ultérieure serait enregistrée avec le nom de son auteur. Pour le désactiver : dans Word, onglet Révision → Suivi des modifications ; ${AGAIN}`,
    },
    pptx: {
      peopleList: "Cette présentation contient la liste des auteurs de ses commentaires.",
      contains: (comments: number, authors: number) =>
        `Cette présentation contient ${pl(comments, "commentaire", "commentaires")}${byAuthors(authors)}.`,
      textToo: "Le texte des commentaires n'est pas anonymisé non plus.",
      remove: `Pour les retirer avant d'anonymiser : dans PowerPoint, onglet Révision → Supprimer → Supprimer tous les commentaires de la présentation ; ${AGAIN}`,
    },
    xlsx: {
      peopleList: "Ce classeur contient la liste des auteurs de ses commentaires.",
      contains: (found: string[], authors: number) =>
        `Ce classeur contient ${found.join(" et ")}${byAuthors(authors)}.`,
      textToo: (comments: boolean, notes: boolean) =>
        `Le texte des ${notes && !comments ? "notes" : comments && !notes ? "commentaires" : "commentaires et des notes"} n'est pas anonymisé non plus.`,
      remove: `Pour les retirer avant d'anonymiser : dans Excel, sur chaque feuille, sélectionnez toutes les cellules (Ctrl+A), puis onglet Accueil → Effacer → Effacer les commentaires et les notes ; ${AGAIN}`,
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
    downloading: (pct: number) =>
      `Téléchargement du modèle de détection par IA : ${pct} % — le traitement démarrera ensuite.`,
    initializing: "Initialisation du modèle de détection par IA…",
    preparing: "Préparation du modèle de détection par IA…",
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
