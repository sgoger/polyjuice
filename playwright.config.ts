import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;

export default defineConfig({
  testDir: "tests/e2e",
  // Les tests @slow (téléchargement du modèle NER) ne tournent qu'avec `npm run test:e2e:slow`.
  ...(process.env.E2E_SLOW ? {} : { grepInvert: /@slow/ }),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: `http://localhost:${PORT}/`, trace: "retain-on-failure" },
  projects: [
    {
      name: "chromium",
      // En CI, le Google Chrome préinstallé sur les runners GitHub évite `playwright install`.
      use: { ...devices["Desktop Chrome"], ...(process.env.CI ? { channel: "chrome" } : {}) },
    },
  ],
  webServer: {
    // En CI, le workflow a déjà construit `dist` : on se contente de le servir.
    command: `${process.env.CI ? "" : "npm run build && "}npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
