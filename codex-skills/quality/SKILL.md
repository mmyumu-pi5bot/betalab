---
name: quality
description: Run the project's configured quality checks across backend and frontend, then return a concise structured report with failures, warnings, and likely pre-existing issues. Use when the user asks to run quality checks, lint, typecheck, tests, dead code checks, or "/quality".
---

# Quality

Run the betalab quality toolchain and summarize the result clearly.

## Scope

Backend commands run from `backend/`:

- `uv run ruff check app tests`
- `uv run ruff format --check app tests`
- `uv run pyright`
- `uvx bandit -r app`
- `uv run pytest --cov=app --cov-report=term-missing tests`

Frontend commands run from `frontend/`:

- `pnpm build`
- `pnpm test`
- `pnpm knip`
- `pnpm test:e2e`

## Modes

- Full: run everything, including `pnpm test:e2e`
- Fast: skip only `pnpm test:e2e`
- Fix: after reporting failures, optionally run safe autofixes for backend only:
  - `uv run ruff format app tests`
  - `uv run ruff check --fix app tests`

If the user says `/quality`, assume full mode.
If the user says `/quality fast`, skip e2e.
If the user says `/quality fix`, run full mode first, then safe backend autofixes if needed.

## Execution

1. Confirm which mode applies.
2. Run independent checks in parallel when possible.
3. Keep backend and frontend commands in their own working directories.
4. If a command fails because dependencies are missing or sandbox/network prevents execution, say so explicitly.
5. Do not use `git stash`, `git reset`, or similar cleanup to classify failures.
6. Treat “pre-existing” as an inference only when supported by unchanged files, unrelated paths, or obvious historical breakage.

## Reporting

Return a concise report with:

- `Backend`
- `Frontend`
- `Points à traiter`
- `Pré-existants probables`
- Final verdict

For each tool:

- `✅` pass
- `❌` failure
- `⚠️` warning / partial / not run

For failures:

- quote only the most relevant error lines
- say which command failed
- distinguish execution failure from code failure

For coverage:

- report backend coverage percentage when pytest coverage ran

## Output shape

Use a compact structure like:

```md
## Rapport qualité

### Backend
- `uv run ruff check app tests` — ✅
- `uv run pyright` — ❌
  - `app/...:123: error: ...`

Couverture backend : 87%

### Frontend
- `pnpm build` — ✅
- `pnpm knip` — ⚠️ non exécuté

### Points à traiter
- `pyright`: ...

### Pré-existants probables
- ...

Verdict : 2 problème(s) à corriger
```

## Notes

- Prefer `multi_tool_use.parallel` for independent commands.
- Keep the summary factual and short.
- If all checks pass, end with `Verdict : tout est propre`.
