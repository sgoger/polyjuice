import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Locator, type Page } from "@playwright/test";
import JSZip from "jszip";

export const FIXTURES = join(import.meta.dirname, "../fixtures");
export const NAMES = readFileSync(join(FIXTURES, "fixture-names.txt"), "utf8");

export interface Downloaded {
  name: string;
  data: Buffer;
}

/** Clique sur un bouton et renvoie le fichier téléchargé. */
export async function download(page: Page, buttonName: RegExp | string): Promise<Downloaded> {
  return captureDownload(page, () => page.getByRole("button", { name: buttonName }).click());
}

/** Arme l'attente du téléchargement avant l'action (téléchargement automatique compris). */
export async function captureDownload(page: Page, action: () => Promise<void>): Promise<Downloaded> {
  const [dl] = await Promise.all([page.waitForEvent("download"), action()]);
  const path = await dl.path();
  return { name: dl.suggestedFilename(), data: readFileSync(path) };
}

/** Contenu d'une archive ZIP : nom → octets, dans l'ordre de l'archive. */
export async function unzip(data: Buffer): Promise<Downloaded[]> {
  const zip = await JSZip.loadAsync(data);
  return Promise.all(
    Object.values(zip.files).map(async (f) => ({ name: f.name, data: Buffer.from(await f.async("uint8array")) })),
  );
}

/** Après un traitement, l'onglet n'affiche plus qu'un récapitulatif : « Recommencer » ramène aux étapes. */
export async function restart(panel: Locator) {
  const button = panel.getByRole("button", { name: /Recommencer/ });
  if (await button.isVisible()) await button.click();
}

/** Ouvre la zone repliée « Télécharger à nouveau… » du résultat. */
export async function openMore(panel: Locator) {
  await panel.locator("summary", { hasText: "Télécharger à nouveau" }).click();
}

/** Case « détection de noms par IA » (cochée par défaut). */
export const nerBox = (page: Page) =>
  page.getByRole("tabpanel", { name: "Anonymiser" }).getByRole("checkbox", { name: /détection de noms par IA/ });

export async function upload(
  page: Page,
  testId: string,
  name: string,
  data: Buffer,
  mimeType = "application/octet-stream",
) {
  await page.getByTestId(testId).setInputFiles({ name, mimeType, buffer: data });
}

/**
 * Clique sur « Anonymiser » et renvoie l'archive téléchargée automatiquement, ainsi que le document,
 * et le mapping qu'elle contient.
 */
export async function runAnonymize(page: Page) {
  const panel = page.getByRole("tabpanel", { name: "Anonymiser" });
  const archive = await captureDownload(page, () =>
    panel.getByRole("button", { name: "Anonymiser", exact: true }).click(),
  );
  await expect(panel.getByText(/Document anonymisé :/)).toBeVisible();
  const entries = await unzip(archive.data);
  expect(entries).toHaveLength(2);
  const [doc, mapping] = entries as [Downloaded, Downloaded];
  expect(doc.name).toMatch(/\.anonymise\.[a-z]+$/);
  expect(mapping.name).toMatch(/\.json$/);
  return { panel, archive, doc, mapping };
}

/** Clique sur « Restaurer » et renvoie le document restauré, téléchargé automatiquement. */
export async function runRestore(page: Page): Promise<Downloaded> {
  const panel = page.getByRole("tabpanel", { name: "Restaurer" });
  const restored = await captureDownload(page, () =>
    panel.getByRole("button", { name: "Restaurer", exact: true }).click(),
  );
  await expect(panel.getByRole("status").or(panel.getByRole("alert")).first()).toBeVisible();
  return restored;
}

/** Anonymise un fichier sans NER : la case est décochée avant le dépôt, aucun modèle n'est chargé. */
export async function anonymizeFile(page: Page, fileName: string) {
  await page.goto("./");
  const panel = page.getByRole("tabpanel", { name: "Anonymiser" });
  await nerBox(page).uncheck();
  await upload(page, "anonymize-file", fileName, readFileSync(join(FIXTURES, fileName)));
  await panel.getByRole("textbox", { name: /Liste de noms/ }).fill(NAMES);
  return runAnonymize(page);
}
