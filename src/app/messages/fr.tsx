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
        <p>
          polyjuice remplace les données personnelles d'un document (noms, e-mails, téléphones, IBAN…) par des codes,
          pour pouvoir le confier à un outil externe (IA, traduction…), puis remet les vraies données dans sa réponse.
        </p>
        <p>
          Tout se passe dans votre navigateur : aucun document ni aucune donnée n'est envoyé sur un serveur. Le modèle
          d'IA qui repère les noms est téléchargé une fois, puis fonctionne sur votre ordinateur.
        </p>
        <ol>
          <li>
            <strong>Anonymisez</strong> le document ici.
          </li>
          <li>
            <strong>Envoyez</strong> le document anonymisé à l'outil externe.
          </li>
          <li>
            <strong>Restaurez</strong> sa réponse dans l'onglet « Restaurer », avec le mapping : le fichier .json de
            l'archive, qui fait le lien entre chaque code et la donnée d'origine.
          </li>
        </ol>
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
    mappingHint:
      "Déposez le mapping d'une anonymisation précédente pour qu'une même personne garde le même code d'un document à l'autre (utile pour plusieurs documents d'un même dossier). Il est complété avec les nouvelles données ; rien n'en est retiré.",
    step3: "Anonymiser",
    button: "Anonymiser",
    willDownload: "Une archive .zip sera téléchargée.",
    needFile: "Le bouton s'active dès que le document est déposé (étape 1).",
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
    needFiles: "Le bouton s'active dès que le document et le mapping sont déposés (étape 1).",
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
    legacyQuestion: "Mon fichier est en .doc, .xls ou .ppt : que faire ?",
    legacyAnswer:
      "polyjuice n'accepte pas les anciens formats d'Office (97-2003). Ouvrez le fichier dans Word, Excel ou PowerPoint, faites Fichier → Enregistrer sous et choisissez .docx, .xlsx ou .pptx, puis déposez ce nouveau fichier ici.",
    otherFormats: "Même chose pour les fichiers .rtf, .odt, .ods, .odp et .csv.",
  },

  names: {
    label: "Glossaire de noms",
    optional: "(facultatif)",
    load: "Charger un .txt",
    save: "Enregistrer en .txt",
    fileName: "glossaire.txt",
    clear: "Effacer",
    help: "L'IA peut ne pas reconnaître un nom quand il se confond avec un mot courant : dans « Paul Blanc », « Blanc » peut se lire comme une couleur. Ajoutez ici ces noms : ils seront toujours remplacés (type Personne). Un nom par ligne, écrit tel qu'il apparaît dans les documents ; # pour un commentaire. Le même glossaire sert aux onglets Anonymiser et Vérifier ; cochez la case ci-dessous pour le retrouver à chaque visite.",
    placeholder: "Paul Blanc\nThomas Rivière",
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
