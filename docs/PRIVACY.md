# Privacy: what goes over the network, what does not

polyjuice is a static site. Once the page is loaded, all processing happens in the browser, in a Web Worker.

## What never leaves the machine

- the uploaded documents and the produced documents;
- the extracted text, the detections, the reports;
- the name list;
- the mapping (which contains the data in clear text).

Files are read with the browser's `File` API and downloads are produced locally (`Blob` + download link). No request is sent during processing without AI detection: this is checked by an automated test that blocks every outgoing request and processes each format (`tests/e2e/network.spec.ts`).

## What is stored

Nothing, with one exception. The application uses no cookies, no `localStorage`, no `sessionStorage` and no IndexedDB (checked by `tests/e2e/network.spec.ts`). The name list and the uploaded files are lost when the page is reloaded.

The exception: when AI detection is enabled, **the model weights** are cached by transformers.js (browser Cache API), so they are not downloaded again on every visit. This cache only contains public model files, never user data. It can be cleared from the browser settings (site data).

The application also registers a **service worker** (`coi-sw.js`) when the server does not send the cross-origin isolation headers, which is the case on GitHub Pages. Its only role is to add these headers (`Cross-Origin-Opener-Policy`, `Cross-Origin-Embedder-Policy`) to the application's own responses, so that the AI model can compute on several processor cores. It stores nothing, caches nothing and does not touch requests to other sites. It can be removed from the browser settings (site data) like the model cache.

## What goes over the network

| When                             | To                                       | What                                                                                                                                                        | User data |
| -------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Opening the page                 | GitHub Pages                             | The application's HTML, JavaScript, CSS, WASM files (ONNX runtime, pdf.js)                                                                                  | none      |
| First activation of AI detection | `huggingface.co` and its CDN (`*.hf.co`) | bodyless `GET` requests for the tokenizer, the configuration and the quantized weights of the `Xenova/bert-base-multilingual-cased-ner-hrl` model (~181 MB) | none      |
| Subsequent activations           | `huggingface.co`                         | cache validation requests (`GET`)                                                                                                                           | none      |

The ONNX runtime (WASM) is served by the application itself, not by a third-party CDN. The nightly test `tests/e2e/ner.slow.spec.ts` checks that, during an anonymization with AI detection, only bodyless `GET` requests to the Hugging Face Hub hosts leave the browser.

Like any HTTP request, downloading the model reveals to Hugging Face the machine's IP address and the fact that the model is being used; it reveals nothing about the processed documents.

## What the tool produces

- The **anonymized document** is still personal data within the meaning of the GDPR (pseudonymization, not anonymization): detection is not exhaustive and context can be enough to re-identify.
- The **mapping** contains the original values in clear text: it must never be transmitted.
- The **report** contains no original value: its context excerpts are taken from the anonymized text.
