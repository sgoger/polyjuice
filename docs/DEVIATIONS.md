# Deviations and technical decisions

This file records the deviations between the design prompt and what was actually implemented, as well as the results of the phase 0 spikes.

## Spikes

### 0.1 Token survival in the translation tool

Scripts: `spikes/token-survival/make.ts` (generates `token_survival.docx` and `token_survival.md`: 20 FR/DE/EN sentences, the tokens `⟦P-K7M2X⟧`, `⟦O-R4N8Q⟧`, `⟦E-W3X9Z⟧` at the start, middle and end of a sentence, in a table and in a footnote, 33 occurrences in total) and `spikes/token-survival/check.ts` (classifies each occurrence: intact, mangled according to a permissive regex — ASCII brackets, typographic dashes, spaces, case —, or missing; exit code 0 if 100 % intact).

```
cd spikes && npm ci
npm run token-survival:make
# run spikes/token-survival/out/token_survival.docx and .md through the translation tool
npm run token-survival:check -- <translated file>
```

Automatic checks: unmodified generated files → 33/33 intact (`.docx` and `.md`); copy altered by hand (ASCII brackets, `⟦e – w3x9z⟧`) → every occurrence classified as "mangled", exit code 1.

**Status: human step pending.** The run through the real translation tool could not be done by the agent. Since the token format is a closed decision of the prompt, development continues with `⟦X-ABCDE⟧`; if the human result is not 100 % intact, the decision on the format remains to be made (only `engine/tokens.ts` and its tests depend on it).

### 0.2 NER in the browser

Vite page `spikes/ner-browser/` (`token-classification` pipeline from transformers.js 4.3 in a Worker) and automated bench `spikes/ner-browser/bench.ts` (Playwright: fresh context = empty cache for the "cold" measurement, reload in the same context for "warm"). Corpus: 10 fictitious sentences per language (`corpus.ts`) with traps — Polish and Turkish names, first names alone, capitalized German common nouns, « Bill will bill », names alone as in a table cell — i.e. 52 expected entities; long text of 2,208 words analyzed in 200-word windows. Machine: MacBook Pro M1 Pro, 32 GB, fiber. Quantization `q8`.

| Browser      | Model                                      | Backend | Downloaded | Cold / warm load | 2,208 words | Exact FR / DE / EN    | Leaks | False positives           |
| ------------ | ------------------------------------------ | ------- | ---------- | ---------------- | ----------- | --------------------- | ----- | ------------------------- |
| Chromium 156 | bert-base-multilingual-cased-ner-hrl       | WASM    | 181.4 MB   | 4.3 s / 0.7 s    | 14.4 s      | 18/19 · 15/16 · 16/17 | 0     | « Commission », « Stadt » |
| Chromium 156 | bert-base-multilingual-cased-ner-hrl       | WebGPU  | 181.4 MB   | 4.4 s / 0.8 s    | 52.7 s      | 18/19 · 15/16 · 16/17 | 0     | « Commission »            |
| Chromium 156 | distilbert-base-multilingual-cased-ner-hrl | WASM    | 138.3 MB   | 3.9 s / 0.5 s    | 7.3 s       | 17/19 · 16/16 · 17/17 | 0     | « Commission »            |
| Chromium 156 | distilbert-base-multilingual-cased-ner-hrl | WebGPU  | 138.3 MB   | 3.7 s / 0.8 s    | 35.4 s      | 17/19 · 16/16 · 17/17 | 0     | « Commission »            |
| WebKit 27.2  | bert-base-multilingual-cased-ner-hrl       | WASM    | 181.4 MB   | 5.1 s / 1.5 s    | 21.1 s      | 18/19 · 15/16 · 16/17 | 0     | « Commission », « Stadt » |
| WebKit 27.2  | bert-base-multilingual-cased-ner-hrl       | WebGPU  | 181.4 MB   | 6.0 s / —        | 23.0 s      | —                     | —     | — (tab crashed on reload) |

"Exact" = same text and same type; no expected entity went undetected ("leaks" = 0) in any configuration. Observed discrepancies (entities replaced but with different boundaries or a different type): « mairie de Strasbourg » detected as an organization (both models), « préfecture de Marseille » likewise (distilbert); with bert, « Mühlenstraße » reduced to « Mühle » and « Małgorzata » split into « Ma » + « łgorzata Zielińska » — in both cases a **sub-token boundary**: the `simple` aggregation of transformers.js does not group at the word level. Consequence for `ner.ts`: extend each entity to word boundaries (§2.5).

Technical findings:

- The transformers.js `token-classification` pipeline **does not return offsets** (`start`/`end`) and silently truncates at 512 sub-tokens. `ner.ts` must therefore tokenize by itself, align sub-tokens with the text to recover character offsets, split into windows and aggregate (BIO) at the word level. Deviation from the prompt ("`aggregation_strategy`"): aggregation is done in `ner.ts`, not by the library.
- WebGPU is exposed by Chromium and WebKit in headless mode, but with a software adapter: 3 to 5 times slower than WASM. On a real GPU the ratio may reverse; the prompt's automatic WebGPU → WASM choice is kept, to be recalibrated in 6.1/6.2 on real workstations. WebKit/WebGPU crashed the tab on reload.
- `performance.memory` does not exist in a Worker (nor outside Chromium): peak memory not measured.
- Firefox could not be launched in the agent's environment (see 0.3); Safari is approximated by WebKit (Playwright).
- GLiNER (`onnx-community/gliner_multi-v2.1`) discarded without measurement: 349 MB in `q8` and requires a dedicated runtime library (outside the allowed dependencies).

**Recommendation**: keep `Xenova/bert-base-multilingual-cased-ner-hrl` (the prompt's choice), usable: 4–5 s cold load on a good connection, < 1.5 s warm, ~7 s per 1,000 words in WASM. `Xenova/distilbert-base-multilingual-cased-ner-hrl` is a credible alternative (−24 % download, 2× faster, equivalent quality on this small corpus); the `NER_MODEL` constant in `ner.ts` allows switching. The final decision belongs to calibration (6.2). No signal to switch to plan B.

### 0.3 Lossless OOXML rewriting

Script: `spikes/ooxml-roundtrip/run.ts`. Inputs: a `.docx`, a `.pptx` and a `.xlsx` produced by `docx`, `pptxgenjs` and `exceljs` (styles, image, table, header/footer, rich text, formula, date), plus a `.docx` and a `.pptx` produced from the Microsoft templates bundled with python-docx/python-pptx (`ooxml-roundtrip/py_inputs.py`), closer to a real Office file (`mc:Ignorable`, `w14`/`w15` namespaces…). Procedure: JSZip opens the zip, `DOMParser` (xmldom in Node, native in Chromium and WebKit via Playwright) parses the part, a single text node is replaced with `⟦P-K7M2X⟧ & <x> "q"` with `xml:space="preserve"`, the part is re-serialized and the zip repacked. The produced files are validated by `ooxml-roundtrip/validate.py` (opening with python-docx, python-pptx, openpyxl; all XML parts well-formed; zip CRC): 5/5 OK, token present.

Results and rules adopted for `ooxml/zip.ts` and `ooxml/xml.ts`:

1. **Phantom folders.** `JSZip.loadAsync` and `zip.file()` create folder entries by default (`word/`, `ppt/`…) that are absent from files produced by Office: the rewritten zip gained 1 to 2 entries and the order changed. Rule: always `createFolders: false` when loading **and** when writing a part.
2. **Compression method.** `generateAsync({ compression })` applies the global method to loaded entries: the `STORE` entries of a pptxgenjs `.pptx` were recompressed as `DEFLATE` (0/20 identical compressed bytes). Rule: read the original method of each entry from the zip's central directory (minimal reader, `spikes/ooxml-roundtrip/zipdir.ts`) and set it on `ZipObject.options.compression` before `generateAsync`. With these two rules: entry order preserved, and for all unmodified parts identical content, method **and compressed bytes** (21/21, 20/20, 9/9, 18/18, 43/43).
3. **XML declaration.** xmldom keeps it as is; Chromium and WebKit rewrite it (`"` instead of `'`) and remove the line break that follows it. Rule: strip any leading declaration from the serializer output and prepend the original declaration **with** its trailing whitespace (including a possible `\r\n`).
4. **Order of attributes and namespace declarations.** xmldom and WebKit preserve the order; Chromium reorders it (`xmlns` declarations grouped). The multiset of declarations and the number of attributes are identical in all cases, including unused declarations that `mc:Ignorable` depends on. Attribute order has no meaning in XML: accepted. Consequence: the tests (xmldom) cannot compare a _modified_ part byte for byte with the browser output; they compare textual content and structure.
5. **Entities.** `&quot;` and `&apos;` in text are re-serialized as `"` and `'` (equivalent); `&amp;`, `&lt;`, `&gt;` are preserved. Accepted.
6. **Empty elements.** WebKit serializes `<a></a>` as `<a/>` (equivalent). Accepted.
7. **CRLF.** The parser normalizes `\r\n` to `\n` inside a part (the case of pptxgenjs files). Only modified parts are affected; no effect on Office. Accepted, rule 3 preserves the `\r\n` after the declaration.
8. **`xml:space="preserve"`** set with `setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", …)`: serialized correctly by all three implementations, without a spurious namespace declaration.
9. **`mc:Ignorable`** and the root tag: preserved (up to order, rule 4).

Spike limitations: Firefox could not be launched by Playwright in the agent's environment ("Could not find profile folder", sandbox); it is covered by CI. Opening "without repair" in Word and LibreOffice could not be verified by the agent (LibreOffice not installed, Word not drivable without a UI): the `spikes/out/roundtrip-*` files must be opened by hand. Structural validation serves as the automatic check.

## Implementation deviations

### Tooling

- **TypeScript 6.0** and not the latest version (7.x): `typescript-eslint` requires `typescript < 6.1`.
- **GitHub Pages at the root of a subdomain.** Since the repository is private, Pages publishes the site on a dedicated domain (`https://literate-spoon-okyq591.pages.github.io/`) and not under `/<repo>/`. Vite's `base` is therefore not hard-coded: CI takes it from the `base_path` output of `actions/configure-pages` (variable `VITE_BASE`); locally it is `/`.

### `Segment` interface

The prompt defines `Segment { locator, text, kind }`. Two optional fields are added:

- `edits`: filled in by the engine when it modifies a segment; list of replaced ranges in coordinates of the original text. The OOXML adapters need it to project each replacement onto the runs (merge into the first touched run) without having to recompute a diff between old and new text. The same mechanism is used for restoration (tokens split across several runs by the translator).
- `wholeCell`: set by the XLSX adapter on the cells of the « Colonnes à anonymiser » (columns to anonymize), so that the engine replaces them entirely as `PERSON` (source `columns`) without detection.

Likewise, `Adapter.read` accepts an optional second argument `{ columns }` (column headers, XLSX only) and `Doc` carries `outputExtension` (`.md` for a PDF) and `notices` (information reported by « Vérifier » (check) without modification, e.g. sheet names).

### NER

- Aggregation done in `ner.ts` and not by `aggregation_strategy` (no offsets in transformers.js, see spike 0.2): alignment of WordPiece sub-tokens with the text, word label = most confident entity label among its sub-tokens (favors recall: a single entity sub-token is enough), B/I grouping per word, threshold 0.5 on the word average. Only the `PER`, `ORG`, `LOC` labels are kept (`MISC` ignored).
- Windows of 120 words with 30 words of overlap; an entity is kept only if it starts in the useful zone of its window (the edges overlap), which discards entities truncated at a window edge. A window exceeding 512 sub-tokens is split again.
- Recall measured in Node (`tests/unit/ner.slow.test.ts`, onnxruntime-node, CPU) with this aggregation on the spike corpus: **52/52** entities fully covered (FR 19/19, DE 16/16, EN 17/17), versus 49/52 exact with the `simple` aggregation of transformers.js.

### Detection

- **Partial overlaps.** The prompt says "keep the longest, then the most confident". When the discarded detection extends beyond the kept one (e.g. `+49 30 12345678 06 12 34 56 78`: a greedy international number and a French number that overlap), keeping only the longest would leave a fragment in clear text. The kept detection is then extended to the union of the two ranges (its type is preserved). A detection entirely contained in another is simply discarded.
- **Adjacent numbers.** The number regexes (IBAN, card, international phone) are greedy; when validation fails, the longest valid truncation at a group boundary is kept, then the search resumes right after. Two numbers separated by a single space thus remain two detections.
- **Bank card.** In addition to Luhn, the first digit must be 2 to 6 and the grouping must be that of a card (no separator, groups of 4, or 4-6-5 / 4-6-4), to avoid false positives on sequences of phone numbers; score 0.95 so that at equal length an IBAN or a NIR wins.
- **Tabs and line breaks.** An NER or list detection that contains a tab or a line break (`w:tab`, `w:br` elements in documents) is cut at these characters: non-text elements are never replaced.

### Reports

- The context excerpts (±40 characters) of the detection report are taken from the **anonymized text**, around the token: the downloadable report thus contains no original value and only the mapping is sensitive, in line with the reminder « Le mapping contient les données en clair » (the mapping contains the data in clear text). The original values remain viewable in the mapping.

### XML: `@xmldom/xmldom` as a runtime dependency

The prompt plans native `DOMParser` / `XMLSerializer` in the browser and xmldom for Node tests. However, **`DOMParser` and `XMLSerializer` do not exist in a Web Worker**, where the adapters and the engine run. Rather than sending XML parsing back to the main thread (the UI would no longer do orchestration only), `@xmldom/xmldom` is used everywhere, Worker and tests alike. Additional justification: spike 0.3 showed that xmldom preserves the attribute order and the declaration exactly, whereas Chromium reorders namespace declarations; the same code therefore produces the same bytes in all browsers and in the tests. Cost: ~60 KB uncompressed in the Worker bundle.

### DOCX

- **Run merging.** Only the replaced range is moved into the first touched run; the non-replaced part of the last run keeps its run and its formatting (the prompt says "merge the touched runs into the first affected run": we merge the replaced text, not the rest of the last run). Fully covered text elements are emptied, never removed.
- **Revisions.** `w:moveFrom` is ignored like `w:del` (moved text, therefore deleted from this location).
- **Content flagged without being modified** (warnings, and listed by « Vérifier » when a detection concerns them): hyperlink targets (`*.rels`, e.g. `mailto:`), field codes (`w:instrText`, e.g. `HYPERLINK "mailto:…"`), author names of comments and revisions (`w:author` attributes), `word/people.xml`. The prompt does not plan to modify them; letting them through silently would have been an unreported leak. Anonymization of these elements is noted in `docs/IDEAS.md`.
- **Charts** (`word/charts`) flagged as for PPTX.
- **XML entities.** In a rewritten part, `&apos;` and `&quot;` become `'` and `"` (equivalent, rule 5 of spike 0.3); the formatting-preservation tests compare after normalization.
- **Opening check.** CI converts the produced documents to PDF with LibreOffice (`soffice --headless`); a conversion failure fails CI. The absence of a repair prompt in Word remains to be checked by hand.

### PPTX

- All `a:p` of slides, notes, masters and layouts are read (shapes, groups at any depth, table cells); only those containing text become segments. Table cells have the `cell` type.
- `xml:space="preserve"` is not set on `a:t` (attribute absent from the DrawingML schema, where whitespace is already preserved).
- Slide comments: flagged, not processed.

### XLSX

- « Colonnes à anonymiser »: the header itself is not replaced; formula cells are ignored. The report flags any marked shared string that is used by cells of several columns (selected or not), since all these cells change.
- Cell comments and notes: flagged, not processed.

### PDF

- `pdfjs-dist` (`legacy` build) is loaded on demand in the engine Worker; it starts its own Worker, served by the application. No external resources: standard fonts, cMaps and pdf.js WASM disabled (unnecessary for text extraction).
- The lines of a single paragraph are joined by a space into a single Markdown line: an entity split at the end of a line in the PDF thus remains detectable.
- A warning always reminds the user that the PDF is converted to Markdown.

### NER in the UI (6.1)

- **ONNX runtime served locally.** By default, transformers.js downloads the onnxruntime WASM files from `cdn.jsdelivr.net`. They are now served by the application (`src/engine/detectors/ortAssets.ts`, `?url` imports of `onnxruntime-web`, a dependency of transformers.js). Only bodiless `GET` requests to `huggingface.co` / `*.hf.co` (weights and tokenizer) leave the browser: verified by the Playwright test `tests/e2e/ner.slow.spec.ts` (nightly).
- **WebGPU → WASM fallback.** WebGPU is only attempted if `navigator.gpu.requestAdapter()` returns an adapter: in headless Chromium, the API exists without an adapter and the WebGPU failure then prevented the WASM fallback.
- **Load failure (offline).** The checkbox is unchecked and the error displayed; pattern and list detection remain usable (test `tests/e2e/ner-offline.spec.ts`). The download can be cancelled (the Worker is terminated). After a processing cancellation, the model is reloaded on demand (from the browser cache).

### Calibration (6.2)

**Awaiting the human step.** `scripts/calibrate.ts` aggregates the mappings and an `annotations.csv` file (false positives / false negatives entered by hand) from a folder outside the repository (`tests/real/`) and displays volumes, FP/FN and estimated precision by source and by type. Threshold, regex or model adjustments, and any decision to switch to plan B, will be recorded here after processing 5 to 10 internal documents.

- **Organizations are no longer anonymized** (2026-10-08, first internal documents: a CSE meeting record in DOCX and a CSE newsletter in PDF). The NER replaced 87 distinct organizations in the record (CSE, ARTE, IA, YouTube, ChatGPT, « gouvernement »…), which made it hard to read and protected nobody. Simply ignoring the model's `ORG` labels leaked people, though: it sometimes labels a speaker as an organization (one name stayed in clear 25 times). The NER therefore now runs over the whole document first (`documentNer` in `ner.ts`): an organization whose text is detected as a person elsewhere in the document becomes a person, every other organization is dropped. Progress covers both passes. The `ORGANIZATION` type and its `⟦O-…⟧` tokens remain known to the engine, so mappings produced earlier still restore.

### Final review (7.4)

A confidentiality review found secondary content copied without being flagged. Fixed:

- **Thumbnail** `docProps/thumbnail.*` (image of the first page or slide): removed along with its relationship, like `custom.xml` (beyond the prompt's list, same logic as the metadata).
- **Flagged** (warning, and listed by « Vérifier » when data is detected in them): alternative texts of images and shapes (DOCX, PPTX), cached results of text formulas and sheet headers/footers (XLSX); **warned**: deleted revisions still present (DOCX), controls bound to `customXml/` (DOCX), pivot table caches and external links (XLSX), unclosed Markdown code block.
- **PDF**: extracted text is now treated as plain text (without Markdown rules); a `~~~` line or a `](` sequence coming from the PDF hid the rest of the text.
