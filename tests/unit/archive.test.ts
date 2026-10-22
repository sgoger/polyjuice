import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import type { OutputFile } from "../../src/worker/protocol.ts";
import { anonymizeFixture } from "./helpers.ts";

const bytes = (f: OutputFile) => new Uint8Array(f.data);

describe("archive produite par l'anonymisation", () => {
  it.each([
    ["sample.docx", "sample.anonymise.docx"],
    ["sample.pdf", "sample.anonymise.md"],
    ["sample.xlsx", "sample.anonymise.xlsx"],
  ])("%s : trois entrées, octets identiques aux fichiers individuels", async (name, documentName) => {
    const r = await anonymizeFixture(name);
    expect(r.archive.name).toBe("sample.polyjuice.zip");
    expect(r.archive.mime).toBe("application/zip");

    const zip = await JSZip.loadAsync(r.archive.data);
    const entries = Object.values(zip.files);
    expect(entries.map((e) => e.name)).toEqual([documentName, "sample.json", "sample.report.md"]);
    expect(entries.every((e) => !e.dir)).toBe(true);
    for (const f of [r.document, r.mapping, r.report]) {
      expect(await zip.file(f.name)?.async("uint8array")).toEqual(bytes(f));
    }
  });
});
