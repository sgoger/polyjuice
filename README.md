# polyjuice

Application web statique qui **pseudonymise** des documents bureautiques avant leur envoi à un outil externe (LLM, traduction automatique, résumé), puis **restaure** les données d'origine dans le document retourné.

**Tout le traitement se fait dans le navigateur.** Aucun fichier, aucun fragment de texte, aucun mapping ne quitte le poste de l'utilisateur. Il n'y a ni serveur applicatif, ni API, ni base de données : le site est servi tel quel par GitHub Pages.

> **⚠ Le mapping JSON contient les données personnelles en clair. Il ne doit jamais être transmis avec le document anonymisé, ni à l'outil externe. Conservez-le localement le temps de restaurer le document, puis supprimez-le.**

## Utilisation

La page comporte trois onglets.

### Anonymiser

1. Déposez le document (`.docx`, `.pptx`, `.xlsx`, `.pdf`, `.md`, `.txt`).
2. Facultatif : collez ou chargez une **liste de noms** (un terme par ligne, `#` pour les commentaires). Chaque terme est remplacé partout où il apparaît (correspondance exacte, insensible à la casse, accents respectés, mots entiers). La liste n'est jamais enregistrée : elle est perdue au rechargement de la page.
3. Facultatif : cochez **« Activer la détection de noms par IA »** pour repérer en plus les personnes, organisations et lieux. Le modèle (~181 Mo) est téléchargé une fois depuis le Hub Hugging Face puis gardé en cache par le navigateur. Indisponible pour les `.xlsx`.
4. Pour un `.xlsx`, le champ **« Colonnes à anonymiser »** (ex. `Nom, Prénom`) remplace intégralement toutes les cellules texte des colonnes dont l'en-tête (première ligne non vide de chaque feuille) correspond.
5. Facultatif : redéposez un **mapping existant** pour réutiliser le même salt et les mêmes tokens (le mapping est complété, jamais tronqué).
6. Lancez le traitement. Lisez le **bandeau d'avertissements** (images, SmartArt, macros, métadonnées vidées…), puis téléchargez le document anonymisé, le mapping et le rapport.

### Vérifier

Déposez un document déjà anonymisé (et la liste de noms si besoin) : la détection est relancée et tout ce qui ressemble encore à une donnée personnelle est listé, avec son contexte. Rien n'est produit. Les tokens existants sont ignorés.

### Restaurer

Déposez le document retourné par l'outil externe **et** le mapping. Chaque token connu est remplacé par sa valeur d'origine, même si l'outil a découpé le token sur plusieurs mises en forme. Les tokens au format polyjuice absents du mapping sont signalés comme une erreur et laissés tels quels. Le document est traité selon son extension, quelle que soit celle de l'original : un PDF anonymisé revient sous forme de `.md` ou `.txt`.

## Formats

| Format  | Sortie de « Anonymiser »    | Entrée de « Restaurer »                   |
| ------- | --------------------------- | ----------------------------------------- |
| `.docx` | `.docx`                     | oui                                       |
| `.pptx` | `.pptx`                     | oui                                       |
| `.xlsx` | `.xlsx`                     | oui                                       |
| `.pdf`  | `.md` (extraction du texte) | non (déposez le `.md` ou `.txt` retourné) |
| `.md`   | `.md`                       | oui                                       |
| `.txt`  | `.txt`                      | oui                                       |

Les documents Office sont modifiés directement dans leur XML : seuls les nœuds de texte changent, tout le reste (mise en forme, images, graphiques…) est recopié octet pour octet. Ce qui est traité ou non, format par format : [`docs/FORMATS.md`](docs/FORMATS.md).

## Données détectées et tokens

| Type                            | Token   | Détection                                |
| ------------------------------- | ------- | ---------------------------------------- |
| Personne                        | `⟦P-…⟧` | IA (NER), liste de noms, colonnes (xlsx) |
| Organisation                    | `⟦O-…⟧` | IA (NER)                                 |
| Lieu                            | `⟦L-…⟧` | IA (NER)                                 |
| E-mail                          | `⟦E-…⟧` | motif                                    |
| Téléphone (FR et international) | `⟦T-…⟧` | motif                                    |
| IBAN (clé vérifiée)             | `⟦I-…⟧` | motif                                    |
| Carte bancaire (Luhn)           | `⟦C-…⟧` | motif                                    |
| URL                             | `⟦U-…⟧` | motif                                    |
| Adresse IP (v4, v6)             | `⟦A-…⟧` | motif                                    |
| NIR (clé vérifiée)              | `⟦N-…⟧` | motif                                    |

Un token a la forme `⟦X-ABCDE⟧` : `X` est la lettre du type, `ABCDE` cinq caractères dérivés par HMAC-SHA256 d'un salt aléatoire propre au mapping. La même valeur reçoit le même token dans tout le document ; réutiliser un mapping redonne exactement le même document ; deux documents anonymisés séparément ont des tokens différents. Les dates ne sont pas anonymisées.

## Hors périmètre

Non traité dans cette version (un avertissement est affiché quand c'est pertinent) : texte contenu dans les images (pas d'OCR), PDF scannés, SmartArt, objets OLE, graphiques ; regroupement des variantes d'un même nom ; mapping partagé entre documents ; restauration de tokens déformés par l'outil externe ; pseudonymes réalistes ; tout stockage persistant ; tout serveur ; identifiants nationaux autres que le NIR français. Ne sont pas non plus modifiés, mais signalés : cibles des liens hypertextes, codes de champ Word, noms d'auteurs de commentaires et de révisions, noms de feuilles de calcul.

## Conformité

polyjuice **pseudonymise** : il remplace les données identifiantes par des tokens, réversibles grâce au mapping. Au sens du RGPD et de la CNIL, la pseudonymisation n'est pas une anonymisation : les documents produits restent des **données personnelles**, soumises aux mêmes règles que les originaux, et le mapping permet la réidentification. La détection automatique n'est pas exhaustive : relisez le document anonymisé (onglet « Vérifier ») avant tout envoi.

Rien ne quitte le navigateur : les fichiers sont lus et produits localement, et les téléchargements sont générés sur le poste. Lorsque la détection par IA est activée, le navigateur télécharge les poids du modèle depuis le Hub Hugging Face ; cette requête ne transmet aucune donnée utilisateur (ni document, ni texte, ni liste de noms). Détails : [`docs/PRIVACY.md`](docs/PRIVACY.md).

## Développement

Prérequis : Node.js 22 ou plus récent.

```sh
npm ci
npm run dev              # serveur de développement
npm run check            # lint + typecheck + tests unitaires (avec couverture)
npm run test:e2e         # tests Playwright (Chromium)
npm run test:e2e:slow    # test Playwright avec téléchargement du modèle NER
npm run build            # site statique dans dist/
npm run fixtures         # régénère les fixtures de test (données fictives)
```

Architecture : un moteur de détection et de remplacement (`src/engine/`) qui ne connaît aucun format, des adaptateurs par format (`src/adapters/`) qui extraient et réécrivent des segments de texte, le tout exécuté dans un Web Worker (`src/worker/`) ; l'interface React (`src/app/`) ne fait qu'orchestrer et afficher. Plan de réalisation : [`docs/PLAN.md`](docs/PLAN.md) ; écarts et décisions techniques : [`docs/DEVIATIONS.md`](docs/DEVIATIONS.md) ; idées hors périmètre : [`docs/IDEAS.md`](docs/IDEAS.md).

Aucune liste de noms, aucun document réel et aucun mapping ne doivent être ajoutés au dépôt (`tests/real/` et `names*.txt` sont ignorés par git).

## Licence

MIT
