# Plan de réalisation — `polyjuice`

À placer dans le dépôt sous `docs/PLAN.md`. Chaque sous-étape est conçue pour être confiée à un agent autonome (sous-agent Claude Code), avec une entrée, une sortie vérifiable et des critères d'acceptation. Les phases sont séquentielles ; à l'intérieur d'une phase, les sous-étapes marquées ∥ peuvent tourner en parallèle.

Légende modèle/effort :

- **Haiku** : tâches mécaniques, à spécification complète, sans arbitrage.
- **Sonnet** : implémentation standard, un peu de conception locale.
- **Opus** : conception, cas limites nombreux, revue.
- Effort : `low` / `medium` / `high` / `max` (paramètre d'effort de Claude Code).

Le modèle est choisi pour la difficulté réelle de la sous-étape, pas pour son volume de code.

---

## Phase 0 — Validation des hypothèses (humain + agent, avant tout code de production)

Ces deux spikes conditionnent des décisions du prompt. S'ils échouent, le prompt est corrigé avant la phase 1.

### 0.1 Spike : survie des tokens dans l'outil de traduction — *Sonnet, medium*

- Écrire `spikes/token_survival.py` : génère un `.docx` et un `.md` contenant 20 phrases en FR/DE/EN avec des tokens `⟦P-K7M2X⟧`, `⟦O-R4N8Q⟧`, `⟦E-W3X9Z⟧` placés en début, milieu, fin de phrase, dans un tableau, dans une note de bas de page.
- Fournir un script `spikes/token_survival_check.py` qui, étant donné le fichier traduit, liste les tokens attendus, retrouvés intacts, retrouvés déformés (regex permissive), absents.
- **L'humain** passe les fichiers dans l'outil de traduction réel et lance le check.
- Acceptation : 100 % des tokens retrouvés intacts. Sinon : rapport des déformations observées, et décision humaine sur le format de token avant la phase 1.

### 0.2 Spike : qualité et temps de la NER spaCy `md` — *Sonnet, medium*

- `spikes/ner_bench.py` : charge `fr_core_news_md`, `de_core_news_md`, `en_core_web_md`, mesure le temps de chargement et le temps d'analyse d'un texte de 2 000 mots par langue, et affiche les entités `PERSON`/`ORG`/`LOC` détectées sur un échantillon fictif fourni dans le script (10 phrases par langue, avec des noms français, allemands, polonais, turcs, et des pièges : noms communs avec majuscule en allemand, prénoms seuls).
- Acceptation : chiffres réels consignés dans `docs/DEVIATIONS.md` section « Benchmarks », et liste des faux négatifs observés. Pas de seuil bloquant ; c'est de l'information pour calibrer les attentes et la liste de noms.

---

## Phase 1 — Squelette du dépôt

### 1.1 Initialisation — *Haiku, low*

- `uv init`, `pyproject.toml` complet (nom, version 0.1.0, Python 3.12, dépendances du §8 du prompt, scripts `polyjuice = "polyjuice.cli:app"`), `uv.lock`.
- Modèles spaCy déclarés comme dépendances pip via URL de release.
- `ruff.toml`, `mypy.ini` (strict), `pytest.ini`, `Makefile` (`lint`, `typecheck`, `test`, `all`), `.gitignore`, `LICENSE` (MIT), `README.md` minimal.
- Arborescence des paquets vides avec `__init__.py` selon l'architecture du prompt.
- Acceptation : `uv sync` réussit, `make all` vert sur un dépôt vide, `polyjuice --help` affiche les trois commandes (stubs qui lèvent `NotImplementedError`).

### 1.2 Fixtures de test — *Haiku, medium*

- `tests/make_fixtures.py` qui génère, de manière reproductible, un document par format (`.docx`, `.pptx`, `.xlsx`, `.pdf`, `.md`, `.txt`) contenant des données **fictives** en FR, DE et EN : noms, e-mails, téléphones FR et internationaux, un NIR valide fictif, un IBAN valide fictif, une URL, une IP.
- Le DOCX doit contenir : un tableau, un en-tête, un pied de page, une note de bas de page, un commentaire, une zone de texte, une image, et au moins un nom **volontairement coupé sur deux runs** (mise en forme partielle).
- Le PPTX : un groupe de formes imbriqué, un tableau, des notes du présentateur, une image.
- Le XLSX : colonnes `Nom`, `Prénom`, `Email`, `Téléphone`, `Montant` (numérique), une formule, une cellule date.
- Le PDF : généré avec PyMuPDF à partir de texte (avec couche texte), plus un second PDF « scanné » constitué d'une page image sans texte.
- `tests/fixtures/expected.json` : pour chaque fixture, la liste des entités attendues (texte, type) servant de vérité terrain aux tests.
- Acceptation : `python tests/make_fixtures.py` régénère des fichiers identiques (seed fixe) ; les fixtures s'ouvrent dans leurs applications respectives.

---

## Phase 2 — Moteur (indépendant des formats)

### 2.1 Tokens — *Sonnet, medium* ∥

- `engine/tokens.py` : alphabet, dérivation HMAC-SHA256 avec salt, encodage 5 caractères, gestion des collisions par suffixe, regex `TOKEN_RE` d'identification d'un token (type + 5 caractères + suffixe optionnel) utilisée par `restore` et `check`.
- Tests : déterminisme (même salt + même entrée → même token), unicité sur 100 000 entrées aléatoires (aucune collision non gérée), la regex ne matche pas de faux positifs sur du texte avec crochets ordinaires.

### 2.2 Mapping — *Sonnet, medium* ∥

- `engine/mapping.py` : dataclasses `Mapping`, `Entity`, lecture/écriture JSON conforme au §5, création avec salt aléatoire, `get_or_create_token(original, type, source)`, incrément des occurrences, ajout d'avertissements, sha256 du fichier source.
- Comportement « réutiliser si existe » : charger un mapping existant conserve salt et entités ; un mapping dont `schema_version` est inconnu lève une erreur explicite.
- Tests : round-trip JSON, réutilisation, versions.

### 2.3 Détection de langue — *Haiku, medium* ∥

- `engine/language.py` : `detect(text) -> "fr"|"de"|"en"|None` avec lingua restreint aux trois langues, seuil de 5 mots ; `dominant(segments) -> str` sur le texte concaténé, repli `en`.
- Tests sur phrases FR/DE/EN et segments trop courts.

### 2.4 Reconnaisseurs regex — *Sonnet, high* ∥

- `recognizers/common.py` : e-mail, IBAN (format + validation modulo 97), URL, IPv4/IPv6, carte bancaire (Luhn), téléphone international. Utiliser les reconnaisseurs Presidio existants quand ils sont corrects, les remplacer sinon.
- `recognizers/fr.py` : NIR (15 chiffres, clé de contrôle, séparateurs optionnels), téléphone national FR.
- Liste de noms : `NamesRecognizer(path)` → deny-list, frontières de mots, insensible à la casse, accents respectés.
- Tests : cas positifs et négatifs pour chaque regex, en particulier : un numéro à 15 chiffres sans clé valide n'est pas un NIR ; un IBAN invalide n'est pas détecté ; `+33` et `0033` ; les noms de la liste ne matchent pas en sous-chaîne (« Martin » ne matche pas « Martinique »).

### 2.5 Moteur de détection — *Opus, high*

- `engine/detect.py` : construction de l'`AnalyzerEngine` Presidio avec `NlpEngine` multi-langues (chargement paresseux des modèles md), enregistrement des reconnaisseurs de la 2.4, désactivation des types non retenus, seuil 0.5, résolution des chevauchements (plus long puis plus confiant), mapping des types Presidio vers les lettres de token.
- `detect(segment_text, language, *, ner: bool, names, columns_mode) -> list[Detection]`.
- Option `ner=False` pour XLSX.
- Tests : sur des textes FR/DE/EN avec vérité terrain ; chevauchements (un e-mail contenant un nom ne produit qu'une détection `E`) ; `ner=False` ne retourne que regex et liste ; un token déjà présent dans le texte n'est jamais détecté comme entité.

### 2.6 Remplacement et restauration sur texte — *Sonnet, high*

- `engine/replace.py` : applique une liste de détections sur un texte en partant de la fin (offsets stables), obtient les tokens via le mapping, retourne le texte modifié et les spans remplacés (pour la fusion des runs dans les adaptateurs).
- `engine/restore.py` : remplacement strict de tous les tokens du mapping, inventaire des tokens retrouvés / non retrouvés / inconnus (via `TOKEN_RE`).
- Tests : round-trip pur texte sur 50 cas générés ; tokens inconnus signalés ; une entité apparaissant 4 fois donne 4 occurrences dans le mapping.

### 2.7 Rapports — *Haiku, medium*

- `engine/report.py` : génération des trois rapports Markdown du §7 à partir de structures de données (pas de logique de détection ici). Extraits de contexte ±40 caractères, affichage console en couleur via `rich`.
- Tests : snapshot des rapports sur des données fixes.

---

## Phase 3 — Premier format de bout en bout

### 3.1 Adaptateur texte/Markdown — *Sonnet, medium*

- `adapters/text.py` : un segment par ligne ; en `.md`, exclusion des blocs de code et des cibles de liens/images ; conservation des fins de ligne.
- Tests : round-trip sur les fixtures `.md` et `.txt` ; un e-mail dans une cible de lien n'est pas anonymisé, le même e-mail dans le texte du lien l'est ; un bloc de code est intact.

### 3.2 CLI complète — *Sonnet, high*

- `cli.py` avec Typer : les trois commandes et toutes leurs options, résolution du mapping par défaut (`<nom>.json`), chargement/réutilisation, codes de sortie, affichage des avertissements, `--verbose`.
- Branchement dynamique de l'adaptateur par extension, erreur explicite pour une extension inconnue.
- Tests d'intégration via `typer.testing.CliRunner` sur `.md` : `anon` → fichiers produits ; `anon` relancé → octets identiques ; `check` sur la sortie → code 0 ; `restore` → texte d'origine ; `restore` avec un token inconnu injecté → code 1.
- Acceptation : le flux complet fonctionne sur `.md` et `.txt`. **Jalon : MVP texte utilisable.**

---

## Phase 4 — DOCX (format critique)

### 4.1 Lecture DOCX — *Opus, high*

- `adapters/docx.py::read` : parcours des paragraphes du corps, des tableaux (récursif), en-têtes et pieds de page de toutes les sections, notes de bas de page et de fin, commentaires, zones de texte. python-docx n'expose pas tout nativement : accès direct au XML via `lxml` pour les parties manquantes (notes, commentaires, `txbxContent`). Un `locator` doit permettre de retrouver l'élément `w:p` exact.
- Détection des images, SmartArt, OLE pour les avertissements. Lecture des `core_properties`.
- Tests : sur la fixture DOCX, toutes les entités attendues de `expected.json` sont présentes dans les segments extraits, chaque zone avec le bon `kind` ; le nom coupé sur deux runs apparaît entier dans son segment.
- Consigner dans `docs/DEVIATIONS.md` tout accès XML direct.

### 4.2 Écriture DOCX avec fusion des runs — *Opus, max*

- `adapters/docx.py::write` : pour chaque segment modifié, projeter les spans remplacés sur les runs du paragraphe ; fusionner les runs touchés dans le premier (conserver son `rPr`), vider les suivants ; laisser les runs non touchés intacts ; gérer les runs contenant des éléments non textuels (`w:tab`, `w:br`, `w:drawing`) sans les perdre.
- Vidage des métadonnées ; neutralisation des horodatages `modified`/`created` pour le test de déterminisme.
- Tests : round-trip complet sur la fixture (le texte restauré est identique à l'original, zone par zone) ; la mise en forme des runs non touchés est préservée (comparaison XML) ; un remplacement à cheval sur deux runs fonctionne ; deux `anon` successifs produisent le même `.docx` octet pour octet ; le document s'ouvre sans réparation dans LibreOffice (test via `soffice --headless --convert-to pdf` si disponible, sinon validation XML contre la structure attendue).

### 4.3 Flux `restore` DOCX → DOCX — *Sonnet, high*

- Vérifier que `restore` fonctionne sur un DOCX dont les runs ont été redécoupés : écrire un test qui prend la fixture anonymisée, redécoupe artificiellement chaque token sur deux ou trois runs (simulation du traducteur), puis restaure.
- Acceptation : texte restauré identique à l'original ; rapport de restauration correct. **Jalon : cas d'usage principal couvert.**

---

## Phase 5 — Autres formats

### 5.1 PPTX — *Sonnet, high* ∥

- `adapters/pptx.py` : formes texte, groupes récursifs, tableaux, notes du présentateur, masques si texte présent ; même fusion de runs que DOCX (factoriser l'algorithme de fusion dans `adapters/_runs.py` si les structures python-docx/python-pptx le permettent, sinon dupliquer proprement et le dire dans `DEVIATIONS.md`) ; métadonnées ; avertissements images/SmartArt/graphiques/OLE.
- Tests : round-trip sur la fixture, notes incluses, groupe imbriqué inclus.

### 5.2 XLSX — *Sonnet, medium* ∥

- `adapters/xlsx.py` : cellules chaînes uniquement, formules/nombres/dates intacts, `--columns`, NER désactivée, métadonnées, avertissement macros/graphiques.
- Tests : round-trip ; la formule et la cellule date sont intactes octet pour octet ; `--columns "Nom,Prénom"` anonymise toute la colonne y compris les cellules que les regex ne détecteraient pas ; `check` signale un nom de feuille présent dans la liste.

### 5.3 PDF — *Sonnet, medium* ∥

- `adapters/pdf.py` : lecture seule via PyMuPDF, blocs → Markdown, séparateur de page, heuristique « scanné » (< 200 caractères/page), avertissement images.
- Sortie `.md` passée ensuite à l'adaptateur texte pour la réécriture.
- Tests : la fixture PDF texte produit un `.md` contenant toutes les entités attendues ; la fixture « scannée » produit l'avertissement et un `.md` quasi vide, sans erreur ; `restore` d'un PDF lève une erreur explicite indiquant de restaurer le `.md`.

### 5.4 Rapports et avertissements finaux — *Haiku, medium*

- Brancher tous les avertissements des adaptateurs dans le rapport et le mapping ; vérifier l'affichage console ; vérifier le rappel « ne pas transmettre le mapping ».
- Tests snapshot des rapports sur chaque fixture.

---

## Phase 6 — Multilingue

### 6.1 Détection de langue par segment dans le flux complet — *Sonnet, medium*

- Brancher `language.py` dans le moteur : langue par segment, repli sur la langue dominante, repli `en` ; activation des regex FR uniquement sur segments FR ; mapping `languages` renseigné.
- Fixture mixte : un DOCX FR avec un paragraphe DE et un tableau EN.
- Tests : les trois modèles sont chargés paresseusement (un document purement FR ne charge pas `de_core_news_md`) ; les entités de chaque langue sont détectées ; un téléphone au format national FR dans un paragraphe DE n'est pas détecté comme FR (mais l'est au format international).

### 6.2 Calibration sur documents réels — *humain + Sonnet, medium*

- L'humain passe 5 à 10 documents internes réels (hors dépôt, jamais commités) ; l'agent fournit `spikes/calibrate.py` qui agrège les rapports et liste les faux positifs/négatifs signalés manuellement dans un CSV.
- Sortie : ajustements du seuil, de la liste de noms, ou des regex, consignés dans `DEVIATIONS.md`. Aucune nouvelle fonctionnalité.

---

## Phase 7 — Finition

### 7.1 Documentation — *Haiku, medium* ∥

- `README.md` complet selon §8 du prompt (installation via `uv tool install`, exemples des trois commandes pour chaque format, tokens, hors périmètre, avertissement mapping, paragraphe Conformité).
- `docs/FORMATS.md` : ce qui est traité et non traité, format par format.

### 7.2 Tests de bout en bout et déterminisme global — *Sonnet, medium* ∥

- Test paramétré sur tous les formats : `anon` → `check` (code 0) → `restore` → égalité texte ; `anon` ×2 → identité des sorties.
- Test de non-fuite : aucune entité de `expected.json` n'apparaît en clair dans un document anonymisé, ni dans un rapport (hors contexte tronqué autorisé), ni dans les logs `INFO`.
- Couverture minimale 85 % sur `polyjuice/engine`.

### 7.3 Revue finale — *Opus, high*

- Relecture complète du code contre le prompt : chaque décision fermée est-elle respectée ? Rien d'ajouté hors périmètre ? Les écarts sont-ils tous dans `DEVIATIONS.md` ?
- Revue de sécurité ciblée : aucune donnée personnelle dans les logs, le mapping n'est jamais écrit ailleurs que là où demandé, aucun appel réseau à l'exécution (vérifier avec un test qui bloque les sockets).
- Sortie : liste de corrections, chacune traitée par un agent **Sonnet, medium**, puis nouvelle passe de revue jusqu'à liste vide.
- Tag `v0.1.0`.

---

## Récapitulatif des affectations

| Sous-étape | Modèle | Effort | Parallélisable |
|---|---|---|---|
| 0.1 Spike tokens | Sonnet | medium | |
| 0.2 Spike NER | Sonnet | medium | |
| 1.1 Init dépôt | Haiku | low | |
| 1.2 Fixtures | Haiku | medium | |
| 2.1 Tokens | Sonnet | medium | ∥ |
| 2.2 Mapping | Sonnet | medium | ∥ |
| 2.3 Langue | Haiku | medium | ∥ |
| 2.4 Regex | Sonnet | high | ∥ |
| 2.5 Moteur détection | Opus | high | |
| 2.6 Replace/restore | Sonnet | high | |
| 2.7 Rapports | Haiku | medium | |
| 3.1 Adaptateur texte | Sonnet | medium | |
| 3.2 CLI | Sonnet | high | |
| 4.1 Lecture DOCX | Opus | high | |
| 4.2 Écriture DOCX | Opus | max | |
| 4.3 Restore DOCX | Sonnet | high | |
| 5.1 PPTX | Sonnet | high | ∥ |
| 5.2 XLSX | Sonnet | medium | ∥ |
| 5.3 PDF | Sonnet | medium | ∥ |
| 5.4 Rapports finaux | Haiku | medium | |
| 6.1 Multilingue | Sonnet | medium | |
| 6.2 Calibration | Sonnet | medium | |
| 7.1 Documentation | Haiku | medium | ∥ |
| 7.2 Tests E2E | Sonnet | medium | ∥ |
| 7.3 Revue finale | Opus | high | |

