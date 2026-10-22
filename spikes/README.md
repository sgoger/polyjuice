# Spikes

Throwaway code for validating the hypotheses; results in [`docs/DEVIATIONS.md`](../docs/DEVIATIONS.md#spikes).

```sh
cd spikes && npm ci && npx playwright install chromium webkit
npm run token-survival:make && npm run token-survival:check -- <translated file>   # 0.1
npm run ner:bench                                                                  # 0.2
uv run ooxml-roundtrip/py_inputs.py out && npm run ooxml && uv run ooxml-roundtrip/validate.py out/roundtrip-*   # 0.3
npm run legacy:make && SHEETJS=<unpacked xlsx package> npm run legacy:xls && npm run legacy:text                 # legacy formats (LibreOffice required)
```

Spike 0.4 (PDF output) uses the application's code and dependencies: run it from the repository root.

```sh
npx tsx spikes/pdf-output/run.ts tests/fixtures/*.pdf [--mapping tests/real/x.pdf=tests/real/x.json tests/real/x.pdf]
uv run spikes/pdf-output/mupdf_check.py spikes/out/pdf-output                                                     # 0.4
```
