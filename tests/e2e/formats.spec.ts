import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { anonymizeFile, FIXTURES, nerBox, restart, upload } from "./helpers.ts";

test("PDF : note avant traitement, PDF réécrit dans le navigateur + version .md dans l'archive", async ({ page }) => {
  await page.goto("./");
  const panel = page.getByRole("tabpanel", { name: "Anonymiser" });
  await nerBox(page).uncheck();
  await upload(page, "anonymize-file", "sample.pdf", readFileSync(join(FIXTURES, "sample.pdf")));
  const note = panel.getByRole("status").filter({ hasText: "PDF : réécrit si c'est sans risque" });
  await expect(note).toContainText("seul le .md est produit");
  await expect(note.getByRole("link", { name: "En savoir plus" })).toHaveAttribute("href", /docs\/FORMATS\.md#pdf$/);

  const { doc, alternate, panel: result } = await anonymizeFile(page, "sample.pdf");
  expect(doc.name).toBe("sample.anonymise.pdf");
  expect(doc.data.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  await expect(result.getByRole("alert").filter({ hasText: "à lire avant l'envoi" })).toContainText("PDF réécrit");
  expect(alternate?.name).toBe("sample.anonymise.md");
  const text = alternate?.data.toString("utf8") ?? "";
  expect(text).toContain("Compte rendu de réunion");
  expect(text).not.toContain("Jean Dupont");
  expect(text).toMatch(/⟦E-[A-Z0-9]{5}⟧/u);

  // Le PDF produit se relit dans « Vérifier » : plus rien à signaler, tokens ignorés.
  await page.getByRole("tab", { name: "Vérifier" }).click();
  const check = page.getByRole("tabpanel", { name: "Vérifier" });
  await restart(check);
  await upload(page, "check-file", doc.name, doc.data);
  await check.getByRole("button", { name: "Vérifier", exact: true }).click();
  await expect(check.getByText(/Rien de détecté/)).toBeVisible();
});

test("PDF non réécrivable (police Type3) : .md seul, avertissement qui dit pourquoi", async ({ page }) => {
  const { doc, alternate, panel } = await anonymizeFile(page, "pdf-type3.pdf");
  expect(doc.name).toBe("pdf-type3.anonymise.md");
  expect(alternate).toBeUndefined();
  await expect(panel.getByRole("alert").filter({ hasText: "à lire avant l'envoi" })).toContainText(
    "PDF non réécrit (1 valeur détectée n'a pas pu être retirée du texte du PDF ; en cause : police Type3)",
  );
});
