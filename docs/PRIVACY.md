# Confidentialité : ce qui transite, ce qui ne transite pas

polyjuice est un site statique. Une fois la page chargée, tout le traitement a lieu dans le navigateur, dans un Web Worker.

## Ce qui ne quitte jamais le poste

- les documents déposés et les documents produits ;
- le texte extrait, les détections, les rapports ;
- la liste de noms ;
- le mapping (qui contient les données en clair).

Les fichiers sont lus avec l'API `File` du navigateur et les téléchargements sont produits localement (`Blob` + lien de téléchargement). Aucune requête n'est émise pendant un traitement sans détection par IA : c'est vérifié par un test automatisé qui bloque toute requête sortante et traite chaque format (`tests/e2e/network.spec.ts`).

## Ce qui est stocké

Rien, à une exception près. L'application n'utilise ni cookie, ni `localStorage`, ni `sessionStorage`, ni IndexedDB (vérifié par `tests/e2e/network.spec.ts`). La liste de noms et les fichiers déposés sont perdus au rechargement de la page.

L'exception : lorsque la détection par IA est activée, **les poids du modèle** sont mis en cache par transformers.js (Cache API du navigateur), pour ne pas être retéléchargés à chaque visite. Ce cache ne contient que des fichiers publics du modèle, jamais de données de l'utilisateur. Il peut être vidé depuis les réglages du navigateur (données du site).

## Ce qui transite sur le réseau

| Quand                                      | Vers                                    | Quoi                                                                                                                                                     | Données utilisateur |
| ------------------------------------------ | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Ouverture de la page                       | GitHub Pages                            | HTML, JavaScript, CSS, fichiers WASM (runtime ONNX, pdf.js) de l'application                                                                             | aucune              |
| Première activation de la détection par IA | `huggingface.co` et son CDN (`*.hf.co`) | requêtes `GET` sans corps pour le tokeniseur, la configuration et les poids quantifiés du modèle `Xenova/bert-base-multilingual-cased-ner-hrl` (~181 Mo) | aucune              |
| Activations suivantes                      | `huggingface.co`                        | requêtes de vérification du cache (`GET`)                                                                                                                | aucune              |

Le runtime ONNX (WASM) est servi par l'application elle-même, et non par un CDN tiers. Le test nightly `tests/e2e/ner.slow.spec.ts` vérifie que, pendant une anonymisation avec détection par IA, seules des requêtes `GET` sans corps vers les hôtes du Hub Hugging Face quittent le navigateur.

Comme toute requête HTTP, le téléchargement du modèle révèle à Hugging Face l'adresse IP du poste et le fait que le modèle est utilisé ; il ne révèle rien des documents traités.

## Ce que produit l'outil

- Le **document anonymisé** reste une donnée personnelle au sens du RGPD (pseudonymisation, pas anonymisation) : la détection n'est pas exhaustive et le contexte peut suffire à réidentifier.
- Le **mapping** contient les valeurs d'origine en clair : il ne doit jamais être transmis.
- Le **rapport** ne contient aucune valeur d'origine : ses extraits de contexte sont pris dans le texte anonymisé.
