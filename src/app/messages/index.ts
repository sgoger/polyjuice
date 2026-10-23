// Langue de l'interface côté React : contexte fourni par App, textes de l'interface et du moteur.
import { createContext, use } from "react";
import { messagesFor, type Locale, type Messages } from "../../i18n/index.ts";
import { de } from "./de.tsx";
import { fr, type UiMessages } from "./fr.tsx";

const UI: Record<Locale, UiMessages> = { fr, de };

export const LocaleContext = createContext<Locale>("fr");

export const uiMessagesFor = (locale: Locale): UiMessages => UI[locale];

/** Textes de l'interface dans la langue courante. */
export function useT(): UiMessages {
  return UI[use(LocaleContext)];
}

/** Messages partagés avec le moteur (libellés des types d'entités, rappel sur le mapping…). */
export function useEngineT(): Messages {
  return messagesFor(use(LocaleContext));
}
