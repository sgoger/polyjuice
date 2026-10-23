// Langue de l'interface : allemand si le navigateur est en allemand, français sinon ; sélecteur FR / DE.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { FIXTURES, upload } from "./helpers.ts";

test.describe("navigateur en allemand", () => {
  test.use({ locale: "de-DE" });

  test("interface en allemand, puis en français via le sélecteur", async ({ page }) => {
    await page.goto("./");
    await expect(page.locator("html")).toHaveAttribute("lang", "de");
    await expect(page.getByRole("tab", { name: "Anonymisieren" })).toBeVisible();
    const switcher = page.getByRole("group", { name: "Sprache" });
    await expect(switcher.getByRole("button", { name: "Deutsch" })).toHaveAttribute("aria-pressed", "true");

    // Les messages du moteur suivent la langue de l'interface.
    await page.getByRole("checkbox", { name: /Namenserkennung per KI/ }).uncheck();
    await upload(page, "anonymize-file", "sample.docx", readFileSync(join(FIXTURES, "sample.docx")));
    await page.getByRole("button", { name: "Anonymisieren", exact: true }).click();
    await expect(page.getByText(/Dokument anonymisiert: \d+ Entitäten ersetzt\./)).toBeVisible();
    await expect(page.getByText(/Metadaten geleert/)).toBeVisible();

    await switcher.getByRole("button", { name: "Français" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(page.getByRole("tab", { name: "Anonymiser" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Langue" }).getByRole("button", { name: "Français" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

test.describe("navigateur dans une autre langue", () => {
  test.use({ locale: "en-US" });

  test("interface en français, passage en allemand via le sélecteur", async ({ page }) => {
    await page.goto("./");
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(page.getByRole("tab", { name: "Anonymiser" })).toBeVisible();
    await page.getByRole("group", { name: "Langue" }).getByRole("button", { name: "Deutsch" }).click();
    await expect(page.getByRole("tab", { name: "Wiederherstellen" })).toBeVisible();
    await expect(page.getByText(/Keine Daten verlassen Ihren Browser/)).toBeVisible();
  });
});
