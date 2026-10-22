// Inspection au dépôt : commentaires, révisions et auteurs signalés avant tout traitement, sans bloquer.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { FIXTURES, NAMES, nerBox, runAnonymize, upload } from "./helpers.ts";

test("sample.docx : avertissement dès le dépôt, traitement toujours possible", async ({ page }) => {
  await page.goto("./");
  const panel = page.getByRole("tabpanel", { name: "Anonymiser" });
  await nerBox(page).uncheck();
  await upload(page, "anonymize-file", "sample.docx", readFileSync(join(FIXTURES, "sample.docx")));
  const preflight = panel.getByTestId("preflight");
  await expect(preflight).toContainText("Ce document contient 1 commentaire d'un auteur.");
  await expect(preflight).toContainText("Supprimer tous les commentaires du document");
  await expect(preflight.getByRole("alert")).toBeVisible();

  // Sous le dépôt, avant le bouton, qui reste actif.
  const button = panel.getByRole("button", { name: "Anonymiser", exact: true });
  await expect(button).toBeEnabled();
  const box = await preflight.boundingBox();
  const buttonBox = await button.boundingBox();
  expect(box && buttonBox && box.y < buttonBox.y).toBe(true);

  await panel.getByRole("textbox", { name: /Glossaire de noms/ }).fill(NAMES);
  await runAnonymize(page);
  await expect(panel.getByRole("alert").filter({ hasText: "à lire avant l'envoi" })).toContainText(
    "1 nom d'auteur de commentaires ou de révisions reste en clair",
  );
});

test("revisions.docx : révisions, auteurs et suivi des modifications", async ({ page }) => {
  await page.goto("./");
  const panel = page.getByRole("tabpanel", { name: "Anonymiser" });
  await upload(page, "anonymize-file", "revisions.docx", readFileSync(join(FIXTURES, "revisions.docx")));
  const preflight = panel.getByTestId("preflight");
  await expect(preflight).toContainText("Ce document contient 2 commentaires et 4 révisions de 3 auteurs.");
  await expect(preflight).toContainText("Accepter toutes les modifications");
  await expect(preflight).toContainText("Le suivi des modifications est aussi activé");
});

test("même avertissement dans « Vérifier »", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("tab", { name: "Vérifier" }).click();
  const panel = page.getByRole("tabpanel", { name: "Vérifier" });
  await upload(page, "check-file", "revisions.docx", readFileSync(join(FIXTURES, "revisions.docx")));
  await expect(panel.getByTestId("preflight")).toContainText("2 commentaires et 4 révisions");
});

test("sample.md, sample.pptx : pas d'avertissement au dépôt", async ({ page }) => {
  await page.goto("./");
  const panel = page.getByRole("tabpanel", { name: "Anonymiser" });
  await upload(page, "anonymize-file", "sample.docx", readFileSync(join(FIXTURES, "sample.docx")));
  await expect(panel.getByTestId("preflight")).toBeVisible();
  for (const name of ["sample.md", "sample.pptx"]) {
    await upload(page, "anonymize-file", name, readFileSync(join(FIXTURES, name)));
    await expect(panel.getByText(name)).toBeVisible();
    await expect(panel.getByTestId("preflight-pending")).toHaveCount(0);
    await expect(panel.getByTestId("preflight")).toHaveCount(0);
  }
});
