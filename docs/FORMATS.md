# Ce qui est traité, format par format

« Traité » : le texte est analysé et les données détectées sont remplacées par des tokens. « Signalé » : non modifié, mais un avertissement est affiché (bandeau, rapport, mapping) ou l'élément est listé par « Vérifier ». « Ignoré » : ni modifié ni signalé.

## `.txt`, `.md`

| Élément                                 | Statut                  |
| --------------------------------------- | ----------------------- |
| Texte, ligne par ligne                  | traité                  |
| Texte des liens Markdown `[texte](…)`   | traité                  |
| Cibles des liens et des images `](…)`   | ignoré (jamais modifié) |
| Blocs de code clôturés (` ``` `, `~~~`) | ignoré (jamais modifié) |
| Code en ligne `` `…` ``                 | traité                  |
| Fins de ligne (`\n`, `\r\n`), BOM UTF-8 | conservés               |

## `.docx`

| Élément                                                                                                                                                      | Statut                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Corps, tableaux, en-têtes, pieds de page, notes de bas de page et de fin, commentaires                                                                       | traité                                                                                    |
| Zones de texte (deux branches de `mc:AlternateContent`)                                                                                                      | traité                                                                                    |
| Hyperliens (texte affiché), balises intelligentes, insertions suivies (`w:ins`)                                                                              | traité                                                                                    |
| Suppressions suivies (`w:del`, `w:moveFrom`)                                                                                                                 | ignoré                                                                                    |
| Tabulations, sauts de ligne, dessins, renvois de notes à l'intérieur des runs                                                                                | conservés                                                                                 |
| Mise en forme des runs non touchés                                                                                                                           | conservée ; un remplacement à cheval sur plusieurs runs prend la mise en forme du premier |
| Métadonnées (`docProps/core.xml` : auteur, dernier modificateur, titre, sujet, mots-clés, description, catégorie, statut ; `app.xml` : société, responsable) | vidées ; dates de création et de modification fixées au 1ᵉʳ janvier 2000 ; signalé        |
| Propriétés personnalisées (`docProps/custom.xml`)                                                                                                            | supprimées ; signalé                                                                      |
| Images (`word/media`)                                                                                                                                        | signalé (pas d'OCR)                                                                       |
| SmartArt (`word/diagrams`), graphiques (`word/charts`), objets OLE (`word/embeddings`)                                                                       | signalé                                                                                   |
| Cibles des liens hypertextes (`*.rels`, ex. `mailto:`)                                                                                                       | signalé si une donnée y est détectée                                                      |
| Codes de champ (`w:instrText`)                                                                                                                               | signalé si une donnée y est détectée                                                      |
| Noms d'auteurs des commentaires et des révisions, `word/people.xml`                                                                                          | signalé                                                                                   |
| Titres recopiés dans `docProps/app.xml`                                                                                                                      | signalé                                                                                   |
| Toutes les autres parties (styles, thème, numérotation…)                                                                                                     | recopiées octet pour octet                                                                |

## `.pptx`

| Élément                                                                                                   | Statut                               |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Formes, groupes imbriqués (à toute profondeur), tableaux                                                  | traité                               |
| Notes du présentateur                                                                                     | traité                               |
| Masques et dispositions (paragraphes contenant du texte)                                                  | traité                               |
| Champs `a:fld` (numéro de diapositive, date)                                                              | ignoré                               |
| Métadonnées                                                                                               | comme `.docx`                        |
| Images (`ppt/media`), SmartArt (`ppt/diagrams`), graphiques (`ppt/charts`), objets OLE (`ppt/embeddings`) | signalé                              |
| Commentaires de diapositives et leurs auteurs                                                             | signalé                              |
| Cibles des liens hypertextes                                                                              | signalé si une donnée y est détectée |
| Titres de diapositives recopiés dans `docProps/app.xml`                                                   | signalé                              |

## `.xlsx`

| Élément                                                                     | Statut                                                                                              |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Chaînes partagées (`xl/sharedStrings.xml`), y compris le texte riche        | traité                                                                                              |
| Cellules en chaîne inline (`inlineStr`)                                     | traité                                                                                              |
| Colonnes à anonymiser (en-tête = première ligne non vide de chaque feuille) | toutes les cellules texte remplacées intégralement (type Personne) ; l'en-tête est conservé         |
| Chaîne partagée utilisée par plusieurs cellules                             | remplacée une fois, donc dans toutes ses cellules ; signalé quand elle sert dans plusieurs colonnes |
| Formules, nombres, dates, booléens                                          | jamais touchés                                                                                      |
| Noms de feuilles (`xl/workbook.xml`)                                        | jamais modifiés ; listés par « Vérifier » s'ils contiennent une donnée détectée                     |
| Styles, graphiques, mises en forme conditionnelles                          | recopiés octet pour octet                                                                           |
| Macros (`xl/vbaProject.bin`)                                                | recopiées ; signalé                                                                                 |
| Commentaires et notes de cellules                                           | signalé                                                                                             |
| Métadonnées                                                                 | comme `.docx`                                                                                       |
| Détection par IA                                                            | toujours désactivée (motifs, liste de noms et colonnes uniquement)                                  |

## `.pdf` (lecture seule)

| Élément                                                               | Statut                                                                               |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Texte des pages                                                       | extrait en Markdown (paragraphes, `---` entre les pages), puis traité comme un `.md` |
| Mise en forme, images, tableaux                                       | perdus ; signalé                                                                     |
| PDF probablement scanné (moins de 200 caractères par page en moyenne) | signalé (pas d'OCR)                                                                  |
| Pages contenant des images                                            | signalé                                                                              |
| Restauration d'un `.pdf`                                              | refusée : déposez le `.md` ou `.txt` retourné par l'outil externe                    |
