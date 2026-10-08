// Génère token_survival.docx et token_survival.md + la liste attendue.
import { mkdir, writeFile } from "node:fs/promises";
import { Document, FootnoteReferenceRun, Packer, Paragraph, Table, TableCell, TableRow, TextRun } from "docx";
import { FOOTNOTE, SENTENCES, TABLE_ROWS, TOKENS } from "./sentences.ts";

const OUT = new URL("./out/", import.meta.url);
await mkdir(OUT, { recursive: true });

const doc = new Document({
  footnotes: { 1: { children: [new Paragraph(FOOTNOTE)] } },
  sections: [
    {
      children: [
        ...SENTENCES.map((s) => new Paragraph(s)),
        new Table({
          rows: TABLE_ROWS.map(
            (row) => new TableRow({ children: row.map((c) => new TableCell({ children: [new Paragraph(c)] })) }),
          ),
        }),
        new Paragraph({ children: [new TextRun("Voir la note."), new FootnoteReferenceRun(1)] }),
      ],
    },
  ],
});
await writeFile(new URL("token_survival.docx", OUT), await Packer.toBuffer(doc));

const md = [
  "# Token survival",
  "",
  ...SENTENCES.flatMap((s) => [s, ""]),
  `| ${TABLE_ROWS[0]!.join(" | ")} |`,
  `|${TABLE_ROWS[0]!.map(() => "---").join("|")}|`,
  ...TABLE_ROWS.slice(1).map((r) => `| ${r.join(" | ")} |`),
  "",
  "Voir la note.[^1]",
  "",
  `[^1]: ${FOOTNOTE}`,
  "",
].join("\n");
await writeFile(new URL("token_survival.md", OUT), md);

const all = [...SENTENCES, ...TABLE_ROWS.flat(), FOOTNOTE].join("\n");
const expected = Object.fromEntries(TOKENS.map((t) => [t, all.split(t).length - 1]));
await writeFile(new URL("token_survival.expected.json", OUT), JSON.stringify(expected, null, 2) + "\n");
console.log("Écrit dans", OUT.pathname, expected);
