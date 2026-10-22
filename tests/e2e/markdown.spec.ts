import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { anonymizeFile, download, FIXTURES, runRestore, upload } from "./helpers.ts";

test("parcours complet .md : anonymiser → vérifier → restaurer", async ({ page }) => {
  const original = readFileSync(join(FIXTURES, "sample.md"));
  const { panel, archive, doc, mapping, report } = await anonymizeFile(page, "sample.md");

  // Archive téléchargée automatiquement : document, mapping, rapport.
  expect(archive.name).toBe("sample.polyjuice.zip");
  expect(doc.name).toBe("sample.anonymise.md");
  expect(mapping.name).toBe("sample.json");
  expect(report.name).toBe("sample.report.md");
  // L'étape « Résultat » dit quoi envoyer et quoi garder, avec les vrais noms de fichiers.
  await expect(panel.getByRole("status").filter({ hasText: "Document anonymisé :" })).toContainText(
    "L'archive sample.polyjuice.zip a été téléchargée",
  );
  await expect(panel.getByRole("listitem").filter({ hasText: "À envoyer" })).toContainText("sample.anonymise.md");
  await expect(panel.getByRole("listitem").filter({ hasText: "À garder, ne jamais transmettre" })).toContainText(
    "sample.json",
  );
  // Boutons de secours : mêmes octets que l'archive.
  expect((await download(page, /^⬇ Archive/)).data.equals(archive.data)).toBe(true);
  expect((await download(page, /^⬇ Document anonymisé/)).data.equals(doc.data)).toBe(true);
  expect((await download(page, /^⬇ Mapping/)).data.equals(mapping.data)).toBe(true);
  expect((await download(page, /^⬇ Rapport/)).data.equals(report.data)).toBe(true);
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
  // Le document restauré est téléchargé automatiquement ; le bouton reste disponible.
  const restored = await runRestore(page);
  await expect(restorePanel.getByText("Document restauré.")).toBeVisible();
  expect(restored.name).toBe("sample.restaure.md");
  expect(restored.data.equals(original)).toBe(true);
  expect((await download(page, /^⬇ Document restauré/)).data.equals(original)).toBe(true);
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
