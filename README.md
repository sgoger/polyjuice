# polyjuice

A static web application that **pseudonymizes** office documents before they are sent to an external tool (LLM, machine translation, summarization), then **restores** the original data in the returned document.

**All processing happens in the browser.** No file, no text fragment and no mapping ever leaves the user's machine. There is no application server, no API and no database: the site is served as-is by GitHub Pages.

> **⚠ The JSON mapping contains the personal data in clear text. It must never be sent along with the anonymized document, nor to the external tool. Keep it locally only as long as needed to restore the document, then delete it.**

## Usage

The page has three tabs.

### Anonymiser

The « Anonymiser » (anonymize) tab:

1. Drop the document (`.docx`, `.pptx`, `.xlsx`, `.pdf`, `.md`, `.txt`).
2. Optional: paste or load a **list of names** (one term per line, `#` for comments). Each term is replaced everywhere it appears (exact match, case-insensitive, accent-sensitive, whole words). The list is never saved: it is lost when the page is reloaded.
3. Optional: check **« Activer la détection de noms par IA »** (enable AI name detection) to also detect people, organizations and places. The model (~181 MB) is downloaded once from the Hugging Face Hub and then cached by the browser. Unavailable for `.xlsx`.
4. For an `.xlsx`, the **« Colonnes à anonymiser »** (columns to anonymize) field (e.g. `Nom, Prénom`) fully replaces every text cell in the columns whose header (first non-empty row of each sheet) matches.
5. Optional: drop an **existing mapping** again to reuse the same salt and the same tokens (the mapping is extended, never truncated).
6. Run the processing. Read the **warnings banner** (images, SmartArt, macros, cleared metadata…), then download the anonymized document, the mapping and the report.

### Vérifier

The « Vérifier » (verify) tab: drop an already anonymized document (and the list of names if needed). Detection is run again and everything that still looks like personal data is listed, with its context. Nothing is produced. Existing tokens are ignored.

### Restaurer

The « Restaurer » (restore) tab: drop the document returned by the external tool **and** the mapping. Each known token is replaced by its original value, even if the tool split the token across several formatting runs. Tokens in polyjuice format that are missing from the mapping are reported as an error and left as-is. The document is processed according to its extension, whatever the original's was: an anonymized PDF comes back as `.md` or `.txt`.

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
| Organization                            | `⟦O-…⟧` | AI (NER)                                |
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

Nothing leaves the browser: files are read and produced locally, and downloads are generated on the user's machine. When AI detection is enabled, the browser downloads the model weights from the Hugging Face Hub; this request sends no user data (no document, no text, no list of names). Details: [`docs/PRIVACY.md`](docs/PRIVACY.md).

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
