import { expect, test } from "@playwright/test";
import { anonymizeFile } from "./helpers.ts";

test("PDF : extraction dans le navigateur (pdf.js dans le Worker) → .md anonymisé", async ({ page }) => {
  const { doc, panel } = await anonymizeFile(page, "sample.pdf");
  expect(doc.name).toBe("sample.anonymise.md");
  const md = doc.data.toString("utf8");
  expect(md).toContain("Compte rendu de réunion");
  expect(md).not.toContain("Jean Dupont");
  expect(md).toMatch(/⟦E-[A-Z0-9]{5}⟧/u);
  await expect(panel.getByRole("alert").filter({ hasText: "avertissement" })).toContainText("PDF converti en Markdown");
});
