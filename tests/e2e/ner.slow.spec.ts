// Test lent (télécharge le modèle, ~181 Mo) : exécuté par la CI nightly (`npm run test:e2e:slow`).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { docxAdapter } from "../../src/adapters/docx.ts";
import { download, FIXTURES, upload } from "./helpers.ts";

test("anonymiser un .docx avec la NER activée (Chromium) @slow", async ({ page }) => {
  test.setTimeout(600_000);
  const requests: { url: string; method: string; hasBody: boolean }[] = [];
  const local = (url: string) => /^(http:\/\/localhost[:/]|blob:|data:)/.test(url);
  page.on("request", (r) => {
    if (!local(r.url())) requests.push({ url: r.url(), method: r.method(), hasBody: !!r.postData() });
  });
  // Les requêtes du Worker passent aussi par le contexte.
  page.context().on("request", (r) => {
    if (!local(r.url()) && !requests.some((x) => x.url === r.url()))
      requests.push({ url: r.url(), method: r.method(), hasBody: !!r.postData() });
  });

  await page.goto("./");
  const panel = page.getByRole("tabpanel", { name: "Anonymiser" });
  await panel.getByRole("checkbox", { name: /détection de noms par IA/ }).check();
  // Échoue vite si le chargement échoue (message d'erreur) plutôt que d'attendre la fin du délai.
  await expect(panel.getByText("Modèle prêt.").or(panel.getByText(/n'a pas pu être chargé/))).toBeVisible({
    timeout: 540_000,
  });
  await expect(panel.getByText("Modèle prêt.")).toBeVisible();

  await upload(page, "anonymize-file", "sample.docx", readFileSync(join(FIXTURES, "sample.docx")));
  // Sans liste de noms : les personnes doivent être trouvées par la NER.
  await panel.getByRole("button", { name: "Anonymiser", exact: true }).click();
  await expect(panel.getByText(/Document anonymisé :/)).toBeVisible({ timeout: 120_000 });
  await expect(panel.getByRole("cell", { name: "IA (NER)" }).first()).toBeVisible();
  const doc = await download(page, /^⬇ Document anonymisé/);
  const text = (
    await docxAdapter.read(
      doc.data.buffer.slice(doc.data.byteOffset, doc.data.byteOffset + doc.data.byteLength) as ArrayBuffer,
    )
  ).segments
    .map((s) => s.text)
    .join("\n");
  for (const name of ["Paulina Kowalski", "Klaus Müller", "Oliver Hughes", "Emily Clarke"])
    expect(text).not.toContain(name);

  // Seules des requêtes GET vers le Hub (poids du modèle) quittent le navigateur, sans corps.
  for (const r of requests) {
    expect(r.method, r.url).toBe("GET");
    expect(r.hasBody, r.url).toBe(false);
    expect(new URL(r.url).hostname, r.url).toMatch(/(^|\.)(huggingface\.co|hf\.co)$/);
  }
  console.log(`${requests.length} requête(s) externe(s) :`, [...new Set(requests.map((r) => new URL(r.url).hostname))]);
});
