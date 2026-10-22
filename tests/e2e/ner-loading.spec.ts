// Détection par IA cochée par défaut : le modèle ne se charge qu'au dépôt d'un document qui en a besoin.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type BrowserContext } from "@playwright/test";
import { FIXTURES, nerBox, upload } from "./helpers.ts";

const HUB = /huggingface\.co|hf\.co/;

/** Enregistre les requêtes vers le Hub ; `hang` les laisse en suspens, sinon elles échouent. */
async function watchHub(context: BrowserContext, { hang = false } = {}): Promise<string[]> {
  const requests: string[] = [];
  await context.route(HUB, (route) => {
    requests.push(route.request().url());
    return hang ? undefined : route.abort("internetdisconnected");
  });
  return requests;
}

test("case cochée par défaut, aucun chargement avant un dépôt ni pour un .xlsx, chargement au dépôt d'un .docx", async ({
  page,
  context,
}) => {
  const requests = await watchHub(context);
  await page.goto("./");
  const panel = page.getByRole("tabpanel", { name: "Anonymiser" });
  await expect(nerBox(page)).toBeChecked();
  await page.waitForLoadState("networkidle");
  expect(requests).toEqual([]);

  // Classeur : ni case ni chargement.
  await upload(page, "anonymize-file", "sample.xlsx", readFileSync(join(FIXTURES, "sample.xlsx")));
  await expect(panel.getByText(/Détection par IA indisponible pour les classeurs/)).toBeVisible();
  await expect(nerBox(page)).toHaveCount(0);
  await expect(panel.getByRole("textbox", { name: /Colonnes à anonymiser/ })).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(requests).toEqual([]);

  // Document Word : le chargement démarre (ici il échoue : hors ligne simulé).
  await upload(page, "anonymize-file", "sample.docx", readFileSync(join(FIXTURES, "sample.docx")));
  await expect(panel.getByRole("alert")).toContainText("n'a pas pu être chargé");
  expect(requests.length).toBeGreaterThan(0);
  await expect(nerBox(page)).not.toBeChecked();
});

test("décocher la case pendant le chargement l'annule", async ({ page, context }) => {
  await watchHub(context, { hang: true });
  await page.goto("./");
  const panel = page.getByRole("tabpanel", { name: "Anonymiser" });
  await upload(page, "anonymize-file", "sample.md", readFileSync(join(FIXTURES, "sample.md")));
  await expect(panel.getByRole("progressbar", { name: /Chargement du modèle/ })).toBeVisible();
  await nerBox(page).uncheck();
  await expect(panel.getByRole("progressbar", { name: /Chargement du modèle/ })).toHaveCount(0);
  await expect(nerBox(page)).not.toBeChecked();
  await expect(panel.getByRole("alert")).toHaveCount(0);
});

test("« Anonymiser » pendant le chargement du modèle : le traitement l'attend et le dit", async ({ page, context }) => {
  await watchHub(context, { hang: true });
  await page.goto("./");
  const panel = page.getByRole("tabpanel", { name: "Anonymiser" });
  await upload(page, "anonymize-file", "sample.md", readFileSync(join(FIXTURES, "sample.md")));
  await panel.getByRole("button", { name: "Anonymiser", exact: true }).click();
  const running = panel.locator("[aria-busy=true]");
  await expect(running).toContainText("modèle de détection par IA");
  // Les étapes laissent place au récapitulatif pendant le traitement.
  await expect(nerBox(page)).toHaveCount(0);
  await expect(panel.getByText("Détection IA", { exact: true })).toBeVisible();
  await running.getByRole("button", { name: "Annuler" }).click();
  // Annulé : retour aux étapes, document conservé.
  await expect(panel.getByText("Traitement annulé.")).toBeVisible();
  await expect(panel.getByText("sample.md", { exact: true })).toBeVisible();
});
