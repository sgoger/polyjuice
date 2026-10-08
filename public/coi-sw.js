// Service worker d'isolation inter-origines (cross-origin isolation).
//
// GitHub Pages ne permet pas d'envoyer les en-têtes COOP/COEP. Sans eux, `crossOriginIsolated` est
// faux, SharedArrayBuffer est indisponible et ONNX Runtime (WASM) ne calcule que sur un seul cœur.
// Ce service worker ajoute ces en-têtes aux réponses de l'application elle-même. Il ne met rien en
// cache et ne touche pas aux requêtes vers d'autres origines (Hugging Face : requêtes CORS, admises
// par COEP require-corp).
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (new URL(request.url).origin !== self.location.origin) return;
  if (request.cache === "only-if-cached" && request.mode !== "same-origin") return;
  event.respondWith(
    fetch(request).then((response) => {
      if (response.status === 0) return response;
      const headers = new Headers(response.headers);
      headers.set("Cross-Origin-Opener-Policy", "same-origin");
      headers.set("Cross-Origin-Embedder-Policy", "require-corp");
      headers.set("Cross-Origin-Resource-Policy", "same-origin");
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    }),
  );
});
