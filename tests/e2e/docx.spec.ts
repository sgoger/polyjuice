import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { docxAdapter } from "../../src/adapters/docx.ts";
import { anonymizeFile, download, FIXTURES, upload } from "./helpers.ts";

const segments = async (data: Buffer) =>
  (
    await docxAdapter.read(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer)
  ).segments.map((s) => s.text);

test("parcours .docx sans NER : anonymiser → vérifier → restaurer", async ({ page }) => {
  const original = readFileSync(join(FIXTURES, "sample.docx"));
  const { panel, doc, mapping } = await anonymizeFile(page, "sample.docx");

  // Les avertissements sont visibles avant les boutons de téléchargement.
  const banner = panel.getByRole("alert").filter({ hasText: "avertissement" });
  await expect(banner).toContainText("image");
  await expect(banner).toContainText("Métadonnées vidées");
  const bannerBox = await banner.boundingBox();
  const buttonBox = await panel.getByRole("button", { name: /^⬇ Document anonymisé/ }).boundingBox();
  expect(bannerBox && buttonBox && bannerBox.y < buttonBox.y).toBe(true);

  expect(doc.name).toBe("sample.anonymise.docx");
  const anonText = (await segments(doc.data)).join("\n");
  expect(anonText).not.toContain("Paulina Kowalski");
  expect(anonText).not.toContain("jean.dupont@example.fr");

  await page.getByRole("tab", { name: "Vérifier" }).click();
  const check = page.getByRole("tabpanel", { name: "Vérifier" });
  await upload(page, "check-file", doc.name, doc.data);
  await check.getByRole("button", { name: "Vérifier", exact: true }).click();
  // Seule la cible mailto: de l'hyperlien (non modifiée) est signalée.
  await expect(check.getByText(/1 élément ressemble encore/)).toBeVisible();
  await expect(check.getByText("mailto:jean.dupont@example.fr")).toBeVisible();

  await page.getByRole("tab", { name: "Restaurer" }).click();
  const restorePanel = page.getByRole("tabpanel", { name: "Restaurer" });
  await upload(page, "restore-file", doc.name, doc.data);
  await upload(page, "restore-mapping", mapping.name, mapping.data, "application/json");
  await restorePanel.getByRole("button", { name: "Restaurer", exact: true }).click();
  await expect(restorePanel.getByText("Document restauré.")).toBeVisible();
  const restored = await download(page, /^⬇ Document restauré/);
  expect(await segments(restored.data)).toEqual(await segments(original));
});
