// Isolation inter-origines : condition du calcul multi-cœur de la NER (SharedArrayBuffer).
// Ici les en-têtes viennent de `vite preview` ; sur GitHub Pages, du service worker public/coi-sw.js.
import { expect, test } from "@playwright/test";

test("la page est isolée (crossOriginIsolated) et le service worker n'est pas installé inutilement", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.getByRole("tabpanel", { name: "Anonymiser" })).toBeVisible();
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0);
});

test("le service worker ajoute les en-têtes d'isolation aux réponses de l'application", async ({ page }) => {
  const sw = await page.request.get("./coi-sw.js");
  expect(sw.ok()).toBe(true);
  expect(await sw.text()).toContain("Cross-Origin-Embedder-Policy");
});
