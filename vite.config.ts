/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Le chemin de base est fourni par actions/configure-pages en CI (voir docs/DEVIATIONS.md) ;
// en local, le site est servi à la racine.
export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  plugins: [react(), tailwindcss()],
  worker: { format: "es" },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
    environment: "node",
    setupFiles: ["tests/unit/setup.ts"],
    coverage: { provider: "v8", include: ["src/engine/**", "src/adapters/**"] },
  },
});
