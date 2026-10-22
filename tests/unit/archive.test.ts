import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import type { OutputFile } from "../../src/worker/protocol.ts";
import { anonymizeFixture } from "./helpers.ts";

const bytes = (f: OutputFile) => new Uint8Array(f.data);

describe("archive produite par l'anonymisation", () => {
  it.each([
    ["sample.docx", ["sample.anonymise.docx"]],
    ["sample.pdf", ["sample.anonymise.pdf", "sample.anonymise.md"]],
    ["pdf-type3.pdf", ["pdf-type3.anonymise.md"]],
    ["sample.xlsx", ["sample.anonymise.xlsx"]],
  ])("%s : document(s) et mapping seulement, octets identiques aux fichiers individuels", async (name, documents) => {
    const r = await anonymizeFixture(name);
    const base = name.replace(/\.[a-z]+$/, "");
    expect(r.archive.name).toBe(`${base}.polyjuice.zip`);
    expect(r.archive.mime).toBe("application/zip");

    const zip = await JSZip.loadAsync(r.archive.data);
    const entries = Object.values(zip.files);
    expect(entries.map((e) => e.name)).toEqual([...documents, `${base}.json`]);
    expect(entries.every((e) => !e.dir)).toBe(true);
    for (const f of [r.document, ...(r.alternate ? [r.alternate] : []), r.mapping]) {
      expect(await zip.file(f.name)?.async("uint8array")).toEqual(bytes(f));
    }
  });
});
