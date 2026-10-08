import { describe, expect, it } from "vitest";
import { mdAdapter, protectedRanges, txtAdapter } from "../../src/adapters/text.ts";
import { anonymize } from "../../src/worker/pipeline.ts";
import { anonymizeFixture, ctx, expected, fixture, readDoc, roundTrip, text } from "./helpers.ts";

const enc = (s: string) => new TextEncoder().encode(s).buffer;

describe("adaptateur texte / Markdown", () => {
  it.each(["sample.md", "sample.txt"])("round-trip %s : octets identiques après restauration", async (name) => {
    const { restored } = await roundTrip(name);
    expect(new Uint8Array(restored.document.data)).toEqual(new Uint8Array(fixture(name)));
    expect(restored.unknownTokens).toEqual([]);
    expect(restored.summary.missing).toEqual([]);
  });

  it.each(["sample.md", "sample.txt"])("round-trip %s segment par segment", async (name) => {
    const { restored } = await roundTrip(name);
    const before = await readDoc(name, fixture(name));
    const after = await readDoc(name, restored.document.data);
    expect(after.segments.map((s) => s.text)).toEqual(before.segments.map((s) => s.text));
  });

  it.each(["sample.md", "sample.txt"])("aucune entité attendue en clair dans %s anonymisé", async (name) => {
    const out = text((await anonymizeFixture(name)).document.data);
    for (const e of expected.fixtures[name] ?? []) expect(out, e.text).not.toContain(e.text);
  });

  it("préserve BOM et CRLF", async () => {
    const out = new Uint8Array((await anonymizeFixture("sample.txt")).document.data);
    expect([...out.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const s = new TextDecoder().decode(out);
    expect(s.split("\r\n")).toHaveLength(6);
    expect(s.replace(/\r\n/g, "")).not.toContain("\n");
  });

  it("e-mail dans une cible de lien intact, le même dans le texte du lien anonymisé", async () => {
    const src = "Écrire à [a.b@example.org](mailto:a.b@example.org) ou ![x](img/a.b@example.org.png).\n";
    const r = await anonymize(
      { file: enc(src), fileName: "x.md", names: "", ner: false, columns: [], mapping: null },
      ctx,
    );
    expect(text(r.document.data)).toMatch(
      /^Écrire à \[⟦E-[A-Z0-9]{5}⟧\]\(mailto:a\.b@example\.org\) ou !\[x\]\(img\/a\.b@example\.org\.png\)\.\n$/,
    );
  });

  it("ne touche pas aux blocs de code clôturés", async () => {
    const src = "a@example.org\n```js\nconst m = 'b@example.org';\n```\n~~~\nc@example.org\n~~~\nd@example.org";
    const out = text(
      (await anonymize({ file: enc(src), fileName: "x.md", names: "", ner: false, columns: [], mapping: null }, ctx))
        .document.data,
    );
    expect(out).not.toContain("a@example.org");
    expect(out).toContain("const m = 'b@example.org';");
    expect(out).toContain("\nc@example.org\n");
    expect(out).not.toContain("d@example.org");
  });

  it("le .txt ne protège pas les crochets", async () => {
    const doc = await txtAdapter.read(enc("[a](mailto:x@y.org)"));
    expect(doc.segments.map((s) => s.text)).toEqual(["[a](mailto:x@y.org)"]);
    const md = await mdAdapter.read(enc("[a](mailto:x@y.org)"));
    expect(md.segments.map((s) => s.text)).toEqual(["[a]"]);
  });

  it("parenthèses équilibrées dans les cibles", () => {
    const line = "[w](https://fr.wikipedia.org/wiki/A_(b)) suite";
    const [[s, e] = [0, 0]] = protectedRanges(line);
    expect(line.slice(s, e)).toBe("(https://fr.wikipedia.org/wiki/A_(b))");
  });

  it("réutiliser le mapping redonne le même document octet pour octet", async () => {
    const first = await anonymizeFixture("sample.md");
    const second = await anonymizeFixture("sample.md", { mapping: text(first.mapping.data) });
    expect(new Uint8Array(second.document.data)).toEqual(new Uint8Array(first.document.data));
  });
});
