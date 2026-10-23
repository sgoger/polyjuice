// Message affiché au dépôt d'un document Office contenant commentaires, révisions ou auteurs.
import { isClean, type Inspection } from "../adapters/inspect.ts";
import { getLocale } from "../i18n/index.ts";
import type { UiMessages } from "./messages/fr.tsx";
import { uiMessagesFor } from "./messages/index.ts";

export interface PreflightMessage {
  title: string;
  details: string[];
}

type Texts = UiMessages["preflight"];

/** Message par format, ou null si rien n'a été trouvé. Textes dans la langue courante par défaut. */
export function preflightMessage(
  i: Inspection | null,
  messages: UiMessages = uiMessagesFor(getLocale()),
): PreflightMessage | null {
  if (!i || isClean(i)) return null;
  const m = messages.preflight;
  switch (i.format) {
    case "docx":
      return docx(i, m);
    case "pptx":
      return pptx(i, m);
    case "xlsx":
      return xlsx(i, m);
  }
}

function docx(i: Inspection, m: Texts): PreflightMessage {
  const found = [...(i.comments ? [m.comments(i.comments)] : []), ...(i.revisions ? [m.revisions(i.revisions)] : [])];
  const details: string[] = [];
  let title: string;
  if (found.length) {
    title = m.docx.contains(found, i.authors);
    if (i.authors) details.push(m.namesStay(i.authors));
    details.push(m.docx.remove(!!i.revisions, !!i.comments));
    if (i.peopleList) details.push(m.docx.peopleListToo);
  } else if (i.peopleList) {
    title = m.docx.peopleList;
    details.push(m.listStays);
  } else {
    title = m.docx.tracking;
  }
  if (i.trackRevisions) details.push(m.docx.trackingDetail(!!(found.length || i.peopleList)));
  return { title, details };
}

function pptx(i: Inspection, m: Texts): PreflightMessage {
  if (!i.comments) return { title: m.pptx.peopleList, details: [m.listStays] };
  return {
    title: m.pptx.contains(i.comments, i.authors),
    details: [...(i.authors ? [m.namesStay(i.authors)] : []), m.textToo, m.pptx.remove],
  };
}

function xlsx(i: Inspection, m: Texts): PreflightMessage {
  const found = [...(i.comments ? [m.comments(i.comments)] : []), ...(i.notes ? [m.notes(i.notes)] : [])];
  if (!found.length) return { title: m.xlsx.peopleList, details: [m.listStays] };
  return {
    title: m.xlsx.contains(found, i.authors),
    details: [...(i.authors ? [m.namesStay(i.authors)] : []), m.textToo, m.xlsx.remove],
  };
}
