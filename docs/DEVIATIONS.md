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

| Navigateur   | Modèle                                     | Backend | Téléchargé | Chargement froid / chaud | 2 208 mots | Exactes FR / DE / EN  | Fuites | Faux positifs                     |
| ------------ | ------------------------------------------ | ------- | ---------- | ------------------------ | ---------- | --------------------- | ------ | --------------------------------- |
| Chromium 156 | bert-base-multilingual-cased-ner-hrl       | WASM    | 181,4 Mo   | 4,3 s / 0,7 s            | 14,4 s     | 18/19 · 15/16 · 16/17 | 0      | « Commission », « Stadt »         |
| Chromium 156 | bert-base-multilingual-cased-ner-hrl       | WebGPU  | 181,4 Mo   | 4,4 s / 0,8 s            | 52,7 s     | 18/19 · 15/16 · 16/17 | 0      | « Commission »                    |
| Chromium 156 | distilbert-base-multilingual-cased-ner-hrl | WASM    | 138,3 Mo   | 3,9 s / 0,5 s            | 7,3 s      | 17/19 · 16/16 · 17/17 | 0      | « Commission »                    |
| Chromium 156 | distilbert-base-multilingual-cased-ner-hrl | WebGPU  | 138,3 Mo   | 3,7 s / 0,8 s            | 35,4 s     | 17/19 · 16/16 · 17/17 | 0      | « Commission »                    |
| WebKit 27.2  | bert-base-multilingual-cased-ner-hrl       | WASM    | 181,4 Mo   | 5,1 s / 1,5 s            | 21,1 s     | 18/19 · 15/16 · 16/17 | 0      | « Commission », « Stadt »         |
| WebKit 27.2  | bert-base-multilingual-cased-ner-hrl       | WebGPU  | 181,4 Mo   | 6,0 s / —                | 23,0 s     | —                     | —      | — (onglet planté au rechargement) |

« Exactes » = même texte et même type ; aucune entité attendue n'est restée sans détection (« fuites » = 0) dans aucune configuration. Écarts observés (entités remplacées mais avec d'autres bornes ou un autre type) : « mairie de Strasbourg » détectée comme organisation (les deux modèles), « préfecture de Marseille » idem (distilbert) ; avec bert, « Mühlenstraße » réduit à « Mühle » et « Małgorzata » coupé en « Ma » + « łgorzata Zielińska » — dans les deux cas une **frontière de sous-token** : l'agrégation `simple` de transformers.js ne regroupe pas au niveau du mot. Conséquence pour `ner.ts` : étendre chaque entité aux limites du mot (§2.5).

Constats techniques :

- Le pipeline `token-classification` de transformers.js **ne renvoie pas d'offsets** (`start`/`end`) et tronque silencieusement à 512 sous-tokens. `ner.ts` doit donc tokeniser lui-même, aligner les sous-tokens sur le texte pour retrouver les offsets caractère, découper en fenêtres et agréger (BIO) au niveau du mot. Écart avec le prompt (« `aggregation_strategy` ») : l'agrégation est faite dans `ner.ts`, pas par la bibliothèque.
- WebGPU est exposé par Chromium et WebKit en mode headless, mais avec un adaptateur logiciel : 3 à 5 fois plus lent que WASM. Sur un vrai GPU le rapport peut s'inverser ; le choix automatique WebGPU → WASM du prompt est conservé, à recalibrer en 6.1/6.2 sur des postes réels. WebKit/WebGPU a planté l'onglet au rechargement.
- `performance.memory` n'existe pas dans un Worker (ni hors Chromium) : pic mémoire non mesuré.
- Firefox n'a pas pu être lancé dans l'environnement de l'agent (voir 0.3) ; Safari est approché par WebKit (Playwright).
- GLiNER (`onnx-community/gliner_multi-v2.1`) écarté sans mesure : 349 Mo en `q8` et nécessite une bibliothèque d'exécution dédiée (hors des dépendances autorisées).

**Recommandation** : conserver `Xenova/bert-base-multilingual-cased-ner-hrl` (choix du prompt), utilisable : 4–5 s de chargement à froid sur une bonne connexion, < 1,5 s à chaud, ~7 s pour 1 000 mots en WASM. `Xenova/distilbert-base-multilingual-cased-ner-hrl` est une alternative crédible (−24 % de téléchargement, 2× plus rapide, qualité équivalente sur ce petit corpus) ; la constante `NER_MODEL` de `ner.ts` permet de basculer. La décision définitive relève de la calibration (6.2). Aucun signal de passage au plan B.

### 0.3 Réécriture OOXML sans perte

Script : `spikes/ooxml-roundtrip/run.ts`. Entrées : un `.docx`, un `.pptx` et un `.xlsx` produits par `docx`, `pptxgenjs` et `exceljs` (styles, image, tableau, en-tête/pied de page, texte riche, formule, date), plus un `.docx` et un `.pptx` produits à partir des gabarits Microsoft embarqués par python-docx/python-pptx (`ooxml-roundtrip/py_inputs.py`), plus proches d'un fichier Office réel (`mc:Ignorable`, espaces de noms `w14`/`w15`…). Procédure : JSZip ouvre le zip, `DOMParser` (xmldom en Node, natif dans Chromium et WebKit via Playwright) parse la partie, un seul nœud texte est remplacé par `⟦P-K7M2X⟧ & <x> "q"` avec `xml:space="preserve"`, la partie est re-sérialisée et le zip ré-emballé. Les fichiers produits sont validés par `ooxml-roundtrip/validate.py` (ouverture par python-docx, python-pptx, openpyxl ; toutes les parties XML bien formées ; CRC du zip) : 5/5 OK, token présent.

Résultats et règles retenues pour `ooxml/zip.ts` et `ooxml/xml.ts` :

1. **Dossiers fantômes.** `JSZip.loadAsync` et `zip.file()` créent par défaut des entrées de dossier (`word/`, `ppt/`…) absentes des fichiers produits par Office : le zip réécrit gagnait 1 à 2 entrées et l'ordre changeait. Règle : toujours `createFolders: false` au chargement **et** à l'écriture d'une partie.
2. **Méthode de compression.** `generateAsync({ compression })` applique la méthode globale aux entrées chargées : les entrées `STORE` d'un `.pptx` pptxgenjs ont été recompressées en `DEFLATE` (0/20 octets compressés identiques). Règle : lire la méthode d'origine de chaque entrée dans le répertoire central du zip (lecteur minimal, `spikes/ooxml-roundtrip/zipdir.ts`) et la fixer sur `ZipObject.options.compression` avant `generateAsync`. Avec ces deux règles : ordre des entrées conservé, et pour toutes les parties non modifiées contenu, méthode **et octets compressés** identiques (21/21, 20/20, 9/9, 18/18, 43/43).
3. **Déclaration XML.** xmldom la conserve telle quelle ; Chromium et WebKit la réécrivent (`"` au lieu de `'`) et suppriment le saut de ligne qui la suit. Règle : retirer toute déclaration en tête de la sortie du sérialiseur et préfixer la déclaration d'origine **avec** ses blancs suivants (y compris un éventuel `\r\n`).
4. **Ordre des attributs et des déclarations d'espaces de noms.** xmldom et WebKit conservent l'ordre ; Chromium le réordonne (déclarations `xmlns` regroupées). Le multiensemble des déclarations et le nombre d'attributs sont identiques dans tous les cas, y compris les déclarations non utilisées dont dépend `mc:Ignorable`. L'ordre des attributs n'a pas de sens en XML : accepté. Conséquence : les tests (xmldom) ne peuvent pas comparer octet pour octet une partie _modifiée_ avec la sortie du navigateur ; ils comparent le contenu textuel et la structure.
5. **Entités.** `&quot;` et `&apos;` dans le texte sont re-sérialisés en `"` et `'` (équivalent) ; `&amp;`, `&lt;`, `&gt;` sont conservés. Accepté.
6. **Éléments vides.** WebKit sérialise `<a></a>` en `<a/>` (équivalent). Accepté.
7. **CRLF.** Le parseur normalise `\r\n` en `\n` à l'intérieur d'une partie (cas des fichiers pptxgenjs). Seules les parties modifiées sont concernées ; sans effet sur Office. Accepté, la règle 3 conserve le `\r\n` après la déclaration.
8. **`xml:space="preserve"`** posé avec `setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", …)` : sérialisé correctement par les trois implémentations, sans déclaration d'espace de noms parasite.
9. **`mc:Ignorable`** et la balise racine : conservés (à l'ordre près, règle 4).

Limites du spike : Firefox n'a pas pu être lancé par Playwright dans l'environnement de l'agent (« Could not find profile folder », bac à sable) ; il est couvert par la CI. L'ouverture « sans réparation » dans Word et LibreOffice n'a pas pu être vérifiée par l'agent (LibreOffice non installé, Word non pilotable sans interface) : les fichiers `spikes/out/roundtrip-*` sont à ouvrir à la main. La validation structurelle tient lieu de contrôle automatique.

## Écarts d'implémentation

### Outillage

- **TypeScript 6.0** et non la dernière version (7.x) : `typescript-eslint` exige `typescript < 6.1`.
- **GitHub Pages à la racine d'un sous-domaine.** Le dépôt étant privé, Pages publie le site sur un domaine dédié (`https://literate-spoon-okyq591.pages.github.io/`) et non sous `/<dépôt>/`. Le `base` de Vite n'est donc pas codé en dur : la CI le prend dans la sortie `base_path` de `actions/configure-pages` (variable `VITE_BASE`) ; en local il vaut `/`.

### Interface `Segment`

Le prompt définit `Segment { locator, text, kind }`. Deux champs optionnels sont ajoutés :

- `edits` : renseigné par le moteur quand il modifie un segment ; liste des plages remplacées en coordonnées du texte d'origine. Les adaptateurs OOXML en ont besoin pour projeter chaque remplacement sur les runs (fusion dans le premier run touché) sans avoir à recalculer un diff entre ancien et nouveau texte. Le même mécanisme sert à la restauration (tokens coupés sur plusieurs runs par le traducteur).
- `wholeCell` : posé par l'adaptateur XLSX sur les cellules des « Colonnes à anonymiser », pour que le moteur les remplace intégralement en `PERSON` (source `columns`) sans détection.

De même, `Adapter.read` accepte un second argument optionnel `{ columns }` (en-têtes de colonnes, XLSX uniquement) et `Doc` porte `outputExtension` (`.md` pour un PDF) et `notices` (informations remontées par « Vérifier » sans modification, ex. noms de feuilles).

### NER

- Agrégation faite dans `ner.ts` et non par `aggregation_strategy` (absent des offsets dans transformers.js, voir spike 0.2) : alignement des sous-tokens WordPiece sur le texte, étiquette du mot = étiquette d'entité la plus confiante parmi ses sous-tokens (privilégie le rappel : un seul sous-token entité suffit), regroupement B/I par mot, seuil 0,5 sur la moyenne des mots. Seules les étiquettes `PER`, `ORG`, `LOC` sont retenues (`MISC` ignoré).
- Fenêtres de 120 mots avec 30 mots de recouvrement ; une entité n'est retenue que si elle commence dans la zone utile de sa fenêtre (les bords se recouvrent), ce qui écarte les entités tronquées en bord de fenêtre. Une fenêtre dépassant 512 sous-tokens est redécoupée.
- Rappel mesuré en Node (`tests/unit/ner.slow.test.ts`, onnxruntime-node, CPU) avec cette agrégation sur le corpus du spike : **52/52** entités entièrement couvertes (FR 19/19, DE 16/16, EN 17/17), contre 49/52 exactes avec l'agrégation `simple` de transformers.js.

### Détection

- **Chevauchements partiels.** Le prompt dit « garder la plus longue, puis la plus confiante ». Quand la détection écartée déborde de celle retenue (ex. `+49 30 12345678 06 12 34 56 78` : un numéro international gourmand et un numéro français qui se recouvrent), garder seulement la plus longue laisserait un fragment en clair. La détection retenue est alors étendue à l'union des deux plages (son type est conservé). Une détection entièrement contenue dans une autre est simplement écartée.
- **Numéros collés.** Les regex de numéros (IBAN, carte, téléphone international) sont gourmandes ; quand la validation échoue, la plus longue troncature valide à une frontière de groupe est retenue, puis la recherche reprend juste après. Deux numéros séparés par un simple espace restent ainsi deux détections.
- **Carte bancaire.** En plus de Luhn, le premier chiffre doit être 2 à 6 et le groupement celui d'une carte (sans séparateur, groupes de 4, ou 4-6-5 / 4-6-4), pour éviter les faux positifs sur des suites de numéros de téléphone ; score 0,95 pour qu'à longueur égale un IBAN ou un NIR l'emporte.
- **Tabulations et sauts de ligne.** Une détection NER ou de liste qui contient une tabulation ou un saut de ligne (éléments `w:tab`, `w:br` des documents) est coupée à ces caractères : les éléments non textuels ne sont jamais remplacés.

### Rapports

- Les extraits de contexte (±40 caractères) du rapport de détection sont pris dans le **texte anonymisé**, autour du token : le rapport téléchargeable ne contient ainsi aucune valeur d'origine et seul le mapping est sensible, conformément au rappel « Le mapping contient les données en clair ». Les valeurs d'origine restent consultables dans le mapping.

### XML : `@xmldom/xmldom` en dépendance d'exécution

Le prompt prévoit `DOMParser` / `XMLSerializer` natifs dans le navigateur et xmldom pour les tests Node. Or **`DOMParser` et `XMLSerializer` n'existent pas dans un Web Worker**, où tournent les adaptateurs et le moteur. Plutôt que de renvoyer l'analyse XML sur le thread principal (l'interface ne ferait plus seulement de l'orchestration), `@xmldom/xmldom` est utilisé partout, Worker comme tests. Justification supplémentaire : le spike 0.3 a montré que xmldom conserve exactement l'ordre des attributs et la déclaration, alors que Chromium réordonne les déclarations d'espaces de noms ; le même code produit donc les mêmes octets dans tous les navigateurs et dans les tests. Coût : ~60 Ko non compressés dans le bundle du Worker.
