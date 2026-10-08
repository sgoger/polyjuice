// Génère trois documents « complexes » (styles, image, tableau, en-tête) pour le spike.
import { AlignmentType, Document, Footer, Header, HeadingLevel, ImageRun, Packer, Paragraph, Table, TableCell, TableRow, TextRun } from "docx";
import ExcelJS from "exceljs";
import PptxGenJS from "pptxgenjs";

// PNG 2×2 rouge.
export const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==",
  "base64",
);

export async function makeDocx(): Promise<Buffer> {
  const doc = new Document({
    creator: "Paulina Kowalski",
    title: "Rapport confidentiel",
    sections: [
      {
        headers: { default: new Header({ children: [new Paragraph("En-tête : Paulina Kowalski")] }) },
        footers: { default: new Footer({ children: [new Paragraph("Pied de page — p.kowalski@example.org")] }) },
        children: [
          new Paragraph({ text: "Rapport", heading: HeadingLevel.HEADING_1 }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            children: [
              new TextRun({ text: "Rédigé par ", italics: true }),
              new TextRun({ text: "Paulina ", bold: true }),
              new TextRun({ text: "Kowalski", bold: true, color: "FF0000" }),
              new TextRun("  avec espaces  & entités <ok> \"guillemets\" 'apostrophes'."),
            ],
          }),
          new Paragraph({ children: [new ImageRun({ type: "png", data: PNG, transformation: { width: 40, height: 40 } })] }),
          new Table({
            rows: [
              new TableRow({ children: ["Nom", "E-mail"].map((t) => new TableCell({ children: [new Paragraph(t)] })) }),
              new TableRow({
                children: ["Jean Dupont", "jean.dupont@example.fr"].map((t) => new TableCell({ children: [new Paragraph(t)] })),
              }),
            ],
          }),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

export async function makePptx(): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.author = "Paulina Kowalski";
  const s = pptx.addSlide();
  s.addText([{ text: "Présenté par " }, { text: "Paulina Kowalski", options: { bold: true } }], { x: 1, y: 1, w: 6, h: 1 });
  s.addImage({ data: "image/png;base64," + PNG.toString("base64"), x: 1, y: 2, w: 1, h: 1 });
  s.addTable([[{ text: "Nom" }, { text: "Jean Dupont" }]], { x: 1, y: 3.5, w: 6 });
  s.addNotes("Notes : appeler Jean Dupont au +33 6 12 34 56 78");
  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}

export async function makeXlsx(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Paulina Kowalski";
  const ws = wb.addWorksheet("Feuille 1");
  ws.addRow(["Nom", "Prénom", "Montant", "Date"]);
  ws.addRow(["Dupont", "Jean", 1234.5, new Date(Date.UTC(2026, 0, 15))]);
  ws.addRow(["Kowalski", "Paulina", 99, new Date(Date.UTC(2026, 1, 1))]);
  ws.getCell("C4").value = { formula: "SUM(C2:C3)" };
  ws.getCell("A5").value = { richText: [{ text: "Riche ", font: { bold: true } }, { text: "Dupont" }] };
  return Buffer.from(await wb.xlsx.writeBuffer());
}
