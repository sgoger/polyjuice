// Génère les fixtures de test dans tests/fixtures/ (données fictives, sortie reproductible).
// Usage : npm run fixtures
import { mkdir, writeFile } from "node:fs/promises";
import {
  CommentRangeEnd,
  CommentRangeStart,
  CommentReference,
  Document,
  ExternalHyperlink,
  Footer,
  FootnoteReferenceRun,
  Header,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  Textbox,
} from "docx";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { PDFDocument, StandardFonts } from "pdf-lib";
import PptxGenJS from "pptxgenjs";

const OUT = process.env.FIXTURES_OUT
  ? new URL(`file://${process.env.FIXTURES_OUT.replace(/\/?$/, "/")}`)
  : new URL("../tests/fixtures/", import.meta.url);
const FIXED_DATE = new Date(Date.UTC(2026, 0, 1, 0, 0, 0));
const FIXED_ISO = "2026-01-01T00:00:00Z";

type EntityType =
  "PERSON" | "EMAIL_ADDRESS" | "PHONE_NUMBER" | "IBAN_CODE" | "CREDIT_CARD" | "URL" | "IP_ADDRESS" | "FR_NIR";
type Kind = "body" | "header" | "footer" | "footnote" | "comment" | "notes" | "cell";
interface Expected {
  text: string;
  type: EntityType;
  kind: Kind;
}

// ---------------------------------------------------------------------------
// Données fictives

/** NIR fictif avec clé valide : clé = 97 − (13 premiers chiffres mod 97). */
function nir(first13: string): string {
  const key = 97 - Number(BigInt(first13) % 97n);
  const k = String(key).padStart(2, "0");
  const d = first13;
  return `${d[0]} ${d.slice(1, 3)} ${d.slice(3, 5)} ${d.slice(5, 7)} ${d.slice(7, 10)} ${d.slice(10, 13)} ${k}`;
}

const D = {
  // Personnes (détectées via la liste de noms des tests)
  paulina: "Paulina Kowalski",
  jean: "Jean Dupont",
  mehmet: "Mehmet Yılmaz",
  klaus: "Klaus Müller",
  sabine: "Sabine Weber",
  oliver: "Oliver Hughes",
  emily: "Emily Clarke",
  // Regex
  mailPaulina: "p.kowalski@example.org",
  mailJean: "jean.dupont@example.fr",
  mailKlaus: "klaus.mueller@example.de",
  mailOliver: "o.hughes@example.co.uk",
  telFr: "06 12 34 56 78",
  telFrIntl: "+33 1 23 45 67 89",
  telFr0033: "0033 6 98 76 54 32",
  telDe: "+49 30 12345678",
  telUk: "+44 20 7946 0958",
  nir: nir("1850578006084"),
  ibanFr: "FR76 3000 6000 0112 3456 7890 189",
  ibanDe: "DE89 3704 0044 0532 0130 00",
  ibanGb: "GB82 WEST 1234 5698 7654 32",
  card: "4111 1111 1111 1111",
  url: "https://intranet.example.fr/profil/jdupont",
  ipv4: "192.168.12.34",
  ipv6: "2001:db8::8a2e:370:7334",
} as const;

export const NAMES = [D.paulina, D.jean, D.mehmet, D.klaus, D.sabine, D.oliver, D.emily, "Bernard"];

// PNG 2×2 rouge
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==",
  "base64",
);

// ---------------------------------------------------------------------------
// Utilitaires

/** Rend un zip OOXML reproductible : dates fixes dans les entrées et dans docProps/core.xml. */
async function normalizeZip(buf: Uint8Array | Buffer, patch: Record<string, (xml: string) => string> = {}) {
  const zip = await JSZip.loadAsync(buf, { createFolders: false });
  const core = zip.file("docProps/core.xml");
  if (core) {
    const xml = (await core.async("string"))
      .replace(/(<dcterms:created[^>]*>)[^<]*/, `$1${FIXED_ISO}`)
      .replace(/(<dcterms:modified[^>]*>)[^<]*/, `$1${FIXED_ISO}`);
    zip.file("docProps/core.xml", xml, { createFolders: false });
  }
  for (const [name, fn] of Object.entries(patch)) {
    const f = zip.file(name);
    if (!f) throw new Error(`Partie absente : ${name}`);
    zip.file(name, fn(await f.async("string")), { createFolders: false });
  }
  for (const f of Object.values(zip.files)) f.date = FIXED_DATE;
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
}

const p = (text: string) => new Paragraph(text);

// ---------------------------------------------------------------------------
// DOCX

async function makeDocx(): Promise<Expected[]> {
  const doc = new Document({
    creator: D.paulina,
    lastModifiedBy: D.jean,
    title: `Rapport ${D.paulina}`,
    subject: "Données fictives",
    keywords: "test",
    description: "Fixture polyjuice",
    comments: {
      children: [
        {
          id: 0,
          author: D.klaus,
          initials: "KM",
          date: FIXED_DATE,
          children: [p(`À vérifier avec ${D.oliver} (${D.mailOliver}).`)],
        },
      ],
    },
    footnotes: { 1: { children: [p(`Source : entretien avec ${D.sabine}, ${D.telDe}.`)] } },
    sections: [
      {
        headers: { default: new Header({ children: [p(`Rapport confidentiel — ${D.paulina}`)] }) },
        footers: { default: new Footer({ children: [p(`Contact : ${D.mailPaulina} — ${D.telFr}`)] }) },
        children: [
          p("Rapport d'activité"),
          // Nom coupé sur deux runs de mise en forme différente
          new Paragraph({
            children: [
              new TextRun("Rédigé par "),
              new TextRun({ text: "Paulina Kow", italics: true }),
              new TextRun({ text: "alski", bold: true }),
              new TextRun(" le 3 mars 2026."),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun(`${D.jean}, NIR ${D.nir}, joignable au ${D.telFrIntl} ou au ${D.telFr0033}.`),
              new FootnoteReferenceRun(1),
            ],
          }),
          // Hyperlien dont le texte est un e-mail
          new Paragraph({
            children: [
              new TextRun("Écrire à "),
              new ExternalHyperlink({
                link: `mailto:${D.mailJean}`,
                children: [new TextRun({ text: D.mailJean, style: "Hyperlink" })],
              }),
              new TextRun("."),
            ],
          }),
          new Paragraph({
            children: [
              new CommentRangeStart(0),
              new TextRun(`Virement sur ${D.ibanFr} ou ${D.ibanDe}, carte ${D.card}.`),
              new CommentRangeEnd(0),
              new TextRun({ children: [new CommentReference(0)] }),
            ],
          }),
          p(`Profil : ${D.url} — poste ${D.ipv4} / ${D.ipv6}.`),
          p(`Dossier de ${D.mehmet}\tsuivi par ${D.emily}.`),
          new Paragraph({
            children: [new ImageRun({ type: "png", data: PNG, transformation: { width: 40, height: 40 } })],
          }),
          new Table({
            rows: [
              ["Nom", "E-mail", "Téléphone"],
              [D.klaus, D.mailKlaus, D.telDe],
              [D.oliver, D.mailOliver, D.telUk],
            ].map((r) => new TableRow({ children: r.map((c) => new TableCell({ children: [p(c)] })) })),
          }),
          new Textbox({
            style: { width: "200pt", height: "50pt" },
            children: [p(`Encadré : ${D.emily}, ${D.telUk}`)],
          }),
          p(`Contact UK : ${D.ibanGb}.`),
        ],
      },
    ],
  });
  // docx génère des identifiants de relation aléatoires pour les hyperliens.
  const fixIds = (xml: string) => xml.replace(/rId[a-z0-9_-]{16,}/g, "rIdLink1");
  // docx ne produit qu'une zone de texte VML : on l'enveloppe dans mc:AlternateContent avec une
  // branche DrawingML (wps), comme le fait Word, pour couvrir les deux branches.
  const wrapTextbox = (xml: string) =>
    fixIds(xml)
      .replace(/<v:shape id="[^"]+"/, '<v:shape id="Textbox1"')
      .replace(
        /<w:pict>(.*?<w:txbxContent>(.*?)<\/w:txbxContent>.*?)<\/w:pict>/s,
        (_m, pict: string, content: string) =>
          [
            '<mc:AlternateContent><mc:Choice Requires="wps"><w:drawing>',
            '<wp:anchor distT="0" distB="0" distL="114300" distR="114300" simplePos="0" relativeHeight="251659264" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1">',
            '<wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="column"><wp:posOffset>0</wp:posOffset></wp:positionH>',
            '<wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV>',
            '<wp:extent cx="2540000" cy="635000"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapSquare wrapText="bothSides"/>',
            '<wp:docPr id="100" name="Zone de texte 1"/><wp:cNvGraphicFramePr/>',
            '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape">',
            '<wps:wsp><wps:cNvSpPr txBox="1"/><wps:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="2540000" cy="635000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></wps:spPr>',
            `<wps:txbx><w:txbxContent>${content}</w:txbxContent></wps:txbx><wps:bodyPr/></wps:wsp>`,
            "</a:graphicData></a:graphic></wp:anchor></w:drawing></mc:Choice>",
            `<mc:Fallback><w:pict>${pict}</w:pict></mc:Fallback></mc:AlternateContent>`,
          ].join(""),
      );
  await writeFile(
    new URL("sample.docx", OUT),
    await normalizeZip(await Packer.toBuffer(doc), {
      "word/document.xml": wrapTextbox,
      "word/_rels/document.xml.rels": fixIds,
    }),
  );
  return [
    { text: D.paulina, type: "PERSON", kind: "header" },
    { text: D.mailPaulina, type: "EMAIL_ADDRESS", kind: "footer" },
    { text: D.telFr, type: "PHONE_NUMBER", kind: "footer" },
    { text: D.paulina, type: "PERSON", kind: "body" },
    { text: D.jean, type: "PERSON", kind: "body" },
    { text: D.nir, type: "FR_NIR", kind: "body" },
    { text: D.telFrIntl, type: "PHONE_NUMBER", kind: "body" },
    { text: D.telFr0033, type: "PHONE_NUMBER", kind: "body" },
    { text: D.mailJean, type: "EMAIL_ADDRESS", kind: "body" },
    { text: D.ibanFr, type: "IBAN_CODE", kind: "body" },
    { text: D.ibanDe, type: "IBAN_CODE", kind: "body" },
    { text: D.card, type: "CREDIT_CARD", kind: "body" },
    { text: D.url, type: "URL", kind: "body" },
    { text: D.ipv4, type: "IP_ADDRESS", kind: "body" },
    { text: D.ipv6, type: "IP_ADDRESS", kind: "body" },
    { text: D.mehmet, type: "PERSON", kind: "body" },
    { text: D.emily, type: "PERSON", kind: "body" },
    { text: D.klaus, type: "PERSON", kind: "body" },
    { text: D.mailKlaus, type: "EMAIL_ADDRESS", kind: "body" },
    { text: D.telDe, type: "PHONE_NUMBER", kind: "body" },
    { text: D.oliver, type: "PERSON", kind: "body" },
    { text: D.mailOliver, type: "EMAIL_ADDRESS", kind: "body" },
    { text: D.telUk, type: "PHONE_NUMBER", kind: "body" },
    { text: D.ibanGb, type: "IBAN_CODE", kind: "body" },
    { text: D.sabine, type: "PERSON", kind: "footnote" },
    { text: D.telDe, type: "PHONE_NUMBER", kind: "footnote" },
    { text: D.oliver, type: "PERSON", kind: "comment" },
    { text: D.mailOliver, type: "EMAIL_ADDRESS", kind: "comment" },
  ];
}

// ---------------------------------------------------------------------------
// PPTX

const sp = (id: number, name: string, text: string, y: number) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>` +
  `<p:spPr><a:xfrm><a:off x="457200" y="${y}"/><a:ext cx="3000000" cy="400000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>` +
  `<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="fr-FR"/><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp>`;
const grpProps = (id: number, name: string) =>
  `<p:nvGrpSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
  `<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>`;

async function makePptx(): Promise<Expected[]> {
  const pptx = new PptxGenJS();
  pptx.author = D.paulina;
  pptx.company = "Exemple SA";
  pptx.title = "Projet Atlas";
  const s = pptx.addSlide();
  s.addText(
    [
      { text: "Projet Atlas — " },
      { text: "Paulina ", options: { bold: true } },
      { text: "Kowalski", options: { bold: true, color: "C00000" } },
    ],
    { x: 0.5, y: 0.3, w: 9, h: 0.8, fontSize: 28 },
  );
  s.addText(`Contact : ${D.mailPaulina}, ${D.telFr}`, { x: 0.5, y: 1.2, w: 9, h: 0.5 });
  s.addImage({ data: "image/png;base64," + PNG.toString("base64"), x: 8.5, y: 4.5, w: 0.5, h: 0.5 });
  s.addTable(
    [
      [{ text: "Nom" }, { text: "E-mail" }],
      [{ text: D.jean }, { text: D.mailJean }],
    ],
    { x: 0.5, y: 2, w: 9 },
  );
  s.addNotes(`Appeler ${D.klaus} au ${D.telDe}.`);
  const s2 = pptx.addSlide();
  s2.addText(`IBAN : ${D.ibanDe}`, { x: 0.5, y: 0.5, w: 9, h: 0.5 });

  const group =
    `<p:grpSp>${grpProps(100, "Groupe 1")}${sp(101, "Texte groupe", `Équipe : ${D.emily}`, 3800000)}` +
    `<p:grpSp>${grpProps(102, "Groupe imbriqué")}${sp(103, "Texte imbriqué", `Écrire à ${D.mailOliver}`, 4300000)}</p:grpSp></p:grpSp>`;
  const buf = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  await writeFile(
    new URL("sample.pptx", OUT),
    await normalizeZip(buf, { "ppt/slides/slide1.xml": (xml) => xml.replace("</p:spTree>", `${group}</p:spTree>`) }),
  );
  return [
    { text: D.paulina, type: "PERSON", kind: "body" },
    { text: D.mailPaulina, type: "EMAIL_ADDRESS", kind: "body" },
    { text: D.telFr, type: "PHONE_NUMBER", kind: "body" },
    { text: D.jean, type: "PERSON", kind: "cell" },
    { text: D.mailJean, type: "EMAIL_ADDRESS", kind: "cell" },
    { text: D.klaus, type: "PERSON", kind: "notes" },
    { text: D.telDe, type: "PHONE_NUMBER", kind: "notes" },
    { text: D.emily, type: "PERSON", kind: "body" },
    { text: D.mailOliver, type: "EMAIL_ADDRESS", kind: "body" },
    { text: D.ibanDe, type: "IBAN_CODE", kind: "body" },
  ];
}

// ---------------------------------------------------------------------------
// XLSX

async function makeXlsx(): Promise<Expected[]> {
  const wb = new ExcelJS.Workbook();
  wb.creator = D.paulina;
  wb.lastModifiedBy = D.jean;
  wb.created = FIXED_DATE;
  wb.modified = FIXED_DATE;
  const ws = wb.addWorksheet("Contacts");
  ws.addRow(["Nom", "Prénom", "Email", "Téléphone", "Montant", "Date", "Commentaire"]);
  ws.addRow(["Dupont", "Jean", D.mailJean, D.telFr, 1250.5, FIXED_DATE, "RAS"]);
  ws.addRow(["Müller", "Klaus", D.mailKlaus, D.telDe, 980, new Date(Date.UTC(2026, 1, 15)), "RAS"]);
  ws.addRow(["Hughes", "Oliver", D.mailOliver, D.telUk, 1500, new Date(Date.UTC(2026, 2, 1)), null]);
  // Chaîne partagée réutilisée dans deux colonnes
  ws.addRow(["Bernard", "Bernard", "bernard@example.fr", D.telFrIntl, 300, new Date(Date.UTC(2026, 3, 1)), null]);
  ws.getCell("G4").value = {
    richText: [{ text: "Voir " }, { text: D.paulina, font: { bold: true } }, { text: " (référente)" }],
  };
  ws.getCell("D7").value = "Total";
  ws.getCell("E7").value = { formula: "SUM(E2:E5)", result: 4030.5 };
  wb.addWorksheet("Équipe Dupont").addRow(["Placeholder"]);

  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  // Cellule en chaîne inline (exceljs n'en produit pas) dans la deuxième feuille.
  const inline = `<c r="A1" t="inlineStr"><is><t>Rappeler ${D.sabine} au ${D.telDe}</t></is></c>`;
  await writeFile(
    new URL("sample.xlsx", OUT),
    await normalizeZip(buf, {
      "xl/worksheets/sheet2.xml": (xml) => xml.replace(/<c r="A1"[^>]*>.*?<\/c>/s, inline),
    }),
  );
  return [
    { text: "Dupont", type: "PERSON", kind: "cell" },
    { text: "Jean", type: "PERSON", kind: "cell" },
    { text: "Müller", type: "PERSON", kind: "cell" },
    { text: "Klaus", type: "PERSON", kind: "cell" },
    { text: "Hughes", type: "PERSON", kind: "cell" },
    { text: "Oliver", type: "PERSON", kind: "cell" },
    { text: "Bernard", type: "PERSON", kind: "cell" },
    { text: D.mailJean, type: "EMAIL_ADDRESS", kind: "cell" },
    { text: D.mailKlaus, type: "EMAIL_ADDRESS", kind: "cell" },
    { text: D.mailOliver, type: "EMAIL_ADDRESS", kind: "cell" },
    { text: "bernard@example.fr", type: "EMAIL_ADDRESS", kind: "cell" },
    { text: D.telFr, type: "PHONE_NUMBER", kind: "cell" },
    { text: D.telDe, type: "PHONE_NUMBER", kind: "cell" },
    { text: D.telUk, type: "PHONE_NUMBER", kind: "cell" },
    { text: D.telFrIntl, type: "PHONE_NUMBER", kind: "cell" },
    { text: D.paulina, type: "PERSON", kind: "cell" },
    { text: D.sabine, type: "PERSON", kind: "cell" },
  ];
}

// ---------------------------------------------------------------------------
// PDF (polices standard : jeu de caractères WinAnsi, pas de ł ni de ı)

async function makePdfs(): Promise<Expected[]> {
  const pdf = await PDFDocument.create();
  pdf.setCreationDate(FIXED_DATE);
  pdf.setModificationDate(FIXED_DATE);
  pdf.setProducer("polyjuice fixtures");
  pdf.setCreator("polyjuice fixtures");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = [
    [
      "Compte rendu de réunion",
      "",
      `Participants : ${D.jean} et ${D.klaus}.`,
      `Contact : ${D.mailJean}, téléphone ${D.telFr}.`,
      "",
      `Le dossier de ${D.oliver} est suivi par l'équipe (${D.mailOliver}).`,
      `Virement attendu sur ${D.ibanFr}.`,
      "",
      "La séance a porté sur le calendrier du projet et sur la répartition des tâches entre les équipes.",
      "Les décisions seront confirmées lors de la prochaine réunion du comité de pilotage.",
    ],
    [
      `Annexe : NIR ${D.nir}`,
      "",
      `Accès au portail : ${D.url} depuis ${D.ipv4}.`,
      `Ligne directe : ${D.telDe}.`,
      "",
      "Les accès sont personnels et ne doivent pas être partagés en dehors de l'équipe projet.",
      "Toute demande de modification passe par le formulaire habituel du service informatique.",
    ],
  ];
  for (const lines of pages) {
    const page = pdf.addPage([595, 842]);
    lines.forEach((line, i) => {
      page.drawText(line, { x: 50, y: 780 - i * 18, size: 11, font });
    });
  }
  await writeFile(new URL("sample.pdf", OUT), await pdf.save({ useObjectStreams: false }));

  // « Scanné » : une page contenant uniquement une image.
  const scan = await PDFDocument.create();
  scan.setCreationDate(FIXED_DATE);
  scan.setModificationDate(FIXED_DATE);
  scan.setProducer("polyjuice fixtures");
  scan.setCreator("polyjuice fixtures");
  const img = await scan.embedPng(PNG);
  scan.addPage([595, 842]).drawImage(img, { x: 0, y: 0, width: 595, height: 842 });
  await writeFile(new URL("scanned.pdf", OUT), await scan.save({ useObjectStreams: false }));

  return [
    { text: D.jean, type: "PERSON", kind: "body" },
    { text: D.klaus, type: "PERSON", kind: "body" },
    { text: D.mailJean, type: "EMAIL_ADDRESS", kind: "body" },
    { text: D.telFr, type: "PHONE_NUMBER", kind: "body" },
    { text: D.oliver, type: "PERSON", kind: "body" },
    { text: D.mailOliver, type: "EMAIL_ADDRESS", kind: "body" },
    { text: D.ibanFr, type: "IBAN_CODE", kind: "body" },
    { text: D.nir, type: "FR_NIR", kind: "body" },
    { text: D.url, type: "URL", kind: "body" },
    { text: D.ipv4, type: "IP_ADDRESS", kind: "body" },
    { text: D.telDe, type: "PHONE_NUMBER", kind: "body" },
  ];
}

// ---------------------------------------------------------------------------
// Markdown et texte

const PROTECTED_MD = { linkTarget: "lien.cible@example.org", codeBlock: "code.bloc@example.org" };

async function makeText(): Promise<{ md: Expected[]; txt: Expected[] }> {
  const md = [
    "# Compte rendu",
    "",
    `Rédigé par **${D.paulina}** (${D.mailPaulina}).`,
    "",
    `- Participant : ${D.mehmet}, ${D.telFrIntl}`,
    `- Teilnehmer: ${D.klaus}, ${D.telDe}`,
    `- Attendee: ${D.oliver}, ${D.telUk}`,
    "",
    `Écrire à [${D.mailJean}](mailto:${PROTECTED_MD.linkTarget}) ou voir [le profil](${D.url}).`,
    "",
    `![Photo de ${D.emily}](images/${PROTECTED_MD.linkTarget}.png)`,
    "",
    "```",
    `contact = "${PROTECTED_MD.codeBlock}"`,
    "```",
    "",
    `IBAN : ${D.ibanGb} — NIR : ${D.nir} — IP : ${D.ipv6}`,
    "",
  ].join("\n");
  await writeFile(new URL("sample.md", OUT), md);

  const txt = [
    `Note interne — ${D.sabine}`,
    "",
    `Merci de rappeler ${D.jean} au ${D.telFr} ou d'écrire à ${D.mailJean}.`,
    `Rückruf: ${D.klaus}, ${D.telDe}, ${D.mailKlaus}.`,
    `Carte : ${D.card}. Serveur : ${D.ipv4}.`,
    "",
  ].join("\r\n");
  // BOM UTF-8 + fins de ligne CRLF
  await writeFile(new URL("sample.txt", OUT), Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(txt)]));

  return {
    md: [
      { text: D.paulina, type: "PERSON", kind: "body" },
      { text: D.mailPaulina, type: "EMAIL_ADDRESS", kind: "body" },
      { text: D.mehmet, type: "PERSON", kind: "body" },
      { text: D.telFrIntl, type: "PHONE_NUMBER", kind: "body" },
      { text: D.klaus, type: "PERSON", kind: "body" },
      { text: D.telDe, type: "PHONE_NUMBER", kind: "body" },
      { text: D.oliver, type: "PERSON", kind: "body" },
      { text: D.telUk, type: "PHONE_NUMBER", kind: "body" },
      { text: D.mailJean, type: "EMAIL_ADDRESS", kind: "body" },
      { text: D.emily, type: "PERSON", kind: "body" },
      { text: D.ibanGb, type: "IBAN_CODE", kind: "body" },
      { text: D.nir, type: "FR_NIR", kind: "body" },
      { text: D.ipv6, type: "IP_ADDRESS", kind: "body" },
    ],
    txt: [
      { text: D.sabine, type: "PERSON", kind: "body" },
      { text: D.jean, type: "PERSON", kind: "body" },
      { text: D.telFr, type: "PHONE_NUMBER", kind: "body" },
      { text: D.mailJean, type: "EMAIL_ADDRESS", kind: "body" },
      { text: D.klaus, type: "PERSON", kind: "body" },
      { text: D.telDe, type: "PHONE_NUMBER", kind: "body" },
      { text: D.mailKlaus, type: "EMAIL_ADDRESS", kind: "body" },
      { text: D.card, type: "CREDIT_CARD", kind: "body" },
      { text: D.ipv4, type: "IP_ADDRESS", kind: "body" },
    ],
  };
}

// ---------------------------------------------------------------------------

await mkdir(OUT, { recursive: true });
const text = await makeText();
const expected = {
  names: NAMES,
  columns: ["Nom", "Prénom"],
  protected: { md: Object.values(PROTECTED_MD) },
  fixtures: {
    "sample.docx": await makeDocx(),
    "sample.pptx": await makePptx(),
    "sample.xlsx": await makeXlsx(),
    "sample.pdf": await makePdfs(),
    "scanned.pdf": [],
    "sample.md": text.md,
    "sample.txt": text.txt,
  },
};
await writeFile(new URL("expected.json", OUT), JSON.stringify(expected, null, 2) + "\n");
await writeFile(new URL("fixture-names.txt", OUT), ["# Liste de noms fictifs des fixtures", ...NAMES, ""].join("\n"));
console.log("Fixtures écrites dans", OUT.pathname);
