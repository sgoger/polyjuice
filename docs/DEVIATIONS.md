# Écarts et décisions techniques

Ce fichier consigne les écarts entre le prompt de conception et ce qui a été réellement implémenté, ainsi que les résultats des spikes de la phase 0.

## Spikes

### 0.1 Survie des tokens dans l'outil de traduction

Scripts : `spikes/token-survival/make.ts` (génère `token_survival.docx` et `token_survival.md` : 20 phrases FR/DE/EN, les tokens `⟦P-K7M2X⟧`, `⟦O-R4N8Q⟧`, `⟦E-W3X9Z⟧` en début, milieu et fin de phrase, dans un tableau et dans une note de bas de page, 33 occurrences au total) et `spikes/token-survival/check.ts` (classe chaque occurrence : intacte, déformée selon une regex permissive — crochets ASCII, tirets typographiques, espaces, casse —, ou absente ; code de sortie 0 si 100 % intactes).

```
cd spikes && npm ci
npm run token-survival:make
# passer spikes/token-survival/out/token_survival.docx et .md dans l'outil de traduction
npm run token-survival:check -- <fichier traduit>
```

Vérifications automatiques : fichiers générés non modifiés → 33/33 intacts (`.docx` et `.md`) ; copie altérée à la main (crochets ASCII, `⟦e – w3x9z⟧`) → chaque occurrence classée « déformée », code 1.

**Statut : étape humaine en attente.** Le passage dans l'outil de traduction réel n'a pas pu être fait par l'agent. Le format des tokens étant une décision fermée du prompt, le développement continue avec `⟦X-ABCDE⟧` ; si le résultat humain n'est pas 100 % intact, la décision sur le format reste à prendre (seuls `engine/tokens.ts` et ses tests en dépendent).

### 0.2 NER dans le navigateur

Page Vite `spikes/ner-browser/` (pipeline `token-classification` de transformers.js 4.3 dans un Worker) et banc automatisé `spikes/ner-browser/bench.ts` (Playwright : contexte neuf = cache vide pour la mesure « à froid », rechargement dans le même contexte pour « à chaud »). Corpus : 10 phrases fictives par langue (`corpus.ts`) avec pièges — noms polonais et turcs, prénoms seuls, noms communs allemands capitalisés, « Bill will bill », noms seuls comme dans une cellule de tableau — soit 52 entités attendues ; texte long de 2 208 mots analysé par fenêtres de 200 mots. Machine : MacBook Pro M1 Pro, 32 Go, fibre. Quantification `q8`.

| Navigateur | Modèle | Backend | Téléchargé | Chargement froid / chaud | 2 208 mots | Exactes FR / DE / EN | Fuites | Faux positifs |
|---|---|---|---|---|---|---|---|---|
| Chromium 156 | bert-base-multilingual-cased-ner-hrl | WASM | 181,4 Mo | 4,3 s / 0,7 s | 14,4 s | 18/19 · 15/16 · 16/17 | 0 | « Commission », « Stadt » |
| Chromium 156 | bert-base-multilingual-cased-ner-hrl | WebGPU | 181,4 Mo | 4,4 s / 0,8 s | 52,7 s | 18/19 · 15/16 · 16/17 | 0 | « Commission » |
| Chromium 156 | distilbert-base-multilingual-cased-ner-hrl | WASM | 138,3 Mo | 3,9 s / 0,5 s | 7,3 s | 17/19 · 16/16 · 17/17 | 0 | « Commission » |
| Chromium 156 | distilbert-base-multilingual-cased-ner-hrl | WebGPU | 138,3 Mo | 3,7 s / 0,8 s | 35,4 s | 17/19 · 16/16 · 17/17 | 0 | « Commission » |
| WebKit 27.2 | bert-base-multilingual-cased-ner-hrl | WASM | 181,4 Mo | 5,1 s / 1,5 s | 21,1 s | 18/19 · 15/16 · 16/17 | 0 | « Commission », « Stadt » |
| WebKit 27.2 | bert-base-multilingual-cased-ner-hrl | WebGPU | 181,4 Mo | 6,0 s / — | 23,0 s | — | — | — (onglet planté au rechargement) |

« Exactes » = même texte et même type ; aucune entité attendue n'est restée sans détection (« fuites » = 0) dans aucune configuration. Écarts observés (entités remplacées mais avec d'autres bornes ou un autre type) : « mairie de Strasbourg » détectée comme organisation (les deux modèles), « préfecture de Marseille » idem (distilbert) ; avec bert, « Mühlenstraße » réduit à « Mühle » et « Małgorzata » coupé en « Ma » + « łgorzata Zielińska » — dans les deux cas une **frontière de sous-token** : l'agrégation `simple` de transformers.js ne regroupe pas au niveau du mot. Conséquence pour `ner.ts` : étendre chaque entité aux limites du mot (§2.5).

Constats techniques :

- Le pipeline `token-classification` de transformers.js **ne renvoie pas d'offsets** (`start`/`end`) et tronque silencieusement à 512 sous-tokens. `ner.ts` doit donc tokeniser lui-même, aligner les sous-tokens sur le texte pour retrouver les offsets caractère, découper en fenêtres et agréger (BIO) au niveau du mot. Écart avec le prompt (« `aggregation_strategy` ») : l'agrégation est faite dans `ner.ts`, pas par la bibliothèque.
- WebGPU est exposé par Chromium et WebKit en mode headless, mais avec un adaptateur logiciel : 3 à 5 fois plus lent que WASM. Sur un vrai GPU le rapport peut s'inverser ; le choix automatique WebGPU → WASM du prompt est conservé, à recalibrer en 6.1/6.2 sur des postes réels. WebKit/WebGPU a planté l'onglet au rechargement.
- `performance.memory` n'existe pas dans un Worker (ni hors Chromium) : pic mémoire non mesuré.
- Firefox n'a pas pu être lancé dans l'environnement de l'agent (voir 0.3) ; Safari est approché par WebKit (Playwright).
- GLiNER (`onnx-community/gliner_multi-v2.1`) écarté sans mesure : 349 Mo en `q8` et nécessite une bibliothèque d'exécution dédiée (hors des dépendances autorisées).

**Recommandation** : conserver `Xenova/bert-base-multilingual-cased-ner-hrl` (choix du prompt), utilisable : 4–5 s de chargement à froid sur une bonne connexion, < 1,5 s à chaud, ~7 s pour 1 000 mots en WASM. `Xenova/distilbert-base-multilingual-cased-ner-hrl` est une alternative crédible (−24 % de téléchargement, 2× plus rapide, qualité équivalente sur ce petit corpus) ; la constante `NER_MODEL` de `ner.ts` permet de basculer. La décision définitive relève de la calibration (6.2). Aucun signal de passage au plan B.

### 0.3 Réécriture OOXML sans perte

Script : `spikes/ooxml-roundtrip/run.ts`. Entrées : un `.docx`, un `.pptx` et un `.xlsx` produits par `docx`, `pptxgenjs` et `exceljs` (styles, image, tableau, en-tête/pied de page, texte riche, formule, date), plus un `.docx` et un `.pptx` produits à partir des gabarits Microsoft embarqués par python-docx/python-pptx (`ooxml-roundtrip/py_inputs.py`), plus proches d'un fichier Office réel (`mc:Ignorable`, espaces de noms `w14`/`w15`…). Procédure : JSZip ouvre le zip, `DOMParser` (xmldom en Node, natif dans Chromium et WebKit via Playwright) parse la partie, un seul nœud texte est remplacé par ` ⟦P-K7M2X⟧ & <x> "q" ` avec `xml:space="preserve"`, la partie est re-sérialisée et le zip ré-emballé. Les fichiers produits sont validés par `ooxml-roundtrip/validate.py` (ouverture par python-docx, python-pptx, openpyxl ; toutes les parties XML bien formées ; CRC du zip) : 5/5 OK, token présent.

Résultats et règles retenues pour `ooxml/zip.ts` et `ooxml/xml.ts` :

1. **Dossiers fantômes.** `JSZip.loadAsync` et `zip.file()` créent par défaut des entrées de dossier (`word/`, `ppt/`…) absentes des fichiers produits par Office : le zip réécrit gagnait 1 à 2 entrées et l'ordre changeait. Règle : toujours `createFolders: false` au chargement **et** à l'écriture d'une partie.
2. **Méthode de compression.** `generateAsync({ compression })` applique la méthode globale aux entrées chargées : les entrées `STORE` d'un `.pptx` pptxgenjs ont été recompressées en `DEFLATE` (0/20 octets compressés identiques). Règle : lire la méthode d'origine de chaque entrée dans le répertoire central du zip (lecteur minimal, `spikes/ooxml-roundtrip/zipdir.ts`) et la fixer sur `ZipObject.options.compression` avant `generateAsync`. Avec ces deux règles : ordre des entrées conservé, et pour toutes les parties non modifiées contenu, méthode **et octets compressés** identiques (21/21, 20/20, 9/9, 18/18, 43/43).
3. **Déclaration XML.** xmldom la conserve telle quelle ; Chromium et WebKit la réécrivent (`"` au lieu de `'`) et suppriment le saut de ligne qui la suit. Règle : retirer toute déclaration en tête de la sortie du sérialiseur et préfixer la déclaration d'origine **avec** ses blancs suivants (y compris un éventuel `\r\n`).
4. **Ordre des attributs et des déclarations d'espaces de noms.** xmldom et WebKit conservent l'ordre ; Chromium le réordonne (déclarations `xmlns` regroupées). Le multiensemble des déclarations et le nombre d'attributs sont identiques dans tous les cas, y compris les déclarations non utilisées dont dépend `mc:Ignorable`. L'ordre des attributs n'a pas de sens en XML : accepté. Conséquence : les tests (xmldom) ne peuvent pas comparer octet pour octet une partie *modifiée* avec la sortie du navigateur ; ils comparent le contenu textuel et la structure.
5. **Entités.** `&quot;` et `&apos;` dans le texte sont re-sérialisés en `"` et `'` (équivalent) ; `&amp;`, `&lt;`, `&gt;` sont conservés. Accepté.
6. **Éléments vides.** WebKit sérialise `<a></a>` en `<a/>` (équivalent). Accepté.
7. **CRLF.** Le parseur normalise `\r\n` en `\n` à l'intérieur d'une partie (cas des fichiers pptxgenjs). Seules les parties modifiées sont concernées ; sans effet sur Office. Accepté, la règle 3 conserve le `\r\n` après la déclaration.
8. **`xml:space="preserve"`** posé avec `setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", …)` : sérialisé correctement par les trois implémentations, sans déclaration d'espace de noms parasite.
9. **`mc:Ignorable`** et la balise racine : conservés (à l'ordre près, règle 4).

Limites du spike : Firefox n'a pas pu être lancé par Playwright dans l'environnement de l'agent (« Could not find profile folder », bac à sable) ; il est couvert par la CI. L'ouverture « sans réparation » dans Word et LibreOffice n'a pas pu être vérifiée par l'agent (LibreOffice non installé, Word non pilotable sans interface) : les fichiers `spikes/out/roundtrip-*` sont à ouvrir à la main. La validation structurelle tient lieu de contrôle automatique.
