/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Le chemin de base est fourni par actions/configure-pages en CI (voir docs/DEVIATIONS.md) ;
// en local, le site est servi à la racine.
// Isolation inter-origines (calcul multi-cœur d'ONNX Runtime) ; sur GitHub Pages, ces en-têtes sont
// ajoutés par le service worker public/coi-sw.js (voir src/app/isolation.ts).
const isolationHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  plugins: [react(), tailwindcss()],
  worker: { format: "es" },
  server: { headers: isolationHeaders },
  preview: { headers: isolationHeaders },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
    environment: "node",
    setupFiles: ["tests/unit/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/engine/**", "src/adapters/**"],
      // Fichier propre au navigateur (URL des fichiers WASM servis par Vite).
      exclude: ["src/engine/detectors/ortAssets.ts"],
      thresholds: { statements: 85, lines: 85 },
    },
  },
});
