// Messages du moteur et des adaptateurs, en français (langue de référence : les autres catalogues
// suivent la même structure, imposée par le type `Messages`).
import { agree, pl } from "../engine/plural.ts";
import type { EntityType, SegmentKind } from "../engine/types.ts";

/** Application et nom du type de fichier dans « Enregistrer sous », par format cible. */
export interface OfficeTarget {
  app: string;
  saveAs: string;
}

export const fr = {
  labels: {
    types: {
      PERSON: "Personne",
      ORGANIZATION: "Organisation",
      LOCATION: "Lieu",
      EMAIL_ADDRESS: "E-mail",
      PHONE_NUMBER: "Téléphone",
      IBAN_CODE: "IBAN",
      CREDIT_CARD: "Carte bancaire",
      URL: "URL",
      IP_ADDRESS: "Adresse IP",
      FR_NIR: "NIR",
    } as Record<EntityType, string>,
    sources: {
      ner: "IA (NER)",
      regex: "motif",
      names: "liste de noms",
      columns: "colonne",
    } as Record<string, string>,
    kinds: {
      body: "corps",
      header: "en-tête",
      footer: "pied de page",
      footnote: "note",
      comment: "commentaire",
      notes: "notes du présentateur",
      cell: "cellule",
    } as Record<SegmentKind, string>,
  },

  /** Séparateur avant un deux-points (espace en français). */
  colon: " : ",
  mappingReminder: "Le mapping contient les données en clair. Ne pas transmettre.",
  cancelled: "Traitement annulé",
  /** « n éléments ressemblent encore à des données personnelles. » (Vérifier) */
  stillLooksPersonal: (n: number) =>
    `${pl(n, "élément ressemble", "éléments ressemblent")} encore à des données personnelles.`,

  report: {
    warnings: "Avertissements",
    none: "Aucun.",
    detectionTitle: (file: string) => `Rapport de détection — ${file}`,
    file: "Fichier",
    format: "Format",
    ner: (on: boolean) => `Détection par IA (NER) : ${on ? "activée" : "désactivée"}`,
    replacedEntities: "Entités distinctes remplacées",
    replacements: "Remplacements",
    token: "Token",
    type: "Type",
    source: "Source",
    occurrences: "Occurrences",
    firstContext: "Contexte (première occurrence)",
    noEntity: "Aucune entité détectée.",
    checkTitle: (file: string) => `Vérification — ${file}`,
    nothingDetected: "Aucune donnée personnelle détectée (les tokens existants sont ignorés).",
    text: "Texte",
    location: "Emplacement",
    context: "Contexte",
    toReport: "À signaler",
    restoreTitle: (file: string) => `Rapport de restauration — ${file}`,
    unknownTokensTitle: "⚠ Erreur : tokens inconnus",
    unknownTokens: (n: number) =>
      `${pl(n, "token au format polyjuice est absent du mapping et a été laissé tel quel", "tokens au format polyjuice sont absents du mapping et ont été laissés tels quels")}. Vérifiez que le mapping correspond bien à ce document.`,
    restoredTokens: "Tokens restaurés",
    noTokenFound: "Aucun token du mapping n'a été trouvé dans ce document.",
    missingTokens: "Tokens du mapping non retrouvés (information)",
  },

  pipeline: {
    noExtension: "Fichier sans extension : format inconnu",
    unreadable: (detail: string) => `Document illisible : ${detail}`,
    nerUnavailable: "Détection par IA indisponible",
    nerLoadFailed: (detail: string) =>
      `Le modèle de détection par IA n'a pas pu être chargé (${detail}). Vérifiez la connexion, ou décochez l'option : la détection par motifs et par liste fonctionne sans réseau.`,
    notice: (where: string, n: number) =>
      `${where} : ${pl(n, "élément contient", "éléments contiennent")} des données personnelles détectées et ${agree(n, "n'est pas modifié", "ne sont pas modifiés")} (« Vérifier » les liste).`,
  },

  mapping: {
    notJson: "Le mapping n'est pas un fichier JSON valide.",
    notObject: "Le mapping doit être un objet JSON.",
    notPolyjuice: "Ce fichier n'est pas un mapping polyjuice (champ schema_version absent).",
    unknownVersion: (found: string, expected: number) =>
      `Version de schéma du mapping inconnue : ${found} (cette version de polyjuice lit la version ${expected}).`,
    invalid: (issues: string) => `Mapping invalide — ${issues}`,
    root: "(racine)",
    saltBytes: (n: number) => `le salt doit faire ${n} octets`,
    invalidToken: (token: string) => `token invalide : ${token}`,
    letterMismatch: (type: string) => `lettre du token incohérente avec le type ${type}`,
  },

  formats: {
    targets: {
      docx: { app: "Word", saveAs: "Document Word (.docx)" },
      xlsx: { app: "Excel", saveAs: "Classeur Excel (.xlsx)" },
      pptx: { app: "PowerPoint", saveAs: "Présentation PowerPoint (.pptx)" },
    } as Record<"docx" | "xlsx" | "pptx", OfficeTarget>,
    reasons: {
      binaryWord: "ancien format binaire Word 97-2003",
      binaryExcel: "ancien format binaire Excel 97-2003",
      binaryPowerPoint: "ancien format binaire PowerPoint 97-2003",
      rtf: "format RTF",
      openDocument: "format OpenDocument",
      template: "modèle",
      binaryWorkbook: "classeur binaire Excel",
      csv: "texte délimité, sans colonnes reconnues",
      slideShow: "diaporama",
    },
    refused: (file: string, ext: string, reason: string, t: OfficeTarget, targetExt: string) =>
      `« ${file} » : .${ext} n'est pas pris en charge (${reason}) : ouvrez-le dans ${t.app}, Fichier → Enregistrer sous → ${t.saveAs}, puis déposez le .${targetExt}.`,
    pdfRestore: (file: string) =>
      `« ${file} » : la restauration ne s'applique pas au .pdf d'origine : déposez le fichier .md (ou .txt) renvoyé par l'outil externe.`,
    notAccepted: (file: string, accepted: string) =>
      `« ${file} » n'est pas pris en charge ici. Formats acceptés : ${accepted}.`,
    empty: (file: string) => `« ${file} » est vide.`,
    oldOffice: (file: string, ext: string, app: string, targetExt: string) =>
      `« ${file} » n'est pas un vrai .${ext} : c'est un fichier Office 97-2003 renommé, ou un fichier protégé par mot de passe. Ouvrez-le dans ${app}, retirez le mot de passe s'il y en a un, et enregistrez-le au format .${targetExt}.`,
    notReal: (file: string, ext: string, app: string, targetExt: string) =>
      `« ${file} » n'est pas un vrai .${ext} : ouvrez-le dans ${app} et enregistrez-le au format .${targetExt}.`,
  },

  ooxml: {
    metadata: {
      creator: "auteur",
      lastModifiedBy: "dernier modificateur",
      title: "titre",
      subject: "sujet",
      keywords: "mots-clés",
      description: "description",
      category: "catégorie",
      contentStatus: "statut",
      Company: "société",
      Manager: "responsable",
      custom: "propriétés personnalisées",
      thumbnail: "miniature d'aperçu",
    } as Record<string, string>,
    titles: (n: number) =>
      `Propriétés du document (docProps/app.xml) : ${pl(n, "titre recopié", "titres recopiés")} (noms de feuilles, titres de diapositives…), conservés tels quels.`,
    metadataCleared: (labels: string) =>
      `Métadonnées vidées : ${labels} (dates de création et de modification neutralisées).`,
    altText: "Texte alternatif",
    linkTarget: "Cible de lien",
    media: (n: number) =>
      `${pl(n, "image ou média présent", "images ou médias présents")} : le texte contenu dans les images n'est pas traité.`,
    smartArt: "SmartArt présents : leur texte n'est pas traité.",
    charts: "Graphiques présents : leur texte n'est pas traité.",
    ole: (n: number) =>
      `${pl(n, "objet incorporé (OLE) présent", "objets incorporés (OLE) présents")} : leur contenu n'est pas traité.`,
    macros: (part: string) => `Macros présentes (${part}) : copiées telles quelles, non analysées.`,
    partUnreadable: (part: string, detail: string) => `Partie illisible, non traitée : ${part} (${detail}).`,
    invalidXml: (detail: string) => `XML invalide : ${detail}`,
    emptyXml: "document vide",
    invalidZip: "archive zip invalide (répertoire central introuvable)",
    missingPart: (part: string) => `partie absente : ${part}`,
  },

  docx: {
    notWord: "word/document.xml absent : ce n'est pas un document Word",
    fieldCode: "Code de champ",
    deletedRevisions:
      "Révisions supprimées (suivi des modifications) présentes : leur texte reste dans le fichier sans être traité. Acceptez ou rejetez les révisions avant d'anonymiser.",
    customXml:
      "Contrôles de contenu liés à des données XML (customXml) : ces données ne sont pas traitées et Word peut les réafficher à l'ouverture.",
    authors: (n: number) =>
      `${pl(n, "nom d'auteur", "noms d'auteurs")} de commentaires ou de révisions ${agree(n, "reste en clair : il n'est pas anonymisé", "restent en clair : ils ne sont pas anonymisés")}. Pour ${agree(n, "le", "les")} retirer, acceptez toutes les modifications et supprimez tous les commentaires dans Word, puis anonymisez à nouveau.`,
    peopleList: "Liste des personnes ayant commenté ou révisé le document (word/people.xml) conservée telle quelle.",
    trackRevisions:
      "Suivi des modifications activé : toute modification ultérieure du document anonymisé y sera enregistrée avec le nom de son auteur.",
  },

  pptx: {
    notPresentation: "ppt/presentation.xml absent : ce n'est pas une présentation",
    comments: (n: number) =>
      `${pl(n, "commentaire de diapositive", "commentaires de diapositives")} : texte et noms des auteurs restent en clair (non traités). Supprimez les commentaires dans PowerPoint, puis anonymisez à nouveau.`,
    peopleList: "Liste des auteurs de commentaires conservée telle quelle (noms en clair).",
  },

  xlsx: {
    notWorkbook: "xl/workbook.xml absent : ce n'est pas un classeur",
    comments: (n: number) =>
      `${pl(n, "commentaire ou note de cellule", "commentaires ou notes de cellules")} : texte et noms des auteurs restent en clair (non traités). Supprimez-les dans Excel, puis anonymisez à nouveau.`,
    peopleList: "Liste des auteurs de commentaires (xl/persons) conservée telle quelle (noms en clair).",
    formulaResult: "Résultat de formule",
    headerFooter: "En-tête ou pied de page de feuille",
    pivotTables: "Tableaux croisés dynamiques présents : leur cache (copie des données sources) n'est pas traité.",
    externalLinks: "Liaisons vers d'autres classeurs présentes : leurs valeurs en cache ne sont pas traitées.",
    sheetName: "Nom de feuille",
    workbookUnreadable: "Partie illisible : xl/workbook.xml (noms de feuilles non vérifiés).",
    sharedStrings: (n: number) =>
      `${pl(n, "chaîne partagée des colonnes anonymisées est utilisée", "chaînes partagées des colonnes anonymisées sont utilisées")} dans plusieurs colonnes : toutes les cellules qui les utilisent sont remplacées.`,
  },

  text: {
    unclosedFence: "Bloc de code Markdown non refermé : tout le texte qui suit l'ouverture du bloc n'est pas traité.",
  },

  pdf: {
    scanned: (charsPerPage: number) =>
      `PDF probablement scanné (${charsPerPage} caractères par page en moyenne) : le texte contenu dans les images n'est pas extrait (pas d'OCR).`,
    pagesWithImages: (n: number) =>
      `${pl(n, "page contient", "pages contiennent")} des images : le texte contenu dans les images n'est pas traité.`,
    notRewrittenScanned:
      "PDF non réécrit (probablement scanné) : seul le texte est produit, en Markdown (.md) ; la mise en forme d'origine n'est pas conservée.",
    notRewritten: (reason: string) =>
      `PDF non réécrit (${reason}) : seul le texte est produit, en Markdown (.md) ; la mise en forme d'origine n'est pas conservée.`,
    unexpected: (detail: string) => `erreur inattendue : ${detail}`,
    rewritten:
      "PDF réécrit : les données détectées sont retirées du fichier et remplacées par des tokens (affichés entre [ ], copiés avec ⟦ ⟧), la mise en page est conservée. Une version texte (.md) est aussi produite.",
    removed: (parts: string) => `Retirés du PDF produit : ${parts}.`,
    removedParts: {
      metadata: "les métadonnées (titre, auteur…)",
      annotations: (n: number) => `${n} annotation${n > 1 ? "s" : ""} (liens, commentaires…)`,
      outlines: "les signets",
      structure: "la structure d'accessibilité (PDF balisé)",
      attachments: "les fichiers joints",
      scripts: "les actions et scripts",
    },
    form: "formulaire PDF",
    layers: "calques (contenu optionnel)",
    encrypted: "PDF chiffré",
    unsupportedStructure: "structure du PDF non prise en charge",
    unreadableStream: (detail: string) => `flux de contenu illisible (${detail})`,
    ocr: "texte invisible superposé à une image (PDF océrisé)",
    cause: (fonts: string) => ` ; en cause : ${fonts}`,
    doesNotOpen: "le PDF produit ne s'ouvre pas",
    notRemoved: (n: number) =>
      n > 1
        ? `${n} valeurs détectées n'ont pas pu être retirées du texte du PDF`
        : `${n} valeur détectée n'a pas pu être retirée du texte du PDF`,
    unreadableTokens: (n: number) => `${n} token${n > 1 ? "s" : ""} illisible${n > 1 ? "s" : ""} dans le PDF produit`,
    remainsInStructure: (n: number) =>
      n > 1
        ? `${n} valeurs détectées subsistent dans la structure du PDF`
        : `${n} valeur détectée subsiste dans la structure du PDF`,
    fonts: {
      noWidths: "police sans table de chasses",
      composite: (encoding: string | undefined) => `police composite (encodage ${encoding ?? "intégré"})`,
      compositeNoToUnicode: "police composite sans table ToUnicode",
      compositeMalformed: "police composite mal formée",
      notFound: "police introuvable",
      toUnicodeUnreadable: "table ToUnicode illisible",
      other: (subtype: string | undefined) => `police ${subtype ?? "inconnue"}`,
    },
    syntax: {
      unterminatedString: "chaîne non terminée",
      unexpectedEnd: "fin de flux inattendue",
      malformedArray: "tableau mal formé",
      malformedDict: "dictionnaire mal formé",
      unexpectedDelimiter: "délimiteur inattendu",
      unexpectedValue: (word: string) => `valeur inattendue : ${word}`,
      malformedInlineImage: "image en ligne mal formée",
      unterminatedInlineImage: "image en ligne non terminée",
    },
  },
};

export type Messages = typeof fr;
