# What is processed, format by format

"Processed": the text is analyzed and detected data is replaced with tokens. "Flagged": not modified, but a warning is shown (banner, report, mapping) or the item is listed by « Vérifier » (verify). "Ignored": neither modified nor flagged.

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
| Comment and revision author names, `word/people.xml`                                                                                           | flagged                                                                          |
| Titles copied into `docProps/app.xml`                                                                                                          | flagged                                                                          |
| All other parts (styles, theme, numbering…)                                                                                                    | copied byte for byte                                                             |

## `.pptx`

| Item                                                                                                   | Status                              |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| Shapes, nested groups (at any depth), tables                                                           | processed                           |
| Speaker notes                                                                                          | processed                           |
| Masters and layouts (paragraphs containing text)                                                       | processed                           |
| `a:fld` fields (slide number, date)                                                                    | ignored                             |
| Metadata                                                                                               | same as `.docx`                     |
| Images (`ppt/media`), SmartArt (`ppt/diagrams`), charts (`ppt/charts`), OLE objects (`ppt/embeddings`) | flagged                             |
| Slide comments and their authors                                                                       | flagged                             |
| Hyperlink targets                                                                                      | flagged if data is detected in them |
| Slide titles copied into `docProps/app.xml`                                                            | flagged                             |

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
| Cell comments and notes                                           | flagged                                                                        |
| Metadata                                                          | same as `.docx`                                                                |
| AI detection                                                      | always disabled (patterns, name list and columns only)                         |

## `.pdf` (read-only)

| Item                                                                 | Status                                                                             |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Page text                                                            | extracted as Markdown (paragraphs, `---` between pages), then processed as a `.md` |
| Formatting, images, tables                                           | lost; flagged                                                                      |
| Probably scanned PDF (fewer than 200 characters per page on average) | flagged (no OCR)                                                                   |
| Pages containing images                                              | flagged                                                                            |
| Restoring a `.pdf`                                                   | refused: drop in the `.md` or `.txt` returned by the external tool                 |
