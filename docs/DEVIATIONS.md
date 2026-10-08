# Écarts et constats

Ce fichier consigne les écarts entre le prompt et le comportement réel des bibliothèques, avec la solution retenue, ainsi que les mesures faites pendant les spikes.

## Benchmarks

### Spike 0.2 — NER spaCy `md` (2026-10-08)

Mesures obtenues avec `uv run spikes/ner_bench.py` : spaCy 3.8.16, modèles 3.8.0, Python 3.12.8, Apple M1 Pro (32 Go), macOS.

| Langue | Modèle | Chargement (s) | Mots | Analyse (s) | Mots/s |
|---|---|---|---|---|---|
| fr | `fr_core_news_md` | 2,50 | 2 000 | 0,305 | ~6 600 |
| de | `de_core_news_md` | 0,92 | 2 001 | 0,343 | ~5 800 |
| en | `en_core_web_md` | 0,66 | 2 009 | 0,335 | ~6 000 |

Le temps de chargement du premier modèle inclut l'import initial de spaCy et de ses dépendances (~1,5 s) ; un modèle seul se charge en moins d'une seconde. Le chargement paresseux est utile mais pas critique. L'analyse est bien en dessous d'une seconde pour 2 000 mots par langue.

#### Qualité sur l'échantillon fictif (30 phrases, 58 entités attendues)

Comptage strict (même chaîne exacte et même type) : 51 vrais positifs, 7 faux négatifs, 7 faux positifs. La plupart des « faux négatifs » stricts restent anonymisés en pratique (mauvais type ou bornes un peu différentes). Les vraies **fuites** (entité laissée en clair) sont les suivantes :

| Langue | Phrase | Constat | Conséquence |
|---|---|---|---|
| de | « Paulina Kowalski hat gestern den Vertrag in Hamburg unterschrieben. » | `Hamburg` absorbé dans une entité `MISC` (« Vertrag in Hamburg ») | **Fuite** : `MISC` n'est pas un type retenu |
| de | « Laut Sabine ist die Lieferung aus Leipzig… » | Prénom seul `Sabine` étiqueté `MISC` | **Fuite** du prénom |

Erreurs de type, entité quand même remplacée (mauvaise lettre de token) :

| Langue | Entité | Attendu | Obtenu |
|---|---|---|---|
| fr | « Durand Logistique » | ORG | PERSON |
| fr | « Fondation Lumière » | ORG | LOC |
| en | « Lyon » (« Jean Dupont from Lyon ») | LOC | ORG |

Bornes différentes, entité quand même remplacée :

- fr : « Mme Rose Petit » (civilité incluse dans l'entité PERSON).
- en : « The Green Valley Foundation » (article inclus).

Faux positifs :

- de : « Abteilung Verwaltung » (nom commun capitalisé) étiqueté ORG : remplacé à tort.
- en : « Bill » (verbe « to bill » en tête de mot capitalisé) étiqueté PERSON : remplacé à tort.

Bien détectés, y compris les pièges : noms polonais et turcs avec diacritiques (« Grzegorz Brzęczyszczykiewicz », « Ayşe Demir », « Elif Şahin », « Tomasz Zieliński »), prénoms seuls en FR/EN (« Camille », « Martin », « Lucas », « Emily », « Burak », « Sarah ») et noms homographes de noms communs en DE (« Wolf », « Fischer »).

#### Enseignements

- Les modèles FR et DE produisent une étiquette `MISC` qui n'est pas retenue (§3) ; c'est la principale source de fuites observée. Ce constat est noté sans changer le périmètre : la liste de noms (`--names`) est la parade prévue pour les prénoms isolés.
- Les prénoms seuls sont en général bien reconnus, mais pas systématiquement en allemand.
- La précision des types ORG/LOC est moyenne ; elle n'affecte que la lettre du token, pas la protection.
