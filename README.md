# polyjuice

A static web application that **pseudonymizes** office documents before they are sent to an external tool (LLM, machine translation, summarization), then **restores** the original data in the returned document.

**All processing happens in the browser.** No file, no text fragment and no mapping ever leaves the user's machine. There is no application server, no API and no database: the site is served as-is by GitHub Pages.

> **⚠ The JSON mapping contains the personal data in clear text.** To make it easy to keep everything together, the ZIP archive downloaded after anonymization contains both the anonymized document **and** the mapping. You are responsible for never sending them together: send only the anonymized document to the external tool, never the archive, never the mapping. Keep the mapping locally only as long as needed to restore the document, then delete it (and the archive).

## Usage

The page has three tabs.

### Anonymiser

The « Anonymiser » (anonymize) tab guides you through four numbered steps. The full cycle is: anonymize the document here → send the anonymized document to the external tool → restore the document it returns in the « Restaurer » tab, with the mapping.

1. **« Déposer le document »** (drop the document): `.docx`, `.pptx`, `.xlsx`, `.pdf`, `.md`, `.txt`.
2. **« Options »**:
   - **« Activer la détection de noms par IA »** (enable AI name detection) is **checked by default**. It detects people and places (organizations are not anonymized). The model (~181 MB) is downloaded from the Hugging Face Hub as soon as a document is dropped (never when the page opens), once: the browser then caches it. Unchecking the box cancels the download. If the model cannot be loaded (offline…), the box is unchecked and processing still works with pattern detection and the list of names. Not offered for `.xlsx`.
   - **List of names**, optional: one term per line, `#` for comments, or load a `.txt`. Each term is replaced everywhere it appears (exact match, case-insensitive, accent-sensitive, whole words). The list is never saved: it is lost when the page is reloaded.
   - For an `.xlsx` only, **« Colonnes à anonymiser »** (columns to anonymize, e.g. `Nom, Prénom`) fully replaces every text cell in the columns whose header (first non-empty row of each sheet) matches.
   - **« Options avancées »** (advanced options, folded by default): drop an **existing mapping** again to reuse the same salt and the same tokens (the mapping is extended, never truncated).
3. **« Anonymiser »**: click the button. If the AI model is still downloading, processing waits for it and shows its progress. Processing can be cancelled.
4. **« Résultat »** (result): a ZIP archive `<name>.polyjuice.zip` is **downloaded automatically**. It contains three files:
   - `<name>.anonymise.<ext>`, the anonymized document: **the only file to send** to the external tool (optionally after checking it in the « Vérifier » tab);
   - `<name>.json`, the mapping: **keep it, never send it**. It is required to restore the document and contains the original data in clear text;
   - `<name>.report.md`, the detection report, for information (no original value).

   Read the **warnings banner** (images, SmartArt, macros, cleared metadata…) before sending the document. Buttons under « Télécharger à nouveau » (download again) let you download the archive or each file separately, in case the browser blocked the automatic download.

### Vérifier

The « Vérifier » (verify) tab: drop an already anonymized document (and the list of names if needed). Detection is run again and everything that still looks like personal data is listed, with its context. Nothing is produced. Existing tokens are ignored.

### Restaurer

The « Restaurer » (restore) tab: drop the document returned by the external tool **and** the mapping (taken out of the archive). The restored document is downloaded automatically. Each known token is replaced by its original value, even if the tool split the token across several formatting runs. Tokens in polyjuice format that are missing from the mapping are reported as an error and left as-is. The document is processed according to its extension, whatever the original's was: an anonymized PDF comes back as `.md` or `.txt`.

## Formats

| Format  | « Anonymiser » output   | « Restaurer » input                    |
| ------- | ----------------------- | -------------------------------------- |
| `.docx` | `.docx`                 | yes                                    |
| `.pptx` | `.pptx`                 | yes                                    |
| `.xlsx` | `.xlsx`                 | yes                                    |
| `.pdf`  | `.md` (text extraction) | no (drop the returned `.md` or `.txt`) |
| `.md`   | `.md`                   | yes                                    |
| `.txt`  | `.txt`                  | yes                                    |

Office documents are modified directly in their XML: only text nodes change, everything else (formatting, images, charts…) is copied byte for byte. What is and is not processed, format by format: [`docs/FORMATS.md`](docs/FORMATS.md).

## Detected data and tokens

| Type                                    | Token   | Detection                               |
| --------------------------------------- | ------- | --------------------------------------- |
| Person                                  | `⟦P-…⟧` | AI (NER), list of names, columns (xlsx) |
| Place                                   | `⟦L-…⟧` | AI (NER)                                |
| Email                                   | `⟦E-…⟧` | pattern                                 |
| Phone number (French and international) | `⟦T-…⟧` | pattern                                 |
| IBAN (check digits verified)            | `⟦I-…⟧` | pattern                                 |
| Bank card (Luhn)                        | `⟦C-…⟧` | pattern                                 |
| URL                                     | `⟦U-…⟧` | pattern                                 |
| IP address (v4, v6)                     | `⟦A-…⟧` | pattern                                 |
| NIR (check key verified)                | `⟦N-…⟧` | pattern                                 |

A token has the form `⟦X-ABCDE⟧`: `X` is the type letter, `ABCDE` is five characters derived by HMAC-SHA256 from a random salt specific to the mapping. The same value gets the same token throughout the document; reusing a mapping yields exactly the same document; two documents anonymized separately have different tokens. Dates are not anonymized.

## Out of scope

Not handled in this version (a warning is shown when relevant): text inside images (no OCR), scanned PDFs, SmartArt, OLE objects, charts; grouping variants of the same name; mapping shared between documents; restoring tokens altered by the external tool; realistic pseudonyms; any persistent storage; any server; national identifiers other than the French NIR. Also not modified, but reported: hyperlink targets, Word field codes, comment and revision author names, spreadsheet sheet names.

## Compliance

polyjuice **pseudonymizes**: it replaces identifying data with tokens, which are reversible thanks to the mapping. Under the GDPR and according to the CNIL, pseudonymization is not anonymization: the documents produced remain **personal data**, subject to the same rules as the originals, and the mapping allows re-identification. Automatic detection is not exhaustive: review the anonymized document (« Vérifier » tab) before sending it anywhere.

Nothing leaves the browser: files are read and produced locally, and downloads are generated on the user's machine. When AI detection is enabled (the default) and a document other than `.xlsx` is dropped, the browser downloads the model weights from the Hugging Face Hub; this request sends no user data (no document, no text, no list of names). Details: [`docs/PRIVACY.md`](docs/PRIVACY.md).

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

No list of names, no real document and no mapping may be added to the repository (`tests/real/` and `names*.txt` are ignored by git).

## License

MIT
