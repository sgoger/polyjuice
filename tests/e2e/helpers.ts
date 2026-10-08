import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";

export const FIXTURES = join(import.meta.dirname, "../fixtures");
export const NAMES = readFileSync(join(FIXTURES, "fixture-names.txt"), "utf8");

export async function download(page: Page, buttonName: RegExp | string): Promise<{ name: string; data: Buffer }> {
  const [dl] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: buttonName }).click(),
  ]);
  const path = await dl.path();
  return { name: dl.suggestedFilename(), data: readFileSync(path) };
}

export async function upload(
  page: Page,
  testId: string,
  name: string,
  data: Buffer,
  mimeType = "application/octet-stream",
) {
  await page.getByTestId(testId).setInputFiles({ name, mimeType, buffer: data });
}

/** Anonymise un fichier (sans NER) et renvoie document + mapping téléchargés. */
export async function anonymizeFile(page: Page, fileName: string) {
  await page.goto("./");
  const panel = page.getByRole("tabpanel", { name: "Anonymiser" });
  await upload(page, "anonymize-file", fileName, readFileSync(join(FIXTURES, fileName)));
  await panel.getByRole("textbox", { name: /Liste de noms/ }).fill(NAMES);
  await panel.getByRole("button", { name: "Anonymiser", exact: true }).click();
  await expect(panel.getByText(/Document anonymisé :/)).toBeVisible();
  const doc = await download(page, /^⬇ Document anonymisé/);
  const mapping = await download(page, /^⬇ Mapping/);
  return { panel, doc, mapping };
}
