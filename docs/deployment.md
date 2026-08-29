# Deployment

## Vue d'ensemble

Le packaging minimal de Betalab repose sur:

- un conteneur `backend` FastAPI
- un conteneur `frontend` Next.js
- un volume Docker pour la base SQLite
- un Nginx externe au projet qui reverse-proxy vers `127.0.0.1:3000` et `127.0.0.1:8000`

Ce document ne couvre pas la configuration de ce Nginx externe.

## Fichiers

- `backend/Dockerfile`
- `frontend/Dockerfile`
- `compose.yml`
- `.env.example`

## Configuration

Copier `.env.example` vers `.env` puis adapter la valeur:

```env
BETALAB_BACKEND_IMAGE=registry.mmyumu.fr/betalab-backend:1.0.0
BETALAB_FRONTEND_IMAGE=registry.mmyumu.fr/betalab-frontend:1.0.0
NEXT_PUBLIC_API_BASE_URL=https://ton-domaine/api
BETALAB_CORS_ALLOWED_ORIGINS=https://ton-domaine
```

Le backend stocke ses expériences dans le volume Docker `betalab_backend_data` via:

```env
BETALAB_EXPERIMENTS_DB_PATH=/data/experiments.sqlite3
```

Les origines CORS autorisées du backend se configurent via:

```env
BETALAB_CORS_ALLOWED_ORIGINS=https://ton-domaine
```

Plusieurs origines peuvent être fournies sous forme CSV si nécessaire.

## Build, push et lancement

Depuis la racine du repo:

```bash
docker compose build
docker compose push
```

Puis sur le VPS:

```bash
docker compose pull
docker compose up -d
```

Services accessibles localement sur le VPS une fois lancés:

- frontend: `http://127.0.0.1:3000`
- backend: `http://127.0.0.1:8000`
- healthcheck backend: `http://127.0.0.1:8000/health`

## Notes

- Le frontend embarque `NEXT_PUBLIC_API_BASE_URL` au moment du build.
- `docker compose build` lit automatiquement les variables de `.env`.
- `docker compose push` pousse les tags définis par `BETALAB_BACKEND_IMAGE` et `BETALAB_FRONTEND_IMAGE`.
- Le flux WebSocket backend passe par `/experiments/{experiment_id}/stream`; le reverse proxy devra supporter l'upgrade WebSocket.
- En production, définir `BETALAB_CORS_ALLOWED_ORIGINS` sur le domaine réel du frontend.
