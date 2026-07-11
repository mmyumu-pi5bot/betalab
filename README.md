# Betalab

Betalab est un prototype de simulation web oriente chromatographie LC-MS/MS.

L'objectif de la V1 est de permettre a un utilisateur de:

- preparer des fioles de `Std 1`, `Std 2` et `Sample`
- transferer ces preparations dans des vials
- placer les vials dans un rack autosampler
- lancer une sequence de runs simules
- visualiser des resultats simplifies par transitions

## Architecture

Le projet est volontairement separe en deux applications.

- `frontend/`: interface utilisateur en `Next.js`
- `backend/`: moteur de simulation et API en `FastAPI`

Cette separation permet de:

- garder la logique metier dans un backend Python
- changer l'interface sans jeter le moteur
- preparer une evolution vers des exports de donnees plus riches

## Etat Du Repo

Le repo contient actuellement:

- un squelette `FastAPI` avec un moteur d'experiments en memoire
- un squelette `Next.js` avec une premiere GUI statique basee sur l'etat attendu
- de la documentation produit et architecture

Ce n'est pas encore une application executable sans installer les dependances.

## Approche De Dev

Le projet suit maintenant une approche TDD pour les nouvelles features:

- ecriture du test en premier
- implementation ensuite
- verification via tests unitaires au fur et a mesure

Le code deja pose avant cette decision est progressivement couvert par des tests de caracterisation dans `backend/tests/`.

## Documents

Documents a lire en priorite:

- [CHROMATO_V1_DIRECTION.md](./docs/CHROMATO_V1_DIRECTION.md)
- [CHROMATO_GUI_CONCEPT.md](./docs/CHROMATO_GUI_CONCEPT.md)

Le document [LAB_SIMULATION_BLUEPRINT.md](./docs/LAB_SIMULATION_BLUEPRINT.md) reste utile comme point de depart, mais il n'est plus le cadrage principal du projet.

## Backend

Le backend expose une API simple orientee experiment:

- `POST /experiments`
- `GET /experiments/{experiment_id}`
- `POST /experiments/{experiment_id}/commands`

Les commandes metier prevues pour la V1 sont:

- `create_flask`
- `add_liquid`
- `transfer_to_vial`
- `place_vial_in_rack`
- `run_sequence`

## Frontend

Le frontend est pense comme une GUI de poste de travail:

- paillasse de preparation
- fioles et vials
- rack autosampler
- panneau de resultats

## Demarrage Prevu

Quand les dependances seront installees:

### Backend

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

Tests backend:

```bash
cd backend
uv run pytest
```

### Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

Notes de dev frontend:

- `pnpm dev` est le serveur de reference pour le frontend local et pour les tests E2E.
- Le serveur local utilise `.next-dev`, les tests E2E `.next-e2e`, et le build de production `.next`. Cette isolation evite qu'un build ou un test E2E corrompe le cache du live reload.
- Les tests E2E reutilisent toujours un serveur deja disponible sur leur port local.
- Pour reinitialiser exceptionnellement tous les caches Next.js: `pnpm clean:next`.

## Prochaines Etapes

1. Brancher le frontend sur l'API backend
2. Rendre les commandes metier interactives
3. Enrichir la simulation des transitions et chromatogrammes
4. Introduire des scenarios de matrice et de solvants
