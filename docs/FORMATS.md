# What is processed, format by format

"Processed": the text is analyzed and detected data is replaced with tokens. "Flagged": not modified, but a warning is shown (banner, report, mapping) or the item is listed by « Vérifier » (verify). "Flagged at drop time": a warning banner appears as soon as the file is dropped, before any processing, with the steps to remove the item in Office; processing stays possible and the warning is repeated afterwards. "Ignored": neither modified nor flagged.

## `.txt`, `.md`

| Item                                   | Status                  |
| -------------------------------------- | ----------------------- |
| Text, line by line                     | processed               |
| Markdown link text `[text](…)`         | processed               |
| Link and image targets `](…)`          | ignored (never changed) |
| Fenced code blocks (` ``` `, `~~~`)    | ignored (never changed) |
| Inline code `` `…` ``                  | processed               |
| Line endings (`\n`, `\r\n`), UTF-8 BOM | preserved               |

## `.docx`

| Item                                                                                                                                           | Status                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Body, tables, headers, footers, footnotes and endnotes, comments                                                                               | processed                                                                        |
| Text boxes (both branches of `mc:AlternateContent`)                                                                                            | processed                                                                        |
| Hyperlinks (displayed text), smart tags, tracked insertions (`w:ins`)                                                                          | processed                                                                        |
| Tracked deletions (`w:del`, `w:moveFrom`)                                                                                                      | ignored                                                                          |
| Tabs, line breaks, drawings, note references inside runs                                                                                       | preserved                                                                        |
| Formatting of untouched runs                                                                                                                   | preserved; a replacement spanning several runs takes the formatting of the first |
| Metadata (`docProps/core.xml`: author, last modified by, title, subject, keywords, description, category, status; `app.xml`: company, manager) | cleared; creation and modification dates set to January 1, 2000; flagged         |
| Custom properties (`docProps/custom.xml`)                                                                                                      | removed; flagged                                                                 |
| Images (`word/media`)                                                                                                                          | flagged (no OCR)                                                                 |
| SmartArt (`word/diagrams`), charts (`word/charts`), OLE objects (`word/embeddings`)                                                            | flagged                                                                          |
| Hyperlink targets (`*.rels`, e.g. `mailto:`)                                                                                                   | flagged if data is detected in them                                              |
| Field codes (`w:instrText`)                                                                                                                    | flagged if data is detected in them                                              |
| Comment and revision author names, `word/people.xml`, track changes switched on (`w:trackRevisions`)                                           | flagged at drop time (with comment and revision counts) and after processing     |
| Titles copied into `docProps/app.xml`                                                                                                          | flagged                                                                          |
| All other parts (styles, theme, numbering…)                                                                                                    | copied byte for byte                                                             |

## `.pptx`

| Item                                                                                                   | Status                                                                     |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Shapes, nested groups (at any depth), tables                                                           | processed                                                                  |
| Speaker notes                                                                                          | processed                                                                  |
| Masters and layouts (paragraphs containing text)                                                       | processed                                                                  |
| `a:fld` fields (slide number, date)                                                                    | ignored                                                                    |
| Metadata                                                                                               | same as `.docx`                                                            |
| Images (`ppt/media`), SmartArt (`ppt/diagrams`), charts (`ppt/charts`), OLE objects (`ppt/embeddings`) | flagged                                                                    |
| Slide comments (legacy and modern) and their authors                                                   | flagged at drop time and after processing (text and authors not processed) |
| Hyperlink targets                                                                                      | flagged if data is detected in them                                        |
| Slide titles copied into `docProps/app.xml`                                                            | flagged                                                                    |

## `.xlsx`

| Item                                                              | Status                                                                         |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Shared strings (`xl/sharedStrings.xml`), including rich text      | processed                                                                      |
| Inline string cells (`inlineStr`)                                 | processed                                                                      |
| Columns to anonymize (header = first non-empty row of each sheet) | all text cells fully replaced (« Personne » (person) type); the header is kept |
| Shared string used by several cells                               | replaced once, so in all its cells; flagged when it is used in several columns |
| Formulas, numbers, dates, booleans                                | never touched                                                                  |
| Sheet names (`xl/workbook.xml`)                                   | never changed; listed by « Vérifier » if they contain detected data            |
| Styles, charts, conditional formatting                            | copied byte for byte                                                           |
| Macros (`xl/vbaProject.bin`)                                      | copied; flagged                                                                |
| Cell comments, notes and their authors                            | flagged at drop time and after processing (text and authors not processed)     |
| Metadata                                                          | same as `.docx`                                                                |
| AI detection                                                      | always disabled (patterns, name list and columns only)                         |

## `.pdf`

### Why a PDF is not edited like a Word document

A `.docx` stores its text in XML text nodes: replacing « Jean Dupont » with `⟦P-K7M2X⟧` is a string replacement, and Word lays the paragraph out again when it opens the file. A PDF has no paragraphs to lay out again. Its text is a sequence of drawing instructions (`Tj`, `TJ`) that place each glyph at a fixed position, often in fonts embedded as subsets that only contain the glyphs the document uses. Replacing a name therefore raises layout and font problems, not text problems: the token does not have the width of the name, its characters (`⟦`, `⟧`, often letters and digits too) are missing from the embedded font, and the original text must really leave the file. A black rectangle drawn over a name hides it on screen but leaves it in the file, where any text extraction or copy-paste finds it.

### What polyjuice does

The text is first extracted with pdf.js and processed as plain text, which gives the `.md` version. Then, when it can be done safely, the PDF itself is rewritten ("redaction"):

- the glyphs of every detected value are **removed** from the page content, and the space they took is kept, so the rest of the line does not move;
- the token is drawn in their place, on a light grey background, in Helvetica (a standard PDF font, referenced by name: nothing is embedded or downloaded). Helvetica has no `⟦ ⟧` glyphs, so the token is **displayed** as `[P-K7M2X]` but **copied and extracted** as `⟦P-K7M2X⟧` (the font's `ToUnicode` table maps `[` and `]` to `⟦` and `⟧`). It is narrowed, then made smaller, when the value is shorter than the token;
- the pages are copied into a new file that keeps only what is drawn: annotations (links, comments), bookmarks, the accessibility structure of tagged PDFs, the alternate text of marked content (`ActualText`), attached files, scripts, the metadata (title, author…) and the earlier revisions of the file are dropped;
- the result is **read back with pdf.js before it is offered**: if a detected value can still be found in its text, or in any object of the file (decompressed), or if a token cannot be read, the PDF is refused.

When the PDF is refused, only the `.md` is produced and the warning says why. The `.md` is produced in every case: it is what LLMs and translation tools read best, and it is the file the « Restaurer » (restore) tab accepts.

| Item                                                                                     | Status                                                                                               |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Page text                                                                                | extracted as Markdown (paragraphs, `---` between pages), then processed as plain text: `.md` version |
| Text drawn with simple fonts (Type1, TrueType) and composite fonts (Type0, `Identity-H`) | rewritten in the PDF (glyphs removed, token drawn in place, layout kept)                             |
| Text in form XObjects (headers, footers, stamps)                                         | rewritten                                                                                            |
| A value split across several text operators, kerned, or cut at the end of a line         | rewritten (the token is drawn where the value starts)                                                |
| Type3 fonts, composite fonts with another encoding or without a `ToUnicode` table        | not rewritten: if a detected value uses them, the PDF is refused (`.md` only)                        |
| Invisible text over an image (OCR layer of a scanned PDF)                                | PDF refused (`.md` only): removing the text layer would leave the value in the image                 |
| Probably scanned PDF (fewer than 200 characters per page on average, with images)        | PDF refused (`.md` only); flagged (no OCR)                                                           |
| Encrypted PDF, PDF form (AcroForm fields), PDF with layers (optional content)            | PDF refused (`.md` only)                                                                             |
| Images (and the text they show)                                                          | kept as they are; pages containing images are flagged (no OCR)                                       |
| Annotations, bookmarks, tagged structure, `ActualText`, attachments, scripts, metadata   | removed from the produced PDF; flagged                                                               |
| Formatting, tables, images in the `.md` version                                          | lost                                                                                                 |
| Restoring a `.pdf`                                                                       | refused: drop in the `.md` (or `.txt`) returned by the external tool                                 |

Detected values are matched in the PDF by their text, case-sensitively and on word boundaries: every occurrence of a detected value is removed, including occurrences the text detection did not flag, all with the same token. Restoring a PDF returned by an external tool would mean rewriting it again, with the same layout and font problems, for a file whose layout the tool has probably changed: out of scope. The tool's text output (`.md`, `.txt`) is restored instead.
