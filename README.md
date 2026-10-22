# polyjuice

A static web application that **pseudonymizes** office documents before they are sent to an external tool (LLM, machine translation, summarization), then **restores** the original data in the returned document.

**All processing happens in the browser.** No file, no text fragment and no mapping ever leaves the user's machine. There is no application server, no API and no database: the site is served as-is by GitHub Pages.

> **⚠ The JSON mapping contains the personal data in clear text.** To make it easy to keep everything together, the ZIP archive downloaded after anonymization contains both the anonymized document **and** the mapping. You are responsible for never sending them together: send only the anonymized document to the external tool, never the archive, never the mapping. Keep the mapping locally only as long as needed to restore the document, then delete it (and the archive).

## Usage

The page has two main tabs, « Anonymiser » and « Restaurer », and an optional one, « Vérifier (facultatif) », set apart on the right. Each tab is a short sequence of numbered steps; once processing starts, the steps fold into a one-line summary (file, settings) with « Modifier les réglages » (change settings, same file) and « ↺ Recommencer » (start over) buttons.

### Anonymiser

The « Anonymiser » (anonymize) tab guides you through three numbered steps, then shows the result. The full cycle is: anonymize the document here → send the anonymized document to the external tool → restore the document it returns in the « Restaurer » tab, with the mapping.

1. **« Déposer le document »** (drop the document): `.docx`, `.pptx`, `.xlsx`, `.pdf`, `.md`, `.txt`. For an Office document, a **warning banner appears right away** if it contains comments, tracked changes (revisions) or notes: their author names stay in clear text in the anonymized document (and, in PowerPoint and Excel, the comment text too). The banner gives the steps to remove them in Word, PowerPoint or Excel (e.g. in Word: « Révision » → « Accepter toutes les modifications », then « Supprimer tous les commentaires du document »); save, then drop the file again. Anonymizing stays possible without doing so. The same banner appears in « Vérifier ».
2. **« Options »**:
   - **« Activer la détection de noms par IA »** (enable AI name detection) is **checked by default**. It detects people and places (organizations are not anonymized). The model (~181 MB) is downloaded from the Hugging Face Hub as soon as a document is dropped (never when the page opens), once: the browser then caches it. Unchecking the box cancels the download. If the model cannot be loaded (offline…), the box is unchecked and processing still works with pattern detection and the names glossary. Not offered for `.xlsx`.
   - **« Glossaire de noms »** (names glossary), optional: one name per line, written as it appears in the documents (e.g. `Thomas Rivière`), `#` for comments. Listed names are always replaced as persons, even when AI detection misses them (« Rivière » is also a common noun). Matching is exact, case-insensitive, accent-sensitive, on whole words. « Charger un .txt » (load a .txt) replaces the content with a file, « Enregistrer en .txt » (save as .txt) downloads it, « Effacer » (clear) empties it. By default the glossary is never saved and is lost when the page is reloaded; checking **« Mémoriser ce glossaire dans ce navigateur »** (remember this glossary in this browser) keeps it in the browser's `localStorage` until the box is unchecked (see [`docs/PRIVACY.md`](docs/PRIVACY.md); not on a shared workstation).
   - For an `.xlsx` only, **« Colonnes à anonymiser »** (columns to anonymize, e.g. `Nom, Prénom`) fully replaces every text cell in the columns whose header (first non-empty row of each sheet) matches.
   - **« Options avancées »** (advanced options, folded by default): drop an **existing mapping** again to reuse the same salt and the same tokens (the mapping is extended, never truncated).
3. **« Anonymiser »**: click the button. If the AI model is still downloading, processing waits for it and shows its progress. Processing can be cancelled.
4. **Result** (the steps are folded into a summary): a ZIP archive `<name>.polyjuice.zip` is **downloaded automatically**. The screen then shows, in short:
   - the **warnings banner** (images, SmartArt, macros, cleared metadata…), to read before sending the document;
   - the two files of the archive and what to do with each: `<name>.anonymise.<ext>` (**send**: the only file to give to the external tool) and `<name>.json`, the mapping (**keep, never send**: it contains the original data in clear text and is required to restore);
   - a folded « Télécharger à nouveau, rapport de détection » (download again, detection report) section, with a button per file in case the browser blocked the automatic download, the detection report (`<name>.report.md`, only available there) and its detailed view.

A PDF is rewritten: the detected data is removed from the file and replaced with tokens, the layout is kept, and a text version (`.md`) is produced too (both are in the archive). When the PDF cannot be rewritten safely (unusual font, scanned or encrypted PDF, form…), only the `.md` is produced and a warning says why. A note explains this as soon as a `.pdf` is dropped. Why a PDF is harder to edit than a Word document: [`docs/FORMATS.md`](docs/FORMATS.md#pdf).

### Restaurer

The « Restaurer » (restore) tab: drop the document returned by the external tool **and** the mapping (the `.json` file of the archive), then click « Restaurer ». The restored document is downloaded automatically; the restoration report is in a folded section. Each known token is replaced by its original value, even if the tool split the token across several formatting runs. Tokens in polyjuice format that are missing from the mapping are reported as an error and left as-is. The document is processed according to its extension, whatever the original's was: for a PDF, drop the `.md` or `.txt` returned by the external tool (restoring a `.pdf` is not supported).

### Vérifier (optional)

The « Vérifier (facultatif) » (verify, optional) tab: drop an already anonymized document (the names glossary is shared with « Anonymiser »). Detection is run again and everything that still looks like personal data is listed, with its context. Nothing is produced. Existing tokens are ignored. Right after an anonymization it adds little (the same detections run again); it is useful when the anonymized document was edited before being sent, or to check with a longer names glossary. Nothing is loaded until a document is dropped.

## Formats

| Format  | « Anonymiser » output                                                   | « Restaurer » input                    |
| ------- | ----------------------------------------------------------------------- | -------------------------------------- |
| `.docx` | `.docx`                                                                 | yes                                    |
| `.pptx` | `.pptx`                                                                 | yes                                    |
| `.xlsx` | `.xlsx`                                                                 | yes                                    |
| `.pdf`  | `.pdf` and `.md`, or `.md` only when the PDF cannot be rewritten safely | no (drop the returned `.md` or `.txt`) |
| `.md`   | `.md`                                                                   | yes                                    |
| `.txt`  | `.txt`                                                                  | yes                                    |

Office documents are modified directly in their XML: only text nodes change, everything else (formatting, images, charts…) is copied byte for byte. In a PDF, the glyphs of the detected data are removed from the page content and the token is drawn in their place; the produced PDF is read back and refused if any detected value can still be extracted from it. What is and is not processed, format by format: [`docs/FORMATS.md`](docs/FORMATS.md).

## Detected data and tokens

| Type                                    | Token   | Detection                                |
| --------------------------------------- | ------- | ---------------------------------------- |
| Person                                  | `⟦P-…⟧` | AI (NER), names glossary, columns (xlsx) |
| Place                                   | `⟦L-…⟧` | AI (NER)                                 |
| Email                                   | `⟦E-…⟧` | pattern                                  |
| Phone number (French and international) | `⟦T-…⟧` | pattern                                  |
| IBAN (check digits verified)            | `⟦I-…⟧` | pattern                                  |
| Bank card (Luhn)                        | `⟦C-…⟧` | pattern                                  |
| URL                                     | `⟦U-…⟧` | pattern                                  |
| IP address (v4, v6)                     | `⟦A-…⟧` | pattern                                  |
| NIR (check key verified)                | `⟦N-…⟧` | pattern                                  |

A token has the form `⟦X-ABCDE⟧`: `X` is the type letter, `ABCDE` is five characters derived by HMAC-SHA256 from a random salt specific to the mapping. The same value gets the same token throughout the document; reusing a mapping yields exactly the same document; two documents anonymized separately have different tokens. Dates are not anonymized.

## Out of scope

Not handled in this version (a warning is shown when relevant): text inside images (no OCR), scanned PDFs, rewriting PDFs whose detected data uses Type3 or other unsupported fonts (`.md` only), encrypted PDFs, PDF forms, restoring a `.pdf`, SmartArt, OLE objects, charts; grouping variants of the same name; mapping shared between documents; restoring tokens altered by the external tool; realistic pseudonyms; any persistent storage other than the opt-in names glossary; any server; national identifiers other than the French NIR. Also not modified, but reported: hyperlink targets, Word field codes, comment and revision author names, spreadsheet sheet names.

## Compliance

polyjuice **pseudonymizes**: it replaces identifying data with tokens, which are reversible thanks to the mapping. Under the GDPR and according to the CNIL, pseudonymization is not anonymization: the documents produced remain **personal data**, subject to the same rules as the originals, and the mapping allows re-identification. Automatic detection is not exhaustive: review the anonymized document (« Vérifier » tab) before sending it anywhere.

Nothing leaves the browser: files are read and produced locally, and downloads are generated on the user's machine. When AI detection is enabled (the default) and a document other than `.xlsx` is dropped, the browser downloads the model weights from the Hugging Face Hub; this request sends no user data (no document, no text, no names glossary). Details: [`docs/PRIVACY.md`](docs/PRIVACY.md).

## Development

Prerequisite: Node.js 22 or later.

```sh
npm ci
npm run dev              # development server
npm run check            # lint + typecheck + unit tests (with coverage)
npm run test:e2e         # Playwright tests (Chromium)
npm run test:e2e:slow    # Playwright test with NER model download
npm run build            # static site in dist/
npm run fixtures         # regenerates the test fixtures (fictitious data)
```

Architecture: a detection and replacement engine (`src/engine/`) that knows nothing about formats, per-format adapters (`src/adapters/`) that extract and rewrite text segments, all running in a Web Worker (`src/worker/`); the React UI (`src/app/`) only orchestrates and displays. Implementation plan: [`docs/PLAN.md`](docs/PLAN.md); deviations and technical decisions: [`docs/DEVIATIONS.md`](docs/DEVIATIONS.md); out-of-scope ideas: [`docs/IDEAS.md`](docs/IDEAS.md).

No names glossary, no real document and no mapping may be added to the repository (`tests/real/`, `names*.txt` and `glossaire*.txt` are ignored by git).

## License

MIT
