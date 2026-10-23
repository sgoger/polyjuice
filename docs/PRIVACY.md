# Privacy: what goes over the network, what does not

polyjuice is a static site. Once the page is loaded, all processing happens in the browser, in a Web Worker.

## What never leaves the machine

- the uploaded documents and the produced documents;
- the extracted text, the detections, the reports;
- the names glossary;
- the mapping (which contains the data in clear text).

Files are read with the browser's `File` API and downloads are produced locally (`Blob` + download link). The ZIP archive downloaded after anonymization (anonymized document and mapping) is built in the Web Worker with JSZip, already used for Office files: building it sends nothing over the network. No request is sent during processing without AI detection: this is checked by an automated test that blocks every outgoing request and processes each format (`tests/e2e/network.spec.ts`). AI detection is enabled by default, but the model is only requested once a document other than `.xlsx` is dropped: opening the page, or dropping a workbook, sends no request (`tests/e2e/ner-loading.spec.ts`).

## What is stored

By default, nothing. The application uses no cookies, no `sessionStorage` and no IndexedDB, and writes nothing to `localStorage` unless the user asks for it (checked by `tests/e2e/network.spec.ts`). The names glossary and the uploaded files are lost when the page is reloaded.

Two exceptions.

**The names glossary, only if the user checks « Mémoriser ce glossaire dans ce navigateur »** (remember this glossary in this browser; unchecked by default):

- _What_: the content of the « Glossaire de noms » (names glossary) field, as plain text, under a single key (`polyjuice.glossary`). These are names of people, that is **personal data**. Documents, mappings and reports are never stored.
- _Where_: the site's `localStorage`, on this computer, in this browser profile. It is not encrypted and is readable by anyone with access to the browser profile (another user of a shared workstation, an extension with access to the site, backups of the profile). It is never sent over the network. The checkbox warns against using it on a shared workstation.
- _When_: on every change of the field while the box is checked. On the next visit, the glossary is restored and the box shown checked.
- _How to erase it_: uncheck the box (the stored copy is deleted immediately; the field keeps its content until the page is reloaded), click « Effacer » (clear: empties the field and the stored copy), or clear the site data from the browser settings.
- If the browser blocks `localStorage` (some private browsing modes), the box is disabled and the glossary behaves as before: lost on reload. « Enregistrer en .txt » (save as .txt) downloads it as a local file instead.

Checked by `tests/e2e/glossary.spec.ts`.

**The AI model**: when AI detection is enabled, **the model weights** are cached by transformers.js (browser Cache API), so they are not downloaded again on every visit. This cache only contains public model files, never user data. It can be cleared from the browser settings (site data).

The application also registers a **service worker** (`coi-sw.js`) when the server does not send the cross-origin isolation headers, which is the case on GitHub Pages. Its only role is to add these headers (`Cross-Origin-Opener-Policy`, `Cross-Origin-Embedder-Policy`) to the application's own responses, so that the AI model can compute on several processor cores. It stores nothing, caches nothing and does not touch requests to other sites. It can be removed from the browser settings (site data) like the model cache.

## What goes over the network

| When                                                                              | To                                       | What                                                                                                                                                        | User data |
| --------------------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Opening the page                                                                  | GitHub Pages                             | The application's HTML, JavaScript, CSS, WASM files (ONNX runtime, pdf.js)                                                                                  | none      |
| First document dropped with AI detection enabled (the default; never for `.xlsx`) | `huggingface.co` and its CDN (`*.hf.co`) | bodyless `GET` requests for the tokenizer, the configuration and the quantized weights of the `Xenova/bert-base-multilingual-cased-ner-hrl` model (~181 MB) | none      |
| Subsequent uses                                                                   | `huggingface.co`                         | cache validation requests (`GET`)                                                                                                                           | none      |

The ONNX runtime (WASM) is served by the application itself, not by a third-party CDN. The nightly test `tests/e2e/ner.slow.spec.ts` checks that, during an anonymization with AI detection, only bodyless `GET` requests to the Hugging Face Hub hosts leave the browser.

Like any HTTP request, downloading the model reveals to Hugging Face the machine's IP address and the fact that the model is being used; it reveals nothing about the processed documents.

## What the tool produces

- The **anonymized document** is still personal data within the meaning of the GDPR (pseudonymization, not anonymization): detection is not exhaustive and context can be enough to re-identify.
- The **mapping** contains the original values in clear text: it must never be transmitted. It is included in the downloaded archive alongside the anonymized document, for convenience: the user is responsible for sending only the anonymized document, never the archive or the mapping.
- The **report** contains no original value: its context excerpts are taken from the anonymized text.
