# Idées (non implémentées)

Pistes notées pendant le développement. Hors périmètre du prompt : rien ici n'est implémenté sans décision explicite.

- **Étiquette `MISC` des modèles spaCy FR/DE** (spike 0.2) : ces modèles classent parfois un prénom isolé (« Sabine ») ou un groupe contenant un lieu (« Vertrag in Hamburg ») en `MISC`, type non retenu, ce qui laisse la donnée en clair. On pourrait faire signaler les entités `MISC` par `check`, ou les retenir avec une lettre dédiée. Voir `docs/DEVIATIONS.md`, section Benchmarks.
