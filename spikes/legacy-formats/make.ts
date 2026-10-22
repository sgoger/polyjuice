// Spike « formats hérités » : génère des documents Office sources (données fictives) puis les convertit
// avec LibreOffice aux formats Office 97-2003 (.xls, .doc, .ppt) dans tests/real/legacy/ (ignoré par git).
// Usage : npm run legacy:make  (LibreOffice requis : soffice dans le PATH ou SOFFICE=<chemin>)
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  Document,
  ExternalHyperlink,
  Footer,
  FootnoteReferenceRun,
  Header,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
} from "docx";
import ExcelJS from "exceljs";
import PptxGenJS from "pptxgenjs";

const ROOT = join(import.meta.dirname, "../..");
const OUT = join(ROOT, "tests/real/legacy");
const SRC = join(OUT, "src");
mkdirSync(SRC, { recursive: true });

const FIRST = ["Paulina", "Jean", "Mehmet", "Klaus", "Sabine", "Oliver", "Emily", "Małgorzata", "Şükrü", "Ελένη"];
const LAST = [
  "Kowalski",
  "Dupont",
  "Yılmaz",
  "Müller",
  "Weber",
  "Hughes",
  "Clarke",
  "Zielińska",
  "Öztürk",
  "Παπαδοπούλου",
];
const person = (i: number) => `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]} ${i}`;

async function richXlsx(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Paulina Kowalski";
  wb.company = "Exemple SA";
  const ws = wb.addWorksheet("Personnel");
  ws.headerFooter.oddHeader = "&LConfidentiel — Paulina Kowalski&RPage &P";
  ws.addRow([
    "Nom",
    "Prénom",
    "E-mail",
    "Téléphone",
    "Entrée",
    "Salaire",
    "Actif",
    "Taux",
    "Libellé",
    "Annuel",
    "Erreur",
  ]);
  // 3 000 lignes : la table des chaînes partagées dépasse 8 224 octets (enregistrements CONTINUE).
  for (let i = 0; i < 3000; i++) {
    const [first = "", last = ""] = person(i).split(" ");
    const r = ws.addRow([
      `${last} ${i}`,
      first,
      `p${i}.${first.toLowerCase()}@example.org`,
      `06 12 34 ${String(i % 100).padStart(2, "0")} 78`,
      new Date(Date.UTC(2020, i % 12, 1 + (i % 28))),
      1500 + i * 1.25,
      i % 3 !== 0,
      (i % 100) / 100,
      null,
      null,
      null,
    ]);
    r.getCell(9).value = { formula: `B${r.number}&" "&A${r.number}`, result: `${first} ${last} ${i}` };
    r.getCell(10).value = { formula: `F${r.number}*12`, result: (1500 + i * 1.25) * 12 };
    if (i < 5) r.getCell(11).value = { formula: "1/0", result: { error: "#DIV/0!" } };
  }
  ws.getColumn(5).numFmt = "dd/mm/yyyy";
  ws.getColumn(6).numFmt = '#,##0.00 "€"';
  ws.getColumn(8).numFmt = "0%";
  ws.getColumn(1).width = 24;
  ws.getColumn(3).width = 32;
  ws.getColumn(11).hidden = true;
  ws.getCell("C2").value = { text: "p0.paulina@example.org", hyperlink: "mailto:p0.paulina@example.org" };
  ws.getCell("A2").note = "Note : vérifier avec Klaus Müller";

  const notes = wb.addWorksheet("Notes", { state: "hidden" });
  notes.addRow(["Polski : Małgorzata Zielińska, Łódź", "Türkçe : Şükrü Öztürk, İstanbul", "Ελληνικά : Ελένη"]);
  notes.addRow(["Émoji : 😀 réunion avec Jean Dupont", "  espaces  ", 'a < b & c > d "q"']);
  notes.mergeCells("A4:C5");
  notes.getCell("A4").value = "Cellule fusionnée — Sabine Weber";
  // Chaîne longue avec caractères non latins au milieu : coupure d'un tableau de caractères entre deux
  // enregistrements, avec changement de codage (octet d'options en tête du CONTINUE).
  notes.getCell("A7").value = "x".repeat(8000) + " Zielińska " + "y".repeat(9000) + " Oliver Hughes";
  notes.getCell("A8").value = "Ligne 1\nLigne 2 : Emily Clarke";
  wb.addWorksheet("Vide");
  return Buffer.from(await wb.xlsx.writeBuffer());
}

async function richDocx(): Promise<Buffer> {
  const cell = (t: string) => new TableCell({ children: [new Paragraph(t)] });
  const doc = new Document({
    creator: "Paulina Kowalski",
    footnotes: { 1: { children: [new Paragraph("Note : entretien avec Sabine Weber, +49 30 12345678.")] } },
    sections: [
      {
        headers: { default: new Header({ children: [new Paragraph("En-tête confidentiel — Paulina Kowalski")] }) },
        footers: { default: new Footer({ children: [new Paragraph("Pied de page — p.kowalski@example.org")] }) },
        children: [
          new Paragraph({
            children: [
              new TextRun("Compte rendu rédigé par "),
              new TextRun({ text: "Jean ", bold: true }),
              new TextRun({ text: "Dupont", italics: true }),
              new TextRun("."),
              new FootnoteReferenceRun(1),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun("Contact : "),
              new ExternalHyperlink({
                link: "mailto:jean.dupont@example.fr",
                children: [new TextRun({ text: "jean.dupont@example.fr", style: "Hyperlink" })],
              }),
            ],
          }),
          new Paragraph("Polski : Małgorzata Zielińska. Türkçe : Şükrü Öztürk. Ελληνικά : Ελένη. Émoji : 😀."),
          new Table({
            rows: [
              new TableRow({ children: ["Nom", "Téléphone", "IBAN"].map(cell) }),
              new TableRow({
                children: ["Klaus Müller", "06 12 34 56 78", "FR76 3000 6000 0112 3456 7890 189"].map(cell),
              }),
              new TableRow({
                children: ["Oliver Hughes", "+44 20 7946 0958", "DE89 3704 0044 0532 0130 00"].map(cell),
              }),
            ],
          }),
          // Texte long : plusieurs secteurs, plusieurs pièces.
          ...Array.from(
            { length: 300 },
            (_, i) => new Paragraph(`Paragraphe ${i} : ${person(i)} a appelé ${person(i + 1)}.`),
          ),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

async function richPptx(): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.author = "Paulina Kowalski";
  for (let i = 0; i < 12; i++) {
    const s = pptx.addSlide();
    s.addText(`Diapositive ${i + 1} : ${person(i)}`, { x: 0.5, y: 0.3, w: 9, h: 1, fontSize: 28 });
    s.addText(
      [
        { text: "Contact : ", options: { bold: true } },
        { text: `${person(i + 3)} — p${i}@example.org`, options: { breakLine: true } },
        { text: "Polski : Małgorzata Zielińska, Türkçe : Şükrü Öztürk, Ελληνικά : Ελένη 😀" },
      ],
      { x: 0.5, y: 1.5, w: 9, h: 1.5 },
    );
    if (i % 3 === 0)
      s.addTable(
        [
          ["Nom", "Téléphone"],
          [person(i + 5), "06 12 34 56 78"],
        ],
        { x: 0.5, y: 3.2, w: 6 },
      );
    s.addNotes(`Notes de l'orateur : rappeler ${person(i + 7)}.`);
  }
  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}

writeFileSync(join(SRC, "rich.xlsx"), await richXlsx());
writeFileSync(join(SRC, "rich.docx"), await richDocx());
writeFileSync(join(SRC, "rich.pptx"), await richPptx());
for (const f of ["sample.xlsx", "sample.docx", "sample.pptx"])
  copyFileSync(join(ROOT, "tests/fixtures", f), join(SRC, f));

const soffice = process.env.SOFFICE ?? "soffice";
const files = readdirSync(SRC);
for (const [from, to] of [
  ["xlsx", "xls"],
  ["docx", "doc"],
  ["pptx", "ppt"],
] as const) {
  const inputs = files.filter((f) => f.endsWith(`.${from}`)).map((f) => join(SRC, f));
  execFileSync(soffice, ["--headless", "--convert-to", to, "--outdir", OUT, ...inputs], { stdio: "inherit" });
}
console.log("Fichiers écrits dans", OUT);
