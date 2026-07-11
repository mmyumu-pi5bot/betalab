---
name: quality
description: "Run all configured quality tools (lint, typecheck, tests, dead code) for both backend and frontend, then produce a structured report. Use when: 'run quality checks', 'passe les outils qualité', 'check code quality', 'run all tools', '/quality'"
user-invocable: true
allowed-tools: Bash
---

# Quality Check — Full Report

Run **all** configured quality tools for the betalab project and produce a structured report.

## Tools inventory

### Backend (`cd backend`)
| Command | Role |
|---------|------|
| `uv run ruff check app tests` | Lint (pyflakes, isort, bugbear, pyupgrade…) |
| `uv run ruff format --check app tests` | Format check |
| `uv run pyright` | Static type checking |
| `uvx bandit -r app` | Security scan (OWASP-style) |
| `uv run pytest --cov=app --cov-report=term-missing tests` | Tests + coverage |

### Frontend (`cd frontend`)
| Command | Role |
|---------|------|
| `pnpm build` | TypeScript type check + ESLint (via Next.js) |
| `pnpm test` | Unit tests (vitest) |
| `pnpm knip` | Dead code / unused exports |
| `pnpm test:e2e` | End-to-end tests (Playwright) — slow, starts backend |

> **Note:** `bandit` est disponible via `uvx` (pas de dépendance déclarée dans `pyproject.toml` — il est téléchargé à la volée par uv).

## Execution instructions

1. Launch **all** backend tools in parallel as background Bash jobs
2. Launch **all** frontend tools (except `test:e2e`) in parallel as background Bash jobs
3. Launch `test:e2e` in parallel with the above (it's slow, start it early)
4. Wait for all jobs to complete, reading each output file
5. Produce the report

Use `run_in_background: true` on each Bash call, then read all outputs at once.

## Arguments

- `/quality` — runs everything including e2e
- `/quality fast` — skips `pnpm test:e2e` only (lint + types + unit tests frontend + all backend including pytest)
- `/quality fix` — runs everything, then auto-fixes what can be fixed (`ruff format app tests`, `ruff check --fix app tests`)

## Report format

Produce a report with this structure:

```
## Rapport qualité

### Backend
| Outil | Résultat |
...

Couverture : XX%

### Frontend
| Outil | Résultat |
...

### Points à traiter
- ❌ Errors (must fix)
- ⚠️ Warnings (should fix)

### Pré-existants (non liés aux changements récents)
- ...
```

Rules:
- ✅ = clean pass, ❌ = errors/failures, ⚠️ = warnings only
- For failures: quote the specific error lines, not the full output
- Coverage: show backend % and frontend `src/` % separately (exclude `.next/` artifacts from frontend coverage)
- If a failure looks pre-existing, verify with `git stash && <command> && git stash pop` before flagging it as pre-existing
- End with a one-line verdict: **Tout est propre** or **X problème(s) à corriger**
