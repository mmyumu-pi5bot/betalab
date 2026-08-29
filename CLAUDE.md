# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Betalab is a web-based simulation prototype for LC-MS/MS chromatography laboratory workflows (pesticide analysis). Users prepare flasks, transfer preparations into vials, place vials in an autosampler rack, run simulated sequences, and visualize results by transitions.

## Commands

**Backend** (`cd backend` first):
```bash
uv sync                                                         # install/update deps
uv run uvicorn app.main:app --reload                           # run API locally
uv run pytest                                                   # run tests
uv run pytest --cov=app --cov-report=term-missing tests        # tests with coverage
uv run pytest tests/test_foo.py::test_bar                      # run single test
```

**Frontend** (`cd frontend` first):
```bash
pnpm install       # install deps
pnpm dev           # dev server
pnpm build         # production build check
pnpm test          # unit tests (vitest)
pnpm test:e2e      # e2e tests (playwright)
pnpm test:coverage # coverage report
```

## Architecture

Two independent apps:
- `backend/`: FastAPI simulation API + LC-MS/MS domain logic
- `frontend/`: Next.js 15 / React 19 lab workbench UI

### Backend Layers

```
HTTP Request → app/api/ (routes) → app/schemas/ (validation)
                                 → app/services/ (orchestration)
                                 → app/domain/models.py (entities)
```

- `app/domain/models.py` — canonical domain entities: `Experiment`, `Workbench`, `Rack`, `Workspace`, `Trash`, `ProduceLot`, `WorkbenchTool`
- `app/services/experiment_service.py` — main orchestration; `_advance_experiment_to_now()` is the authoritative simulation clock
- `app/services/physical_simulation_service.py` — time-based physics façade (container pressure, CO2 sublimation, thermal transfer, cryogenics); all new physical phenomena belong here
- `app/services/domain_services/` — specialized domain services (workbench, rack, workspace, trash, reception, gross_balance)
- `app/api/experiment_routes/` — modular HTTP route handlers

### Frontend

- `src/components/lab-scene.tsx` — main interactive lab UI and drag-and-drop orchestrator
- `src/types/` — TypeScript domain types shared across components
- `src/lib/` — API client and mock data
- API base URL configured via `NEXT_PUBLIC_API_BASE_URL`

**Schema sync rule:** When a field is added, renamed, or removed in a backend Pydantic schema, update both `frontend/src/types/workbench.ts` (TypeScript type, camelCase) and the corresponding `normalize*` function in `frontend/src/lib/api.ts` in the same change. There is no codegen — the mapping is manual and TypeScript will not catch a missing field. See AGENTS.md § Backend-Frontend Type Sync for the full rule.

### Key design rules (from AGENTS.md)

**State & commands:**
- GETs are pure — never mutate state, bump versions, or persist snapshots on read
- Schema serialization is pure — no side effects
- Commands are single-intention — one domain action only; chain in the service layer if needed
- Provenance is structured — use typed origin records, not free-form label strings, for logic

**Simulation:**
- `PhysicalSimulationService` is the single simulation façade
- Physical consequences (pressure buildup, bulging, pop) belong in simulation ticks, not in action handlers
- Persist intermediate physical state on domain entities (e.g. `internal_pressure_bar`, `trapped_co2_mass_g`)

**Drag-and-drop (sacred rule):** Provenance selects the command; compatibility is derived from entity kind + entity state only — never from where the entity comes from. `allowedDropTargets` must be identical for the same entity regardless of origin (`palette`, `workbench`, `rack`, `trash`, `basket`). Prefer one shared helper (e.g. `drag-behaviors.ts`) as the single source of truth.

**DnD matrices:** Every new draggable or droppable type requires a full cross-product test matrix update in the same change — no exceptions. Tests must cover highlighted targets during drag, `dragover` acceptance/rejection, final `drop`, and the backend command sent.

**Trash retention:** Trash retains discarded entities by default; do not bypass retention even when restore is not yet implemented.

**UI primitives:** Extract repeated visual patterns (count bubbles, badges) into shared components. For equipment cards, reduce widget/container width to save space — do not crop SVG viewBox unless removing empty illustration space specifically.

## Coding Style

- Python: `snake_case` modules/functions, 4-space indent, type-annotate explicitly (no postponed-annotation quirks)
- TypeScript/React: `PascalCase` components, `kebab-case` filenames, 2-space indent
- TDD is the default: write the failing test first, then implement

## Documentation to Read First

For product context: `docs/CHROMATO_V1_DIRECTION.md`, `docs/CHROMATO_GUI_CONCEPT.md`
For backend layering: `docs/BACKEND_ARCHITECTURE.md`

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **betalab** (5021 symbols, 19601 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## When Debugging

1. `gitnexus_query({query: "<error or symptom>"})` — find execution flows related to the issue
2. `gitnexus_context({name: "<suspect function>"})` — see all callers, callees, and process participation
3. `READ gitnexus://repo/betalab/process/{processName}` — trace the full execution flow step by step
4. For regressions: `gitnexus_detect_changes({scope: "compare", base_ref: "main"})` — see what your branch changed

## When Refactoring

- **Renaming**: MUST use `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` first. Review the preview — graph edits are safe, text_search edits need manual review. Then run with `dry_run: false`.
- **Extracting/Splitting**: MUST run `gitnexus_context({name: "target"})` to see all incoming/outgoing refs, then `gitnexus_impact({target: "target", direction: "upstream"})` to find all external callers before moving code.
- After any refactor: run `gitnexus_detect_changes({scope: "all"})` to verify only expected files changed.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Tools Quick Reference

| Tool | When to use | Command |
|------|-------------|---------|
| `query` | Find code by concept | `gitnexus_query({query: "auth validation"})` |
| `context` | 360-degree view of one symbol | `gitnexus_context({name: "validateUser"})` |
| `impact` | Blast radius before editing | `gitnexus_impact({target: "X", direction: "upstream"})` |
| `detect_changes` | Pre-commit scope check | `gitnexus_detect_changes({scope: "staged"})` |
| `rename` | Safe multi-file rename | `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` |
| `cypher` | Custom graph queries | `gitnexus_cypher({query: "MATCH ..."})` |

## Impact Risk Levels

| Depth | Meaning | Action |
|-------|---------|--------|
| d=1 | WILL BREAK — direct callers/importers | MUST update these |
| d=2 | LIKELY AFFECTED — indirect deps | Should test |
| d=3 | MAY NEED TESTING — transitive | Test if critical path |

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/betalab/context` | Codebase overview, check index freshness |
| `gitnexus://repo/betalab/clusters` | All functional areas |
| `gitnexus://repo/betalab/processes` | All execution flows |
| `gitnexus://repo/betalab/process/{name}` | Step-by-step execution trace |

## Self-Check Before Finishing

Before completing any code modification task, verify:
1. `gitnexus_impact` was run for all modified symbols
2. No HIGH/CRITICAL risk warnings were ignored
3. `gitnexus_detect_changes()` confirms changes match expected scope
4. All d=1 (WILL BREAK) dependents were updated

## Keeping the Index Fresh

After committing code changes, the GitNexus index becomes stale. Re-run analyze to update it:

```bash
npx gitnexus analyze
```

If the index previously included embeddings, preserve them by adding `--embeddings`:

```bash
npx gitnexus analyze --embeddings
```

To check whether embeddings exist, inspect `.gitnexus/meta.json` — the `stats.embeddings` field shows the count (0 means no embeddings). **Running analyze without `--embeddings` will delete any previously generated embeddings.**

> Claude Code users: A PostToolUse hook handles this automatically after `git commit` and `git merge`.

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
