// Isolation inter-origines : nécessaire au calcul multi-cœur d'ONNX Runtime (SharedArrayBuffer).
// Les en-têtes sont fournis par le serveur de développement / de prévisualisation (vite.config.ts)
// et, sur GitHub Pages qui ne permet pas de les définir, par le service worker `public/coi-sw.js`.

/**
 * Installe le service worker si la page n'est pas isolée, puis recharge la page une fois pour qu'il
 * la contrôle. Si la page est déjà contrôlée mais toujours pas isolée (navigateur qui ignore les
 * en-têtes fournis par un service worker), on n'insiste pas : le calcul restera mono-cœur.
 */
export async function ensureCrossOriginIsolation(): Promise<void> {
  if (globalThis.crossOriginIsolated || !window.isSecureContext || !("serviceWorker" in navigator)) return;
  if (navigator.serviceWorker.controller) return;
  try {
    await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}coi-sw.js`);
    await navigator.serviceWorker.ready;
  } catch {
    return; // Service workers interdits (navigation privée, politique) : mono-cœur.
  }
  // La page courante a été chargée sans les en-têtes : seul un rechargement la rend isolée.
  window.location.reload();
}
