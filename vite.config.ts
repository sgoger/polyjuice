/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// GitHub Pages sert le site sous /<nom du dépôt>/.
export default defineConfig({
  base: process.env.VITE_BASE ?? "/polyjuice/",
  plugins: [react(), tailwindcss()],
  worker: { format: "es" },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
    environment: "node",
    setupFiles: ["tests/unit/setup.ts"],
    coverage: { provider: "v8", include: ["src/engine/**", "src/adapters/**"] },
  },
});
