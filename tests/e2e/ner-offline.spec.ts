import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { FIXTURES, NAMES, upload } from "./helpers.ts";

test("hors ligne : l'échec du chargement du modèle ne bloque pas le mode motifs + liste", async ({ page, context }) => {
  await context.route(/huggingface\.co|hf\.co/, (route) => route.abort("internetdisconnected"));
  await page.goto("./");
  const panel = page.getByRole("tabpanel", { name: "Anonymiser" });
  const box = panel.getByRole("checkbox", { name: /détection de noms par IA/ });
  await box.check();
  await expect(panel.getByRole("alert")).toContainText("n'a pas pu être chargé");
  await expect(box).not.toBeChecked();

  await upload(page, "anonymize-file", "sample.md", readFileSync(join(FIXTURES, "sample.md")));
  await panel.getByRole("textbox", { name: /Liste de noms/ }).fill(NAMES);
  await panel.getByRole("button", { name: "Anonymiser", exact: true }).click();
  await expect(panel.getByText(/Document anonymisé :/)).toBeVisible();
});
