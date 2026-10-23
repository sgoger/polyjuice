// Langue de l'interface et des messages produits par le moteur (avertissements, rapports, erreurs).
// Valeur globale au module : fixée par l'interface (thread principal) et, dans le Worker, par chaque
// requête reçue (voir worker/handler.ts). Aucune dépendance à React : importé aussi par le Worker.
import { de } from "./de.ts";
import { fr, type Messages } from "./fr.ts";

export const LOCALES = ["fr", "de"] as const;
export type Locale = (typeof LOCALES)[number];
export type { Messages };

const CATALOGS: Record<Locale, Messages> = { fr, de };

let current: Locale = "fr";

export const getLocale = (): Locale => current;

export function setLocale(locale: Locale): void {
  current = locale;
}

export const isLocale = (v: unknown): v is Locale => (LOCALES as readonly unknown[]).includes(v);

/** Messages du moteur dans la langue courante. */
export const t = (): Messages => CATALOGS[current];

/** Messages du moteur dans une langue donnée. */
export const messagesFor = (locale: Locale): Messages => CATALOGS[locale];

/**
 * Langue de départ d'après les préférences du navigateur : allemand si la langue préférée est
 * l'allemand (de, de-DE, de-AT, de-CH…), français sinon.
 */
export function detectLocale(languages: readonly string[]): Locale {
  return /^de(-|$)/i.test(languages[0] ?? "") ? "de" : "fr";
}
