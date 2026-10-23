// Glossaire de noms : mémorisation facultative (localStorage, une seule clé), export .txt, effacement.
import { Document, Packer, Paragraph } from "docx";
import { expect, test, type Page } from "@playwright/test";
import { docxAdapter } from "../../src/adapters/docx.ts";
import { download, nerBox, runAnonymize, upload } from "./helpers.ts";

const GLOSSARY = "# Équipe projet\nThomas Rivière\nJean Dupont\n";

const panel = (page: Page) => page.getByRole("tabpanel", { name: "Anonymiser" });
const textbox = (page: Page) => panel(page).getByRole("textbox", { name: /Glossaire de noms/ });
const remember = (page: Page) => panel(page).getByRole("checkbox", { name: /Mémoriser ce glossaire/ });
const localItems = (page: Page) =>
  page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])));

test("case cochée : glossaire restauré au rechargement ; décochée : rien en localStorage", async ({ page }) => {
  await page.goto("./");
  await expect(remember(page)).not.toBeChecked();
  await remember(page).check();
  await textbox(page).fill(GLOSSARY);
  expect(await localItems(page)).toEqual({ "polyjuice.glossary": GLOSSARY });

  await page.reload();
  await expect(textbox(page)).toHaveValue(GLOSSARY);
  await expect(remember(page)).toBeChecked();
  // Même glossaire dans l'onglet Vérifier.
  await page.getByRole("tab", { name: "Vérifier" }).click();
  await expect(
    page.getByRole("tabpanel", { name: "Vérifier" }).getByRole("textbox", { name: /Glossaire de noms/ }),
  ).toHaveValue(GLOSSARY);
  await page.getByRole("tab", { name: "Anonymiser" }).click();

  // Décocher supprime la copie enregistrée, le champ reste rempli jusqu'au rechargement.
  await remember(page).uncheck();
  expect(await localItems(page)).toEqual({});
  await expect(textbox(page)).toHaveValue(GLOSSARY);
  await textbox(page).fill("Sabine Weber");
  expect(await localItems(page)).toEqual({});
  await page.reload();
  await expect(textbox(page)).toHaveValue("");
  await expect(remember(page)).not.toBeChecked();
});

test("« Effacer » vide le champ et la copie enregistrée", async ({ page }) => {
  await page.goto("./");
  await remember(page).check();
  await textbox(page).fill(GLOSSARY);
  await panel(page).getByRole("button", { name: "Effacer" }).click();
  await expect(textbox(page)).toHaveValue("");
  expect(await localItems(page)).toEqual({});
  await page.reload();
  await expect(textbox(page)).toHaveValue("");
});

test("« Enregistrer en .txt » télécharge le contenu du champ", async ({ page }) => {
  await page.goto("./");
  await textbox(page).fill(GLOSSARY);
  const file = await download(page, "Enregistrer en .txt");
  expect(file.name).toBe("glossaire.txt");
  expect(file.data.toString("utf8")).toBe(GLOSSARY);
  // Le fichier rechargé remplace le contenu du champ.
  await textbox(page).fill("autre");
  await panel(page)
    .locator('input[type="file"][accept=".txt"]')
    .setInputFiles({ name: "glossaire.txt", mimeType: "text/plain", buffer: file.data });
  await expect(textbox(page)).toHaveValue(GLOSSARY);
  expect(await localItems(page)).toEqual({});
});

test("stockage bloqué : case désactivée, glossaire utilisable", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Accès refusé", "SecurityError");
      },
    });
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await expect(remember(page)).toBeDisabled();
  await expect(panel(page).getByText(/stockage local bloqué/)).toBeVisible();
  await textbox(page).fill(GLOSSARY);
  await expect(panel(page).getByText("2 termes.")).toBeVisible();
  expect(errors).toEqual([]);
});

test("un nom du glossaire est remplacé dans un .docx sans détection par IA", async ({ page }) => {
  // « Rivière » est aussi un nom commun : le glossaire garantit le remplacement du nom complet.
  const source = await Packer.toBuffer(
    new Document({
      sections: [
        { children: [new Paragraph("Compte rendu : Thomas Rivière a présenté le projet au bord de la rivière.")] },
      ],
    }),
  );
  await page.goto("./");
  // Détection par IA cochée par défaut : décochée avant le dépôt, aucun modèle n'est chargé.
  await nerBox(page).uncheck();
  await upload(page, "anonymize-file", "glossaire.docx", source);
  await textbox(page).fill("Thomas Rivière");
  const { doc, mapping } = await runAnonymize(page);
  const { segments } = await docxAdapter.read(
    doc.data.buffer.slice(doc.data.byteOffset, doc.data.byteOffset + doc.data.byteLength) as ArrayBuffer,
  );
  const text = segments.map((s) => s.text).join("\n");
  expect(text).toMatch(/^Compte rendu : ⟦P-[A-Z0-9]{5}⟧ a présenté le projet au bord de la rivière\.$/);
  expect(mapping.data.toString("utf8")).toContain("Thomas Rivière");
});
