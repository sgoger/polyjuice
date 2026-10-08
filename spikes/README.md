# Spikes (phase 0)

Code jetable de validation des hypothèses ; résultats dans [`docs/DEVIATIONS.md`](../docs/DEVIATIONS.md#spikes).

```sh
cd spikes && npm ci && npx playwright install chromium webkit
npm run token-survival:make && npm run token-survival:check -- <fichier traduit>   # 0.1
npm run ner:bench                                                                  # 0.2
uv run ooxml-roundtrip/py_inputs.py out && npm run ooxml && uv run ooxml-roundtrip/validate.py out/roundtrip-*   # 0.3
```
