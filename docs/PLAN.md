# Implementation plan — `polyjuice` (web version)

To be placed under `docs/PLAN.md`. Each sub-step is designed for an autonomous agent, with a verifiable output and acceptance criteria. Phases are sequential; ∥ = sub-steps that can run in parallel within a phase.

Models: **Haiku** (mechanical, fully specified), **Sonnet** (standard implementation), **Opus** (design, many edge cases, review). Effort: `low` / `medium` / `high` / `max`.

---

## Phase 0 — Validating assumptions

These three spikes condition decisions in the prompt. Results are recorded in `docs/DEVIATIONS.md`, section “Spikes”. No production code.

### 0.1 Spike: token survival in the translation tool — *Sonnet, medium*

- `spikes/token-survival/make.ts`: generates a `.docx` and a `.md` with 20 FR/DE/EN sentences containing `⟦P-K7M2X⟧`, `⟦O-R4N8Q⟧`, `⟦E-W3X9Z⟧` at the start, middle and end of a sentence, in a table, in a note.
- `spikes/token-survival/check.ts`: reads the translated file and classifies each expected token as intact / mangled (permissive regex) / missing.
- The human runs the files through the real translation tool.
- Acceptance: 100% intact. Otherwise, human decision on the format before phase 1.

### 0.2 Spike: NER in the browser — *Sonnet, high*

- Minimal Vite page `spikes/ner-browser/` that loads `Xenova/bert-base-multilingual-cased-ner-hrl` (quantized) via transformers.js in a Worker and displays: downloaded size, cold and warm (cached) load time, analysis time for a 2,000-word text, peak memory (`performance.memory` if available), and the entities detected on 10 sentences per language with traps (Polish and Turkish names, capitalized German common nouns, first names alone, names in a table).
- Test single-threaded WASM and WebGPU if available. Test on Chrome, Firefox, Safari.
- Compare with at least one alternative model (ONNX port of GLiNER if available on the Hub, or a smaller multilingual NER model).
- Acceptance: a comparison table and a model recommendation. The chosen name becomes the constant in `ner.ts`. If no model is usable (cold time > 2 min on a standard laptop, or unacceptable quality), escalate it: this is the first signal for switching to plan B.

### 0.3 Spike: lossless OOXML rewriting — *Sonnet, high*

- `spikes/ooxml-roundtrip/`: open a complex `.docx` (styles, images, tables, headers) with JSZip, parse `document.xml` with DOMParser, modify a single `w:t`, re-serialize, rewrite the zip. Check: the file opens in Word/LibreOffice without repair; all other parts are byte-for-byte identical; namespaces and `mc:Ignorable` are preserved; `xml:space="preserve"` is respected.
- Same thing on a `.pptx` and an `.xlsx`.
- Acceptance: procedure validated and pitfalls listed (attribute order, XML declaration, entities, CRLF) in `DEVIATIONS.md`. This spike sets the rules for `ooxml/xml.ts`.

---

## Phase 1 — Skeleton

### 1.1 Initialization — *Haiku, low*

- Vite + React + strict TypeScript + Tailwind, ESLint (typescript-eslint strict), Prettier, Vitest, Playwright, npm scripts (`lint`, `typecheck`, `test`, `test:e2e`, `build`, `check`), `.gitignore` (including `names*.txt`, `tests/real/`), MIT `LICENSE`, minimal `README.md`, empty directory tree as per §2 of the prompt.
- GitHub Actions CI: `check` + `build` on push; GitHub Pages deployment on `main`; Vite `base` configured.
- Acceptance: `npm run check` and `npm run build` green on an empty project; the empty page is deployed and reachable.

### 1.2 Fixtures — *Haiku, medium*

- `scripts/make-fixtures.ts` (fixed seed) generating `.docx` (`docx`), `.pptx` (`pptxgenjs`), `.xlsx` (`exceljs`), text `.pdf` and “scanned” `.pdf` (image page, `pdf-lib`), `.md`, `.txt`, with fictitious FR/DE/EN data: names, e-mails, French and international phone numbers, valid fictitious NIR, valid fictitious IBAN, URL, IP.
- DOCX: table, header, footer, footnote, comment, text box, image, a name split across two runs, a hyperlink containing an e-mail.
- PPTX: nested group, table, speaker notes, image.
- XLSX: columns `Nom`, `Prénom`, `Email`, `Téléphone`, `Montant` (numeric), a formula, a date, a shared string reused in two columns, a rich-text cell.
- `tests/fixtures/expected.json`: ground truth (text, type, kind) per fixture.
- Acceptance: reproducible generation; files open.

### 1.3 Worker skeleton and protocol — *Sonnet, medium*

- `worker/engine.worker.ts` + `worker/protocol.ts`: typed messages `anonymize`, `check`, `restore`, `loadNer`, `cancel`; responses `progress`, `result`, `error`, `nerProgress`. An app-side `WorkerClient` that promisifies the calls and exposes progress.
- Acceptance: Vitest test of the protocol with a fake Worker; an `anonymize` call on a `.txt` returns a properly typed `NotImplemented` error.

---

## Phase 2 — Engine

### 2.1 Tokens — *Sonnet, medium* ∥

- `engine/tokens.ts`: alphabet, HMAC-SHA256 via `crypto.subtle` (Node polyfill: `webcrypto` from `node:crypto`), 5-character encoding, collisions handled by suffix, `TOKEN_RE` (type + 5 characters + optional suffix).
- Tests: determinism, uniqueness over 100,000 inputs, no `TOKEN_RE` false positives on text with ordinary brackets and on an isolated `⟦`.

### 2.2 Mapping — *Sonnet, medium* ∥

- `engine/mapping.ts`: types, `zod` schema, creation with salt, `getOrCreateToken`, occurrences, warnings, sha256 of the source file (`crypto.subtle.digest`), stable serialization (sorted keys).
- Re-importing an existing mapping: salt and entities are kept; unknown `schema_version` → explicit error.
- Tests: round-trip, reuse, validation of malformed JSON.

### 2.3 Regex — *Sonnet, high* ∥

- `detectors/regexCommon.ts`, `detectors/regexFr.ts`: all the regexes from §3 of the prompt, with the validations (modulo 97, Luhn, NIR key). Unicode regexes (`u`), word boundaries handled explicitly (`\b` is ASCII in JS: use `(?<![\p{L}\p{N}])` / `(?![\p{L}\p{N}])`).
- Tests: positives and negatives per regex; 15 digits without a valid key ≠ NIR; invalid IBAN not detected; `+33` and `0033`; no detection inside an existing token.

### 2.4 Name list — *Haiku, medium* ∥

- `detectors/names.ts`: parsing (`#` comments, empty lines, trim), building an escaped alternation regex, sorted by decreasing length, case-insensitive, Unicode word boundaries.
- Tests: “Martin” does not match “Martinique”; accents respected; multi-word terms; 2,000 terms without noticeable slowdown.

### 2.5 transformers.js NER — *Sonnet, high*

- `detectors/ner.ts`: `NerProvider` + implementation with the model chosen in 0.2, `token-classification` pipeline with sub-token aggregation (`aggregation_strategy`), mapping `PER/ORG/LOC` → internal types, threshold 0.5, splitting long segments into overlapping windows (the model has a 512-token limit) with merging of detections at character level, download progress reported to the Worker.
- Tests: in Node with the model (test marked slow, run in nightly CI only): on 10 sentences per language, minimum recall documented (no blocking threshold, value recorded); unit test of the window splitting and offset reconstruction with a fake provider.

### 2.6 Detection orchestration — *Opus, high*

- `engine/detect.ts`: runs regex + list (+ NER if enabled) on a segment, merges, excludes existing tokens, resolves overlaps (longest, then most confident), produces sorted `Detection[]`.
- Options: `ner: boolean`, `names`, `columnsMode` (for XLSX, segments flagged by the adapter are replaced entirely).
- Tests: FR/DE/EN ground truth with a fake NER provider; an e-mail containing a name from the list produces only one `E` detection; `ner:false` returns only regex and list.

### 2.7 Replacement and restoration — *Sonnet, high*

- `engine/replace.ts`: applies detections from end to start, tokens via the mapping, returns the text and the spans (positions in the final text) for run merging.
- `engine/restore.ts`: strict replacement, inventory of found / not found / unknown.
- Tests: round-trip on 50 generated cases; occurrences counted; unknown tokens reported.

### 2.8 Reports — *Haiku, medium*

- `engine/report.ts`: three Markdown reports (§7), ±40-character excerpts, and a parallel data structure for the React display.
- Tests: snapshots.

---

## Phase 3 — First end-to-end format

### 3.1 Text/Markdown adapter — *Sonnet, medium*

- `adapters/text.ts`: one segment per line, Markdown exclusions (code blocks, link/image targets), line endings and BOM preserved.
- Tests: `.md` and `.txt` round-trip; e-mail in a link target left intact, the same one in the link text anonymized; code block intact.

### 3.2 Minimal interface — *Sonnet, high*

- `app/`: the three tabs, drop zone, name list area, NER checkbox (greyed out for `.xlsx`), progress, warnings banner, displayed report, three download buttons, footer banner. Wired to `WorkerClient`. No visual polish at this stage, but structure and keyboard accessibility in place.
- Playwright: full flow on a `.md` (anonymize without NER → download → check → restore), verifying that the restored text is identical.
- Acceptance: **usable online text MVP.** Deployed on Pages.

---

## Phase 4 — DOCX (critical format)

### 4.1 OOXML foundation — *Opus, high*

- `ooxml/zip.ts`: opening, reading a part as text, rewriting a part, repackaging while preserving entry order, compression method and the bytes of all unmodified parts. `[Content_Types].xml` and the `.rels` files are only modified for the removal of `custom.xml`.
- `ooxml/xml.ts`: parse/serialize according to the rules from spike 0.3 (XML declaration, namespaces, `xml:space`), traversal utilities by qualified name.
- `ooxml/runs.ts`: generic run-merging algorithm, parameterized by element names (`w:r/w:t/w:rPr` or `a:r/a:t/a:rPr`) and the list of non-text elements to preserve. Input: a paragraph DOM, a concatenated text, replaced spans. Output: the modified paragraph.
- Tests: round-trip of a zip without modification = identical bytes; run merging on synthetic paragraphs (span within one run, straddling two, three, run with `w:tab` in the middle, run with `w:drawing`).

### 4.2 DOCX reading — *Opus, high*

- `adapters/docx.ts::read`: all the parts and zones from §6 of the prompt, `w:tab`/`w:br` in the offsets, `w:del` ignored, `mc:AlternateContent` (both branches), `kind` per zone, `locator` = (part, index of the `w:p` in document order). Detection of images/SmartArt/OLE; reading of `core.xml`.
- Tests: on the fixture, all expected entities present in the segments, with the right `kind`; the name split across two runs appears whole; the e-mail in the hyperlink is present.

### 4.3 DOCX writing — *Opus, max*

- `adapters/docx.ts::write`: run merging via `ooxml/runs.ts`, metadata cleared, timestamps neutralized, repackaging.
- Tests: full round-trip (restored text identical zone by zone); non-text parts are byte-for-byte identical; formatting of untouched runs is preserved (XML comparison); two successive anonymizations → identical files; the document opens without repair in LibreOffice (`soffice --headless --convert-to pdf` in CI if available, otherwise structural validation).

### 4.4 DOCX → DOCX restoration — *Sonnet, high*

- Test that takes the anonymized fixture, artificially re-splits each token across two or three `w:r` with different `w:rPr` (simulating the translator), then restores.
- Acceptance: text identical to the original; correct report. **Milestone: main use case covered.** Deployed.

---

## Phase 5 — Other formats

### 5.1 PPTX — *Sonnet, high* ∥

- `adapters/pptx.ts`: slides, recursive groups, tables, notes, masters/layouts with text; `a:fld` ignored; merging via `ooxml/runs.ts`; metadata; warnings.
- Tests: round-trip; notes included; nested group included; non-text parts identical.

### 5.2 XLSX — *Sonnet, high* ∥

- `adapters/xlsx.ts`: `sharedStrings.xml` (plain and rich), `inlineStr`, columns to anonymize (reading the headers in each sheet, resolving column letter → cell references → shared string index), formulas/numbers/dates intact, VBA copied, sheet names flagged by « Vérifier » (check), metadata.
- Tests: round-trip; formula and date byte-for-byte identical; `Nom,Prénom` columns fully anonymized; the reused shared string is anonymized everywhere and the report says so.

### 5.3 PDF — *Sonnet, medium* ∥

- `adapters/pdf.ts`: pdf.js in a Worker, `getTextContent`, grouping into paragraphs, Markdown, scanned-document heuristic, images.
- Tests: text fixture → `.md` with all entities; scanned fixture → warning and near-empty `.md` without error; « Restaurer » (restore) rejects a `.pdf`.

### 5.4 Integrated warnings and reports — *Haiku, medium*

- All adapter warnings are surfaced to the banner, the report and the mapping; French texts proofread.
- Snapshot tests of the reports on each fixture.

---

## Phase 6 — Integrated NER and calibration

### 6.1 NER integration in the interface — *Sonnet, medium*

- Checkbox, download progress bar, first-use message (actual model size), WebGPU → WASM fallback, handling of download failure (offline) without blocking the regex + list mode, cancellation.
- Playwright (slow test, nightly): anonymize a `.docx` with NER enabled in Chromium.

### 6.2 Calibration on real documents — *human + Sonnet, medium*

- The human processes 5 to 10 internal documents (never committed) with and without NER; the agent provides `scripts/calibrate.ts`, which aggregates the reports and a hand-entered CSV of false positives/negatives.
- Output: adjustments to the threshold, the regexes or the model, recorded in `DEVIATIONS.md`. **This is where any switch to plan B is decided**: if browser NER is too slow or too poor for real-world use, the calibration report documents it with figures.

---

## Phase 7 — Finishing

### 7.1 Interface: polish and accessibility — *Sonnet, medium* ∥

- Empty states, errors, responsive, full keyboard navigation, contrast, `aria` labels, visible focus. No functional additions.

### 7.2 Documentation — *Haiku, medium* ∥

- Complete `README.md`, `docs/FORMATS.md` (handled / not handled per format), `docs/PRIVACY.md` (what does or does not leave the machine, including the model download from the Hub: weights only, no user data).

### 7.3 End-to-end and no-leak tests — *Sonnet, medium* ∥

- Parameterized test across all formats: anonymize → check (nothing) → restore → equality; anonymize ×2 → identity.
- No leak: no entity from `expected.json` in clear text in an anonymized document or in a report (except truncated context).
- Network test: during processing without NER, no outgoing request (Playwright `page.route` that fails on everything). With NER: only requests to the Hub for the weights, none with a body.
- Minimum coverage 85% on `src/engine` and `src/adapters`.

### 7.4 Final review — *Opus, high*

- Full review against the prompt: decisions respected, nothing out of scope, deviations documented.
- Privacy review: no persistent storage other than the model cache, no unplanned network request, mapping never sent, name list never stored.
- Output: list of fixes handled by **Sonnet, medium** agents, new pass until the list is empty. Tag `v0.1.0`.

---

## Summary

| Sub-step | Model | Effort | ∥ |
|---|---|---|---|
| 0.1 Tokens spike | Sonnet | medium | |
| 0.2 Browser NER spike | Sonnet | high | |
| 0.3 OOXML spike | Sonnet | high | |
| 1.1 Init | Haiku | low | |
| 1.2 Fixtures | Haiku | medium | |
| 1.3 Worker/protocol | Sonnet | medium | |
| 2.1 Tokens | Sonnet | medium | ∥ |
| 2.2 Mapping | Sonnet | medium | ∥ |
| 2.3 Regex | Sonnet | high | ∥ |
| 2.4 Name list | Haiku | medium | ∥ |
| 2.5 NER | Sonnet | high | |
| 2.6 Orchestration | Opus | high | |
| 2.7 Replace/restore | Sonnet | high | |
| 2.8 Reports | Haiku | medium | |
| 3.1 Text adapter | Sonnet | medium | |
| 3.2 Minimal interface | Sonnet | high | |
| 4.1 OOXML foundation | Opus | high | |
| 4.2 DOCX reading | Opus | high | |
| 4.3 DOCX writing | Opus | max | |
| 4.4 Restore DOCX | Sonnet | high | |
| 5.1 PPTX | Sonnet | high | ∥ |
| 5.2 XLSX | Sonnet | high | ∥ |
| 5.3 PDF | Sonnet | medium | ∥ |
| 5.4 Warnings | Haiku | medium | |
| 6.1 NER in the UI | Sonnet | medium | |
| 6.2 Calibration | Sonnet | medium | |
| 7.1 UI polish | Sonnet | medium | ∥ |
| 7.2 Documentation | Haiku | medium | ∥ |
| 7.3 E2E / no-leak | Sonnet | medium | ∥ |
| 7.4 Final review | Opus | high | |
