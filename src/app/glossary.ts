/**
 * Mémorisation facultative du glossaire de noms (case « Mémoriser ce glossaire dans ce navigateur »,
 * décochée par défaut). C'est le seul stockage persistant de l'application (voir docs/PRIVACY.md) :
 * une seule clé localStorage, en texte brut, écrite uniquement si l'utilisateur l'a demandé.
 */
export const GLOSSARY_KEY = "polyjuice.glossary";

export interface GlossaryStore {
  /** Faux si le stockage est inaccessible (navigation privée, stockage bloqué…). */
  available: boolean;
  /** Glossaire enregistré, ou `null` s'il n'y en a pas. */
  load: () => string | null;
  /** Enregistre le glossaire ; renvoie faux en cas d'échec (quota, stockage bloqué). */
  save: (value: string) => boolean;
  /** Supprime la copie enregistrée. */
  clear: () => void;
}

/**
 * Accès au stockage sans jamais lever d'exception : selon le navigateur, lire `localStorage` ou y
 * écrire peut échouer (SecurityError, QuotaExceededError).
 */
export function glossaryStore(getStorage: () => Storage = () => localStorage): GlossaryStore {
  let storage: Storage | null;
  try {
    storage = getStorage();
    // Certains navigateurs exposent un stockage en lecture seule : on vérifie qu'on peut écrire
    // sans toucher à une copie existante.
    const probe = `${GLOSSARY_KEY}.probe`;
    storage.setItem(probe, "");
    storage.removeItem(probe);
  } catch {
    storage = null;
  }
  const s = storage;
  return {
    available: s !== null,
    load: () => {
      try {
        return s?.getItem(GLOSSARY_KEY) ?? null;
      } catch {
        return null;
      }
    },
    save: (value) => {
      if (!s) return false;
      try {
        s.setItem(GLOSSARY_KEY, value);
        return true;
      } catch {
        return false;
      }
    },
    clear: () => {
      try {
        s?.removeItem(GLOSSARY_KEY);
      } catch {
        // Rien à effacer si le stockage est inaccessible.
      }
    },
  };
}
