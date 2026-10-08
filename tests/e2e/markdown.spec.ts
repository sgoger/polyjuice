import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { anonymizeFile, download, FIXTURES, upload } from "./helpers.ts";

test("parcours complet .md : anonymiser → vérifier → restaurer", async ({ page }) => {
  const original = readFileSync(join(FIXTURES, "sample.md"));
  const { panel, doc, mapping } = await anonymizeFile(page, "sample.md");

  expect(doc.name).toBe("sample.anonymise.md");
  expect(mapping.name).toBe("sample.json");
  const anonymized = doc.data.toString("utf8");
  expect(anonymized).not.toContain("Paulina Kowalski");
  expect(anonymized).toMatch(/⟦P-[A-Z0-9]{5}⟧/u);
  await expect(panel.getByRole("table")).toBeVisible();
  await expect(panel.getByText("Le mapping contient les données en clair. Ne pas transmettre.")).toBeVisible();

  // Vérifier : rien ne doit ressortir (la liste de noms est partagée entre onglets).
  await page.getByRole("tab", { name: "Vérifier" }).click();
  const check = page.getByRole("tabpanel", { name: "Vérifier" });
  await upload(page, "check-file", doc.name, doc.data);
  await check.getByRole("button", { name: "Vérifier", exact: true }).click();
  await expect(check.getByText(/Rien de détecté/)).toBeVisible();

  // Restaurer
  await page.getByRole("tab", { name: "Restaurer" }).click();
  const restorePanel = page.getByRole("tabpanel", { name: "Restaurer" });
  await upload(page, "restore-file", doc.name, doc.data);
  await upload(page, "restore-mapping", mapping.name, mapping.data, "application/json");
  await restorePanel.getByRole("button", { name: "Restaurer", exact: true }).click();
  await expect(restorePanel.getByText("Document restauré.")).toBeVisible();
  const restored = await download(page, /^⬇ Document restauré/);
  expect(restored.name).toBe("sample.restaure.md");
  expect(restored.data.equals(original)).toBe(true);
});

test("refuse un format non pris en charge", async ({ page }) => {
  await page.goto("./");
  await upload(page, "anonymize-file", "notes.odt", Buffer.from("x"));
  await expect(page.getByRole("alert")).toContainText("n'est pas pris en charge");
  await expect(page.getByRole("button", { name: "Anonymiser", exact: true })).toBeDisabled();
});

test("le bandeau de pied de page est présent et les onglets se pilotent au clavier", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByText("Aucune donnée ne quitte votre navigateur.", { exact: false })).toBeVisible();
  await page.getByRole("tab", { name: "Anonymiser" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Vérifier" })).toBeFocused();
  await expect(page.getByRole("tab", { name: "Vérifier" })).toHaveAttribute("aria-selected", "true");
});
