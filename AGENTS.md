# Repository Guidelines

## Project Structure & Module Organization

This repository is split into two apps plus project docs:

- `backend/`: FastAPI simulation API and LC-MS/MS domain logic.
- `backend/app/domain/`: core simulation models.
- `backend/app/services/`: experiment orchestration and signal generation.
- `backend/app/api/`: HTTP routes.
- `backend/tests/`: backend unit tests.
- `frontend/`: Next.js UI for the lab workbench.
- `frontend/src/components/`: UI building blocks.
- `frontend/src/lib/`: API client and mock data.
- `frontend/src/types/`: shared frontend types.
- `docs/`: architecture notes.

Top-level `.md` files describe product direction; read `README.md`, `docs/CHROMATO_V1_DIRECTION.md`, and `docs/CHROMATO_GUI_CONCEPT.md` first. For backend layering and request flow, read `docs/BACKEND_ARCHITECTURE.md`.

## Build, Test, and Development Commands

Backend:

- `cd backend && uv sync`: create/update the backend environment with default dev dependencies.
- `cd backend && uv run uvicorn app.main:app --reload`: run the API locally.
- `cd backend && uv run pytest`: run backend unit tests.
- `cd backend && uv run pytest --cov=app --cov-report=term-missing tests`: run tests with coverage.

Frontend:

- `cd frontend && pnpm install`: install frontend deps.
- `cd frontend && pnpm dev`: start the Next.js dev server.
- `cd frontend && pnpm build`: production build check.

## Coding Style & Naming Conventions

Use TypeScript for frontend code and Python 3.11+ for backend code. Prefer 2-space indentation in frontend files and 4 spaces in Python. Use `snake_case` for Python modules/functions, `PascalCase` for React components, and `kebab-case` for component filenames (for example `flask-card.tsx`). Keep domain logic out of React components; put workflow orchestration in `backend/app/services/`, domain concepts in `backend/app/domain/`, and API contracts in `backend/app/schemas/`.

### Backend State And Command Design

- Treat reads as pure by default. A `GET` or read-oriented service method must not mutate domain state, increment versions, append audit logs, or persist snapshots unless a real simulation advance or explicit write action occurred.
- Keep serialization pure. Converting a domain object to an API schema must not have side effects such as bumping `snapshot_version`, clearing tickets, or updating timestamps.
- Separate simulation advance from persistence. Advancing elapsed time may mutate the in-memory experiment, but persisting that advance should happen in one explicit write path rather than as a hidden side effect of schema conversion.
- Keep commands single-intention. A command handler should do one domain action only; it must not silently recreate adjacent state, reset other subsystems, or perform convenience orchestration under the same name.
- If the UI needs a “smart” action that chains several domain steps, put that orchestration in the service layer, not inside a low-level command handler.
- Provenance is a first-class domain concept, not just display text. When an entity is moved, discarded, or restored, preserve a structured origin record and derive human-readable labels from that record.
- Do not use free-form `origin_label` strings as the source of truth for workflow decisions. Use structured provenance for logic, and keep labels as presentation only.
- When the same entity can be removed from several storage locations, implement one canonical remove path and reuse it for move, discard, and restore flows. Do not maintain parallel removal logic for the same entity kind.
- When a summary view such as the experiments home page only needs metadata, do not rebuild or fully validate the entire persisted snapshot just to render that list. Persist and read a denormalized summary instead.
- Name collections after their real domain role, not after an implementation convenience. If a collection behaves like basket inventory, staging inventory, or trash retention, its name and helpers should reflect that role clearly.
- Prefer small shared helpers for repeated move patterns such as “take entity from source”, “place entity on target”, and “recompute derived state”. Do not copy/paste near-identical move flows across handlers.
- Any handler that changes a container or widget with derived state must update that derived state through one shared helper, not by reimplementing the recomputation ad hoc in each command.
- Do not leave compatibility shims or transitional aliases in the codebase unless they are part of an explicit migration plan with a near-term removal step. If a rename or architectural merge is complete, remove the old alias instead of preserving both names.
- Avoid “works by accident” Python patterns. Import annotated types explicitly, remove dead tokens and stale compatibility shims once replaced, and prefer code that is valid without relying on postponed-annotation quirks.

### Physical Simulation Architecture

- Treat time-based lab physics as a single backend subsystem rooted in `PhysicalSimulationService`.
- `PhysicalSimulationService` is the public simulation façade. Keep specialized logic as internal blocks or helpers such as cryogenics, container pressure, evaporation, or thermal transfer instead of creating parallel top-level services too early.
- The authoritative simulation clock is `ExperimentService._advance_experiment_to_now()`.
- Time-based physical consequences must advance from ticks triggered by `_advance_experiment_to_now()`, which currently runs continuously while a websocket client is connected and catches up elapsed time on the next read if no client was connected.
- Action handlers such as `close_workbench_tool` or `open_workbench_tool` may change the configuration state of entities, but they should not hardcode delayed physical outcomes that belong to the ticked simulation.
- In practice: `close` should mark a container sealed, and pressure buildup / bulging / pop should be computed by simulation ticks, not decided immediately inside the close handler.
- Persist intermediate physical state on domain entities when needed. Example: a sealed container may carry `internal_pressure_bar` and `trapped_co2_mass_g` so the next tick or open action can continue from the current physical state.
- When adding a new physical phenomenon, prefer extending `PhysicalSimulationService` and the tick path before adding ad hoc event-only checks in command handlers.

### Reusable UI Primitives

- When the same visual pattern appears in multiple widgets or panels, extract it into a shared component instead of copying Tailwind class strings.
- This applies especially to small status affordances such as count bubbles, badges, chips, and markers.
- If multiple components show a count of contained entities, they must use the same shared primitive unless the user explicitly asks for a distinct visual treatment.
- Prefer a neutral reusable primitive first, then compose positioning outside the primitive with `className`.

### Equipment Widget Layout

- For equipment cards, distinguish clearly between the illustration itself, the illustration frame, and the outer widget width.
- If the goal is to make an equipment card take less horizontal space, prefer reducing the widget/container width first. Do not assume that changing the SVG `viewBox` or trimming the illustration canvas will make the card more compact; that often just zooms the illustration inside the same card.
- Only recrop an illustration when the goal is specifically to remove empty space inside the illustration frame. When doing that, verify that rounded surface corners still render correctly after the crop.
- When multiple equipment widgets should feel visually aligned, prefer converging them on the same shared widget structure and width logic rather than stacking one-off padding and margin fixes.

## Backend-Frontend Type Sync

The backend and frontend maintain separate data models connected by JSON over HTTP. There is no codegen — the mapping is manual. This means **every schema change in the backend requires two frontend updates in the same commit**.

When you add, rename, or remove a field in a Pydantic schema (`backend/app/schemas/`):

1. **`frontend/src/types/workbench.ts`** — add/update the TypeScript type. Use camelCase (`internalPressureBar`, not `internal_pressure_bar`).
2. **`frontend/src/lib/api.ts`** — add/update the field in the corresponding `normalize*` function. Follow the existing pattern that accepts both forms:
   ```typescript
   internalPressureBar: Number(tool.internalPressureBar ?? tool.internal_pressure_bar ?? 1.0),
   ```
   The fallback default must match the Pydantic field default.

If you only update one of these two files, the field silently disappears or stays stale on the frontend — TypeScript will not warn you.

The affected `normalize*` functions are at the top of `frontend/src/lib/api.ts`. The most common ones are `normalizeBenchTool`, `normalizeWorkspaceWidget`, `normalizeProduceLot`, `normalizeRackSlot`.

## Testing Guidelines

TDD is the default workflow: write the failing test first, then implement. Backend tests use `pytest`; name files `test_*.py` and test functions `test_*`. Keep coverage at or above the current backend baseline and add coverage for API routes when features touch HTTP behavior.

### Trash Retention

- Treat trash as retaining discarded entities by default.
- If a discarded entity is sent to trash, preserve a reference to it in the trash state unless the user explicitly asks for permanent deletion or non-retention for that entity.
- Do not assume some entity types should bypass trash just because restore is not implemented yet. Retention is still the default.

### Drag-and-Drop Invariants

- Sacred rule: provenance selects the command, never the compatibility.
- Drop compatibility must depend on the moved entity itself, not on where it comes from.
- Draggability must also depend on the entity itself, not on where it comes from.
- If the same concrete entity is visible in multiple origins (`palette`, `workbench`, `rack`, `trash`, `basket`), it should keep the same drag behavior and the same `allowedDropTargets` unless its own state has changed.
- The same entity must not gain or lose `allowedDropTargets` just because it is dragged from `palette`, `workbench`, `rack`, `trash`, or `basket`.
- If an entity can go to `trash_bin` from one origin, it must expose `trash_bin` as an allowed target from every other origin where that same entity can appear, unless an explicit entity-state change justifies the difference.
- Do not model drag/drop compatibility around UI flows such as "create from palette", "move from workbench", or "restore from trash". Model compatibility once from entity kind plus entity state, then reuse it everywhere.
- Trash is not a special behavioral state by default. Sending an entity to trash must not silently remove drag/drop compatibility if that entity is still present in the UI.
- Differences in drag/drop compatibility must come from explicit entity state, not from provenance alone. Example: a produce lot may gain different targets once it is ground, extracted, sealed, consumed, or otherwise transformed.
- In practice, `allowedDropTargets` should be derived from the entity kind / tool type, then reused everywhere (`palette`, `workbench`, `rack`, `trash`).
- When richer workflow states are introduced, derive `allowedDropTargets` from entity kind plus entity state, then reuse that result everywhere.
- Source information is still needed, but only to choose the backend command at drop time (`create`, `move`, `restore`).
- Do not duplicate drag compatibility rules in multiple UI components. Prefer one shared helper as the source of truth.
- Every time a new draggable component or drop target is added, add or update a dedicated DnD matrix suite.
- That matrix must test the new component as a drag source against every existing drop target type.
- That matrix must also test the new component as a drop target receiving every existing draggable source type that can appear in the UI.
- In practice, treat this as a cross-product requirement: every concrete draggable UI component must be exercised against every compatible or incompatible concrete drop component that can coexist in the UI.
- Do not stop at one representative item per behavior group if multiple concrete palette items, rack entries, trash entries, or widget variants are visible in the product.
- Do not rely on representative behavior groups alone when a concrete component exists in the UI. If the UI exposes a distinct draggable component, it must appear explicitly in the DnD matrix.
- When adding a new draggable entity, explicitly test the full origin-to-target matrix that matters for that entity. For example, if a `sample_vial` can go to the rack, cover at least `palette -> rack`, `workbench -> rack`, and `trash -> rack`.
- If a new origin is added for an existing entity, update the matrix so that the entity is tested from that origin against every relevant target, with the same compatibility expectations unless entity state intentionally differs.
- Every time a new draggable object type is created, the DnD matrices must be updated in the same change.
- Every time a new droppable object type or drop surface is created, the DnD matrices must be updated in the same change.
- Do not merge a new draggable or droppable type without explicitly adding its full cross-product coverage against all existing relevant targets or sources.
- The expected outcome for each concrete draggable-to-droppable pair must be written down as an explicit boolean decision in the matrix: allowed or rejected. Do not leave new pairs implicit, untested, or covered only by representative cases.
- This requirement applies to both frontend and backend whenever both layers participate in the DnD behavior. Frontend must assert the advertised compatibility and command routing; backend must assert the actual acceptance or rejection of the corresponding drop command.
- When a DnD behavior changes for an existing object, update the matrices in the same change. Do not change compatibility logic without changing the expected matrix entries and the related assertions.
- When an object gains a new state that can affect drag/drop behavior, update the matrices for that state in the same change. State-specific compatibility is part of the DnD contract.
- Treat missing matrix updates as a bug in the change itself, not as optional follow-up cleanup.
- Drag-and-drop tests should verify all of these when relevant:
  - highlighted targets during drag
  - `dragover` acceptance / rejection
  - final `drop`
  - the backend command that was sent

### Drag-and-Drop Target Architecture

- This section describes the target architecture to converge toward. It is not a claim that the current codebase is already fully structured this way.
- Treat drag-and-drop as a first-class cross-cutting system, not as ad hoc UI glue inside individual React components.
- As the product grows, assume that many or most visible lab entities will become draggable.
- Each draggable entity kind should eventually expose one shared drag behavior contract.
- Prefer a TypeScript interface plus pure functions or adapters over a React-side class hierarchy.
- The intended shape is a single central drag behavior layer that can answer at least:
  - what the entity kind is
  - whether the entity is draggable in its current state
  - which `allowedDropTargets` it exposes
  - how to build its `DragDescriptor`
- Derive drag behavior from entity kind plus entity state, not from the UI location where the entity is rendered.
- Keep provenance in the drag data, but only so the drop layer can choose the backend command (`create`, `move`, `restore`, `discard`, etc.).
- React components should not each reinvent drag logic for the same entity kind. Components should ask the shared drag behavior layer for drag specs and descriptors.
- When a new draggable entity is introduced, add it to the shared drag behavior layer before or alongside wiring its UI component.
- When a domain entity gains a new workflow state such as ground, extracted, sealed, labeled, consumed, or similar, update the shared drag behavior derivation for that entity-state combination.
- Prefer one central function or module such as `getEntityDragSpec(...)` or `drag-behaviors.ts` over many scattered per-component conditionals.
- The long-term direction is:
  - shared drag behavior resolves compatibility and draggability
  - shared descriptor builder serializes drag state
  - drop handlers map provenance plus target to the backend command

## Commit & Pull Request Guidelines

Git history is minimal (`first commit`), so use short imperative commit messages, for example `Add rack placement command`. Keep commits focused. PRs should include:

- a short problem/solution summary
- test evidence (`pytest` or coverage output)
- screenshots for frontend changes
- linked issue or task when available

## Security & Configuration Tips

Do not commit secrets, `.env` files, or generated artifacts from `.venv/`, `.coverage`, `.next/`, or `node_modules/`. Use `NEXT_PUBLIC_API_BASE_URL` for frontend API configuration.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **betalab** (2974 symbols, 11614 relationships, 249 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

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
