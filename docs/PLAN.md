# Plan de réalisation — `polyjuice` (version web)

À placer sous `docs/PLAN.md`. Chaque sous-étape est conçue pour un agent autonome, avec une sortie vérifiable et des critères d'acceptation. Phases séquentielles ; ∥ = sous-étapes parallélisables au sein d'une phase.

Modèles : **Haiku** (mécanique, spécification complète), **Sonnet** (implémentation standard), **Opus** (conception, cas limites nombreux, revue). Effort : `low` / `medium` / `high` / `max`.

---

## Phase 0 — Validation des hypothèses

Ces trois spikes conditionnent des décisions du prompt. Résultats consignés dans `docs/DEVIATIONS.md` section « Spikes ». Aucun code de production.

### 0.1 Spike : survie des tokens dans l'outil de traduction — *Sonnet, medium*

- `spikes/token-survival/make.ts` : génère un `.docx` et un `.md` avec 20 phrases FR/DE/EN contenant `⟦P-K7M2X⟧`, `⟦O-R4N8Q⟧`, `⟦E-W3X9Z⟧` en début, milieu, fin de phrase, dans un tableau, dans une note.
- `spikes/token-survival/check.ts` : lit le fichier traduit et classe chaque token attendu en intact / déformé (regex permissive) / absent.
- L'humain passe les fichiers dans l'outil de traduction réel.
- Acceptation : 100 % intacts. Sinon, décision humaine sur le format avant la phase 1.

### 0.2 Spike : NER dans le navigateur — *Sonnet, high*

- Page Vite minimale `spikes/ner-browser/` qui charge `Xenova/bert-base-multilingual-cased-ner-hrl` (quantifié) via transformers.js dans un Worker, affiche : taille téléchargée, temps de chargement à froid et à chaud (cache), temps d'analyse d'un texte de 2 000 mots, pic mémoire (`performance.memory` si disponible), et les entités détectées sur 10 phrases par langue avec des pièges (noms polonais, turcs, noms communs allemands avec majuscule, prénoms seuls, noms dans un tableau).
- Tester WASM mono-thread et WebGPU si disponible. Tester sur Chrome, Firefox, Safari.
- Comparer avec au moins un modèle alternatif (portage ONNX de GLiNER si disponible sur le Hub, ou un modèle NER multilingue plus petit).
- Acceptation : un tableau comparatif et une recommandation de modèle. Le nom retenu devient la constante de `ner.ts`. Si aucun modèle n'est utilisable (temps > 2 min à froid sur un portable standard, ou qualité inacceptable), le remonter : c'est le premier signal de passage au plan B.

### 0.3 Spike : réécriture OOXML sans perte — *Sonnet, high*

- `spikes/ooxml-roundtrip/` : ouvrir un `.docx` complexe (styles, images, tableaux, en-têtes) avec JSZip, parser `document.xml` avec DOMParser, modifier un seul `w:t`, re-sérialiser, réécrire le zip. Vérifier : le fichier s'ouvre dans Word/LibreOffice sans réparation ; toutes les autres parties sont identiques octet pour octet ; les namespaces et `mc:Ignorable` sont préservés ; `xml:space="preserve"` est respecté.
- Même chose sur un `.pptx` et un `.xlsx`.
- Acceptation : procédure validée et pièges listés (ordre des attributs, déclaration XML, entités, CRLF) dans `DEVIATIONS.md`. Ce spike fixe les règles de `ooxml/xml.ts`.

---

## Phase 1 — Squelette

### 1.1 Initialisation — *Haiku, low*

- Vite + React + TypeScript strict + Tailwind, ESLint (typescript-eslint strict), Prettier, Vitest, Playwright, scripts npm (`lint`, `typecheck`, `test`, `test:e2e`, `build`, `check`), `.gitignore` (dont `names*.txt`, `tests/real/`), `LICENSE` MIT, `README.md` minimal, arborescence vide selon §2 du prompt.
- CI GitHub Actions : `check` + `build` sur push ; déploiement GitHub Pages sur `main` ; `base` Vite configuré.
- Acceptation : `npm run check` et `npm run build` verts sur un projet vide ; la page vide est déployée et accessible.

### 1.2 Fixtures — *Haiku, medium*

- `scripts/make-fixtures.ts` (seed fixe) générant `.docx` (`docx`), `.pptx` (`pptxgenjs`), `.xlsx` (`exceljs`), `.pdf` texte et `.pdf` « scanné » (page image, `pdf-lib`), `.md`, `.txt`, avec données fictives FR/DE/EN : noms, e-mails, téléphones FR et internationaux, NIR valide fictif, IBAN valide fictif, URL, IP.
- DOCX : tableau, en-tête, pied de page, note de bas de page, commentaire, zone de texte, image, un nom coupé sur deux runs, un hyperlien contenant un e-mail.
- PPTX : groupe imbriqué, tableau, notes du présentateur, image.
- XLSX : colonnes `Nom`, `Prénom`, `Email`, `Téléphone`, `Montant` (numérique), une formule, une date, une chaîne partagée réutilisée dans deux colonnes, une cellule texte riche.
- `tests/fixtures/expected.json` : vérité terrain (texte, type, kind) par fixture.
- Acceptation : génération reproductible ; fichiers ouvrables.

### 1.3 Squelette du Worker et protocole — *Sonnet, medium*

- `worker/engine.worker.ts` + `worker/protocol.ts` : messages typés `anonymize`, `check`, `restore`, `loadNer`, `cancel` ; réponses `progress`, `result`, `error`, `nerProgress`. Un `WorkerClient` côté app qui promisifie les appels et expose la progression.
- Acceptation : test Vitest du protocole avec un Worker factice ; un appel `anonymize` sur un `.txt` renvoie une erreur `NotImplemented` proprement typée.

---

## Phase 2 — Moteur

### 2.1 Tokens — *Sonnet, medium* ∥

- `engine/tokens.ts` : alphabet, HMAC-SHA256 via `crypto.subtle` (polyfill Node : `webcrypto` de `node:crypto`), encodage 5 caractères, collisions par suffixe, `TOKEN_RE` (type + 5 caractères + suffixe optionnel).
- Tests : déterminisme, unicité sur 100 000 entrées, pas de faux positifs de `TOKEN_RE` sur du texte avec crochets ordinaires et sur `⟦` isolé.

### 2.2 Mapping — *Sonnet, medium* ∥

- `engine/mapping.ts` : types, schéma `zod`, création avec salt, `getOrCreateToken`, occurrences, avertissements, sha256 du fichier source (`crypto.subtle.digest`), sérialisation stable (clés triées).
- Réimport d'un mapping existant : conservation du salt et des entités ; `schema_version` inconnu → erreur explicite.
- Tests : round-trip, réutilisation, validation d'un JSON malformé.

### 2.3 Regex — *Sonnet, high* ∥

- `detectors/regexCommon.ts`, `detectors/regexFr.ts` : toutes les regex du §3 du prompt, avec les validations (modulo 97, Luhn, clé NIR). Regex Unicode (`u`), frontières de mots gérées explicitement (`\b` est ASCII en JS : utiliser `(?<![\p{L}\p{N}])` / `(?![\p{L}\p{N}])`).
- Tests : positifs et négatifs par regex ; 15 chiffres sans clé valide ≠ NIR ; IBAN invalide non détecté ; `+33` et `0033` ; pas de détection à l'intérieur d'un token existant.

### 2.4 Liste de noms — *Haiku, medium* ∥

- `detectors/names.ts` : parse (`#` commentaires, lignes vides, trim), construction d'une regex alternée échappée, triée par longueur décroissante, insensible à la casse, frontières de mots Unicode.
- Tests : « Martin » ne matche pas « Martinique » ; accents respectés ; termes multi-mots ; 2 000 termes sans dégradation notable.

### 2.5 NER transformers.js — *Sonnet, high*

- `detectors/ner.ts` : `NerProvider` + implémentation avec le modèle retenu en 0.2, pipeline `token-classification` avec agrégation des sous-tokens (`aggregation_strategy`), mapping `PER/ORG/LOC` → types internes, seuil 0.5, découpage des segments longs en fenêtres chevauchantes (le modèle a une limite de 512 tokens) avec fusion des détections au niveau caractère, progression de téléchargement remontée au Worker.
- Tests : en Node avec le modèle (test marqué lent, exécuté en CI nightly uniquement) : sur 10 phrases par langue, rappel minimal documenté (pas de seuil bloquant, valeur consignée) ; test unitaire du découpage en fenêtres et de la reconstitution des offsets avec un provider factice.

### 2.6 Orchestration de la détection — *Opus, high*

- `engine/detect.ts` : exécute regex + liste (+ NER si activée) sur un segment, fusionne, exclut les tokens existants, résout les chevauchements (plus long, puis plus confiant), produit `Detection[]` triées.
- Options : `ner: boolean`, `names`, `columnsMode` (pour XLSX, les segments marqués par l'adaptateur sont intégralement remplacés).
- Tests : vérité terrain FR/DE/EN avec provider NER factice ; un e-mail contenant un nom de la liste ne produit qu'une détection `E` ; `ner:false` ne retourne que regex et liste.

### 2.7 Remplacement et restauration — *Sonnet, high*

- `engine/replace.ts` : application des détections de la fin vers le début, tokens via mapping, retour du texte et des spans (positions dans le texte final) pour la fusion des runs.
- `engine/restore.ts` : remplacement strict, inventaire retrouvés / non retrouvés / inconnus.
- Tests : round-trip sur 50 cas générés ; occurrences comptées ; tokens inconnus signalés.

### 2.8 Rapports — *Haiku, medium*

- `engine/report.ts` : trois rapports Markdown (§7), extraits ±40 caractères, et une structure de données parallèle pour l'affichage React.
- Tests : snapshots.

---

## Phase 3 — Premier format de bout en bout

### 3.1 Adaptateur texte/Markdown — *Sonnet, medium*

- `adapters/text.ts` : un segment par ligne, exclusions Markdown (blocs de code, cibles de liens/images), fins de ligne et BOM préservés.
- Tests : round-trip `.md` et `.txt` ; e-mail dans une cible de lien intact, le même dans le texte du lien anonymisé ; bloc de code intact.

### 3.2 Interface minimale — *Sonnet, high*

- `app/` : les trois onglets, zone de dépôt, zone liste de noms, case NER (grisée si `.xlsx`), progression, bandeau d'avertissements, rapport affiché, trois boutons de téléchargement, bandeau de pied de page. Branchement sur `WorkerClient`. Pas de polish visuel à ce stade mais structure et accessibilité clavier en place.
- Playwright : parcours complet sur un `.md` (anonymiser sans NER → télécharger → vérifier → restaurer), vérification que le texte restauré est identique.
- Acceptation : **MVP texte utilisable en ligne.** Déployé sur Pages.

---

## Phase 4 — DOCX (format critique)

### 4.1 Socle OOXML — *Opus, high*

- `ooxml/zip.ts` : ouverture, lecture d'une partie en texte, réécriture d'une partie, ré-emballage en conservant l'ordre des entrées, la méthode de compression et les octets de toutes les parties non modifiées. `[Content_Types].xml` et les `.rels` ne sont modifiés que pour la suppression de `custom.xml`.
- `ooxml/xml.ts` : parse/serialize selon les règles du spike 0.3 (déclaration XML, namespaces, `xml:space`), utilitaires de parcours par nom qualifié.
- `ooxml/runs.ts` : algorithme générique de fusion des runs, paramétré par les noms d'éléments (`w:r/w:t/w:rPr` ou `a:r/a:t/a:rPr`) et la liste des éléments non textuels à préserver. Entrée : un paragraphe DOM, un texte concaténé, des spans remplacés. Sortie : le paragraphe modifié.
- Tests : round-trip d'un zip sans modification = octets identiques ; fusion de runs sur des paragraphes synthétiques (span dans un run, à cheval sur deux, sur trois, run avec `w:tab` au milieu, run avec `w:drawing`).

### 4.2 Lecture DOCX — *Opus, high*

- `adapters/docx.ts::read` : toutes les parties et zones du §6 du prompt, `w:tab`/`w:br` dans les offsets, `w:del` ignoré, `mc:AlternateContent` (les deux branches), `kind` par zone, `locator` = (partie, index du `w:p` dans l'ordre du document). Détection images/SmartArt/OLE ; lecture de `core.xml`.
- Tests : sur la fixture, toutes les entités attendues présentes dans les segments, avec le bon `kind` ; le nom coupé sur deux runs apparaît entier ; l'e-mail dans l'hyperlien est présent.

### 4.3 Écriture DOCX — *Opus, max*

- `adapters/docx.ts::write` : fusion des runs via `ooxml/runs.ts`, métadonnées vidées, horodatages neutralisés, ré-emballage.
- Tests : round-trip complet (texte restauré identique zone par zone) ; les parties non textuelles sont identiques octet pour octet ; la mise en forme des runs non touchés est préservée (comparaison XML) ; deux anonymisations successives → fichiers identiques ; le document s'ouvre sans réparation dans LibreOffice (`soffice --headless --convert-to pdf` en CI si disponible, sinon validation structurelle).

### 4.4 Restauration DOCX → DOCX — *Sonnet, high*

- Test qui prend la fixture anonymisée, redécoupe artificiellement chaque token sur deux ou trois `w:r` avec des `w:rPr` différents (simulation du traducteur), puis restaure.
- Acceptation : texte identique à l'original ; rapport correct. **Jalon : cas d'usage principal couvert.** Déployé.

---

## Phase 5 — Autres formats

### 5.1 PPTX — *Sonnet, high* ∥

- `adapters/pptx.ts` : slides, groupes récursifs, tableaux, notes, masques/layouts avec texte ; `a:fld` ignorés ; fusion via `ooxml/runs.ts` ; métadonnées ; avertissements.
- Tests : round-trip ; notes incluses ; groupe imbriqué inclus ; parties non textuelles identiques.

### 5.2 XLSX — *Sonnet, high* ∥

- `adapters/xlsx.ts` : `sharedStrings.xml` (simples et riches), `inlineStr`, colonnes à anonymiser (lecture des en-têtes dans chaque feuille, résolution lettre de colonne → références de cellules → index de chaîne partagée), formules/nombres/dates intacts, VBA copié, noms de feuilles signalés par « Vérifier », métadonnées.
- Tests : round-trip ; formule et date identiques octet pour octet ; colonnes `Nom,Prénom` entièrement anonymisées ; la chaîne partagée réutilisée est anonymisée partout et le rapport le dit.

### 5.3 PDF — *Sonnet, medium* ∥

- `adapters/pdf.ts` : pdf.js en Worker, `getTextContent`, regroupement en paragraphes, Markdown, heuristique scanné, images.
- Tests : fixture texte → `.md` avec toutes les entités ; fixture scannée → avertissement et `.md` quasi vide sans erreur ; « Restaurer » refuse un `.pdf`.

### 5.4 Avertissements et rapports intégrés — *Haiku, medium*

- Tous les avertissements des adaptateurs remontent au bandeau, au rapport et au mapping ; textes en français relus.
- Tests snapshot des rapports sur chaque fixture.

---

## Phase 6 — NER intégrée et calibration

### 6.1 Intégration NER dans l'interface — *Sonnet, medium*

- Case à cocher, barre de progression de téléchargement, message de première utilisation (taille réelle du modèle), repli WebGPU → WASM, gestion de l'échec de téléchargement (hors ligne) sans bloquer le mode regex + liste, annulation.
- Playwright (test lent, nightly) : anonymiser un `.docx` avec NER activée dans Chromium.

### 6.2 Calibration sur documents réels — *humain + Sonnet, medium*

- L'humain traite 5 à 10 documents internes (jamais commités) avec et sans NER ; l'agent fournit `scripts/calibrate.ts` qui agrège les rapports et un CSV de faux positifs/négatifs saisis à la main.
- Sortie : ajustements du seuil, des regex ou du modèle, consignés dans `DEVIATIONS.md`. **C'est ici que se décide le passage éventuel au plan B** : si la NER navigateur est trop lente ou trop mauvaise pour les usages réels, le rapport de calibration le documente avec chiffres.

---

## Phase 7 — Finition

### 7.1 Interface : finition et accessibilité — *Sonnet, medium* ∥

- États vides, erreurs, responsive, navigation clavier complète, contrastes, libellés `aria`, focus visible. Aucun ajout fonctionnel.

### 7.2 Documentation — *Haiku, medium* ∥

- `README.md` complet, `docs/FORMATS.md` (traité / non traité par format), `docs/PRIVACY.md` (ce qui transite ou non, y compris le téléchargement du modèle depuis le Hub : poids seulement, aucune donnée utilisateur).

### 7.3 Tests de bout en bout et non-fuite — *Sonnet, medium* ∥

- Test paramétré tous formats : anonymiser → vérifier (rien) → restaurer → égalité ; anonymiser ×2 → identité.
- Non-fuite : aucune entité de `expected.json` en clair dans un document anonymisé ni dans un rapport (hors contexte tronqué).
- Test réseau : pendant un traitement sans NER, aucune requête sortante (Playwright `page.route` qui échoue sur tout). Avec NER : seules les requêtes vers le Hub pour les poids, aucune avec un corps.
- Couverture minimale 85 % sur `src/engine` et `src/adapters`.

### 7.4 Revue finale — *Opus, high*

- Relecture complète contre le prompt : décisions respectées, rien hors périmètre, écarts documentés.
- Revue confidentialité : aucun stockage persistant hors cache du modèle, aucune requête réseau non prévue, mapping jamais envoyé, liste de noms jamais stockée.
- Sortie : liste de corrections traitées par des agents **Sonnet, medium**, nouvelle passe jusqu'à liste vide. Tag `v0.1.0`.

---

## Récapitulatif

| Sous-étape | Modèle | Effort | ∥ |
|---|---|---|---|
| 0.1 Spike tokens | Sonnet | medium | |
| 0.2 Spike NER navigateur | Sonnet | high | |
| 0.3 Spike OOXML | Sonnet | high | |
| 1.1 Init | Haiku | low | |
| 1.2 Fixtures | Haiku | medium | |
| 1.3 Worker/protocole | Sonnet | medium | |
| 2.1 Tokens | Sonnet | medium | ∥ |
| 2.2 Mapping | Sonnet | medium | ∥ |
| 2.3 Regex | Sonnet | high | ∥ |
| 2.4 Liste de noms | Haiku | medium | ∥ |
| 2.5 NER | Sonnet | high | |
| 2.6 Orchestration | Opus | high | |
| 2.7 Replace/restore | Sonnet | high | |
| 2.8 Rapports | Haiku | medium | |
| 3.1 Adaptateur texte | Sonnet | medium | |
| 3.2 Interface minimale | Sonnet | high | |
| 4.1 Socle OOXML | Opus | high | |
| 4.2 Lecture DOCX | Opus | high | |
| 4.3 Écriture DOCX | Opus | max | |
| 4.4 Restore DOCX | Sonnet | high | |
| 5.1 PPTX | Sonnet | high | ∥ |
| 5.2 XLSX | Sonnet | high | ∥ |
| 5.3 PDF | Sonnet | medium | ∥ |
| 5.4 Avertissements | Haiku | medium | |
| 6.1 NER dans l'UI | Sonnet | medium | |
| 6.2 Calibration | Sonnet | medium | |
| 7.1 UI finition | Sonnet | medium | ∥ |
| 7.2 Documentation | Haiku | medium | ∥ |
| 7.3 E2E / non-fuite | Sonnet | medium | ∥ |
| 7.4 Revue finale | Opus | high | |