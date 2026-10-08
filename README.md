# polyjuice

Application web statique qui pseudonymise des documents bureautiques (`.docx`, `.pptx`, `.xlsx`, `.pdf`, `.md`, `.txt`) avant leur envoi à un outil externe, puis restaure les données d'origine dans le document retourné.

**Tout le traitement se fait dans le navigateur.** Aucun fichier, aucun fragment de texte, aucun mapping ne quitte le poste de l'utilisateur.

> En construction : voir [`docs/PLAN.md`](docs/PLAN.md).

## Développement

```sh
npm ci
npm run dev        # serveur de développement
npm run check      # lint + typecheck + tests unitaires
npm run test:e2e   # tests Playwright
npm run build      # build statique dans dist/
```

## Licence

MIT
