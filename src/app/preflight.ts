// Message affiché au dépôt d'un document Office contenant commentaires, révisions ou auteurs.
import { isClean, type Inspection } from "../adapters/inspect.ts";
import { agree, pl } from "../engine/plural.ts";

export interface PreflightMessage {
  title: string;
  details: string[];
}

const AGAIN = "enregistrez, puis déposez à nouveau le fichier.";

const byAuthors = (n: number) => (n === 1 ? " d'un auteur" : n > 1 ? ` de ${n} auteurs` : "");
const namesStay = (n: number) =>
  `${agree(n, "Le nom de cet auteur restera", "Les noms de ces auteurs resteront")} en clair dans le document anonymisé.`;
const listStays = "Leurs noms resteront en clair dans le document anonymisé.";

/** Message par format, ou null si rien n'a été trouvé. */
export function preflightMessage(i: Inspection | null): PreflightMessage | null {
  if (!i || isClean(i)) return null;
  switch (i.format) {
    case "docx":
      return docx(i);
    case "pptx":
      return pptx(i);
    case "xlsx":
      return xlsx(i);
  }
}

function docx(i: Inspection): PreflightMessage {
  const found = [
    ...(i.comments ? [pl(i.comments, "commentaire", "commentaires")] : []),
    ...(i.revisions ? [pl(i.revisions, "révision", "révisions")] : []),
  ];
  const details: string[] = [];
  let title: string;
  if (found.length) {
    title = `Ce document contient ${found.join(" et ")}${byAuthors(i.authors)}.`;
    if (i.authors) details.push(namesStay(i.authors));
    const steps = [
      ...(i.revisions ? ["Accepter → Accepter toutes les modifications"] : []),
      ...(i.comments ? ["Supprimer → Supprimer tous les commentaires du document"] : []),
    ];
    details.push(
      `Pour les retirer avant d'anonymiser : dans Word, onglet Révision → ${steps.join(", puis ")} ; ${AGAIN}`,
    );
    if (i.peopleList) details.push("Le fichier contient aussi la liste des personnes qui l'ont commenté ou révisé.");
  } else if (i.peopleList) {
    title = "Ce document contient la liste des personnes qui l'ont commenté ou révisé.";
    details.push(listStays);
  } else {
    title = "Le suivi des modifications est activé dans ce document.";
  }
  if (i.trackRevisions) {
    details.push(
      `${found.length || i.peopleList ? "Le suivi des modifications est aussi activé : t" : "T"}oute modification ultérieure serait enregistrée avec le nom de son auteur. Pour le désactiver : dans Word, onglet Révision → Suivi des modifications ; ${AGAIN}`,
    );
  }
  return { title, details };
}

function pptx(i: Inspection): PreflightMessage {
  if (!i.comments) {
    return { title: "Cette présentation contient la liste des auteurs de ses commentaires.", details: [listStays] };
  }
  return {
    title: `Cette présentation contient ${pl(i.comments, "commentaire", "commentaires")}${byAuthors(i.authors)}.`,
    details: [
      ...(i.authors ? [namesStay(i.authors)] : []),
      "Le texte des commentaires n'est pas anonymisé non plus.",
      `Pour les retirer avant d'anonymiser : dans PowerPoint, onglet Révision → Supprimer → Supprimer tous les commentaires de la présentation ; ${AGAIN}`,
    ],
  };
}

function xlsx(i: Inspection): PreflightMessage {
  const found = [
    ...(i.comments ? [pl(i.comments, "commentaire", "commentaires")] : []),
    ...(i.notes ? [pl(i.notes, "note", "notes")] : []),
  ];
  if (!found.length) {
    return { title: "Ce classeur contient la liste des auteurs de ses commentaires.", details: [listStays] };
  }
  return {
    title: `Ce classeur contient ${found.join(" et ")}${byAuthors(i.authors)}.`,
    details: [
      ...(i.authors ? [namesStay(i.authors)] : []),
      `Le texte des ${i.notes && !i.comments ? "notes" : i.comments && !i.notes ? "commentaires" : "commentaires et des notes"} n'est pas anonymisé non plus.`,
      `Pour les retirer avant d'anonymiser : dans Excel, sur chaque feuille, sélectionnez toutes les cellules (Ctrl+A), puis onglet Accueil → Effacer → Effacer les commentaires et les notes ; ${AGAIN}`,
    ],
  };
}
