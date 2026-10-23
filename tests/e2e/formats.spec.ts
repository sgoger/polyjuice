import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { anonymizeFile, FIXTURES, nerBox, restart, upload } from "./helpers.ts";

/** Début d'un fichier Office 97-2003 (conteneur OLE2). */
const OLE2 = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, ...new Array<number>(504).fill(0)]);

test("PDF : note avant traitement, PDF réécrit dans le navigateur + version .md dans l'archive", async ({ page }) => {
  await page.goto("./");
  const panel = page.getByRole("tabpanel", { name: "Anonymiser" });
  await nerBox(page).uncheck();
  await upload(page, "anonymize-file", "sample.pdf", readFileSync(join(FIXTURES, "sample.pdf")));
  const note = panel.getByRole("status").filter({ hasText: "PDF : réécrit si possible" });
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

test(".xls refusé au dépôt : message qui explique comment convertir, aucun traitement", async ({ page }) => {
  await page.goto("./");
  const panel = page.getByRole("tabpanel", { name: "Anonymiser" });
  await upload(page, "anonymize-file", "budget.xls", Buffer.from(OLE2));
  await expect(panel.getByRole("alert")).toContainText(
    "« budget.xls » : .xls n'est pas pris en charge (ancien format binaire Excel 97-2003) : ouvrez-le dans Excel, Fichier → Enregistrer sous → Classeur Excel (.xlsx), puis déposez le .xlsx.",
  );
  await expect(panel.getByRole("button", { name: "Anonymiser", exact: true })).toBeDisabled();
});

test(".odt refusé au dépôt avec le format vers lequel le convertir", async ({ page }) => {
  await page.goto("./");
  const panel = page.getByRole("tabpanel", { name: "Anonymiser" });
  await upload(page, "anonymize-file", "notes.odt", Buffer.from("PK\u0003\u0004"));
  await expect(panel.getByRole("alert")).toContainText(
    "« notes.odt » : .odt n'est pas pris en charge (format OpenDocument) : ouvrez-le dans Word, Fichier → Enregistrer sous → Document Word (.docx), puis déposez le .docx.",
  );
});

test("faux .docx (un .doc renommé) : refusé au dépôt avec un message clair", async ({ page }) => {
  await page.goto("./");
  const panel = page.getByRole("tabpanel", { name: "Anonymiser" });
  await upload(page, "anonymize-file", "rapport.docx", Buffer.from(OLE2));
  await expect(panel.getByRole("alert")).toContainText("« rapport.docx » n'est pas un vrai .docx");
  await expect(panel.getByRole("button", { name: "Anonymiser", exact: true })).toBeDisabled();
});
