// 7.3 : sans NER, aucune requête ne quitte le navigateur, quel que soit le format.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { download, FIXTURES, NAMES, upload } from "./helpers.ts";

const FILES = ["sample.docx", "sample.pptx", "sample.xlsx", "sample.pdf", "sample.md", "sample.txt"];

test("aucune requête sortante pendant les traitements sans NER", async ({ page, context }) => {
  const outgoing: string[] = [];
  await context.route(
    (url) => url.hostname !== "localhost",
    (route) => {
      outgoing.push(`${route.request().method()} ${route.request().url()}`);
      return route.abort("blockedbyclient");
    },
  );
  await page.goto("./");
  const panel = page.getByRole("tabpanel", { name: "Anonymiser" });
  await panel.getByRole("textbox", { name: /Liste de noms/ }).fill(NAMES);
  for (const name of FILES) {
    await upload(page, "anonymize-file", name, readFileSync(join(FIXTURES, name)));
    await panel.getByRole("button", { name: "Anonymiser", exact: true }).click();
    await expect(panel.getByText(/Document anonymisé :/)).toBeVisible();
    const doc = await download(page, /^⬇ Document anonymisé/);
    const mapping = await download(page, /^⬇ Mapping/);

    await page.getByRole("tab", { name: "Vérifier" }).click();
    await upload(page, "check-file", doc.name, doc.data);
    await page
      .getByRole("tabpanel", { name: "Vérifier" })
      .getByRole("button", { name: "Vérifier", exact: true })
      .click();
    await expect(
      page
        .getByRole("tabpanel", { name: "Vérifier" })
        .getByRole("status")
        .or(page.getByRole("tabpanel", { name: "Vérifier" }).getByRole("alert"))
        .first(),
    ).toBeVisible();

    await page.getByRole("tab", { name: "Restaurer" }).click();
    const restorePanel = page.getByRole("tabpanel", { name: "Restaurer" });
    await upload(page, "restore-file", doc.name, doc.data);
    await upload(page, "restore-mapping", mapping.name, mapping.data, "application/json");
    await restorePanel.getByRole("button", { name: "Restaurer", exact: true }).click();
    await expect(restorePanel.getByText("Document restauré.")).toBeVisible();
    await page.getByRole("tab", { name: "Anonymiser" }).click();
  }
  expect(outgoing).toEqual([]);
});

test("aucun stockage persistant : ni localStorage, ni sessionStorage, ni IndexedDB, ni cookie", async ({
  page,
  context,
}) => {
  await page.goto("./");
  const panel = page.getByRole("tabpanel", { name: "Anonymiser" });
  await panel.getByRole("textbox", { name: /Liste de noms/ }).fill(NAMES);
  await upload(page, "anonymize-file", "sample.md", readFileSync(join(FIXTURES, "sample.md")));
  await panel.getByRole("button", { name: "Anonymiser", exact: true }).click();
  await expect(panel.getByText(/Document anonymisé :/)).toBeVisible();
  const storage = await page.evaluate(async () => ({
    local: localStorage.length,
    session: sessionStorage.length,
    idb: (await indexedDB.databases()).map((d) => d.name),
    caches: await caches.keys(),
  }));
  expect(storage).toEqual({ local: 0, session: 0, idb: [], caches: [] });
  expect(await context.cookies()).toEqual([]);
  // La liste de noms est perdue au rechargement.
  await page.reload();
  await expect(
    page.getByRole("tabpanel", { name: "Anonymiser" }).getByRole("textbox", { name: /Liste de noms/ }),
  ).toHaveValue("");
});
