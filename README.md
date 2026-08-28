# Betalab

Betalab is a web-based simulation prototype focused on LC-MS/MS chromatography.

The goal of V1 is to let a user:

- prepare `Std 1`, `Std 2` and `Sample` flasks
- transfer those preparations into vials
- place the vials in an autosampler rack
- run a sequence of simulated runs
- visualize simplified results by transitions

## Architecture

The project is deliberately split into two applications.

- `frontend/`: user interface built with `Next.js`
- `backend/`: simulation engine and API built with `FastAPI`

This separation makes it possible to:

- keep the business logic in a Python backend
- change the interface without throwing away the engine
- prepare for richer data exports down the line

## Repo Status

The repo currently contains:

- a `FastAPI` skeleton with an in-memory experiment engine
- a `Next.js` skeleton with a first static GUI based on the expected state
- product and architecture documentation

It is not yet an application you can run without installing the dependencies.

## Development Approach

The project now follows a TDD approach for new features:

- write the test first
- implement afterwards
- verify through unit tests as you go

Code written before this decision is progressively covered by characterization tests in `backend/tests/`.

## Documents

Documents to read first:

- [CHROMATO_V1_DIRECTION.md](./docs/CHROMATO_V1_DIRECTION.md)
- [CHROMATO_GUI_CONCEPT.md](./docs/CHROMATO_GUI_CONCEPT.md)

The [LAB_SIMULATION_BLUEPRINT.md](./docs/LAB_SIMULATION_BLUEPRINT.md) document is still useful as a starting point, but it is no longer the project's main framing.

## Backend

The backend exposes a simple experiment-oriented API:

- `POST /experiments`
- `GET /experiments/{experiment_id}`
- `POST /experiments/{experiment_id}/commands`

The business commands planned for V1 are:

- `create_flask`
- `add_liquid`
- `transfer_to_vial`
- `place_vial_in_rack`
- `run_sequence`

## Frontend

The frontend is designed as a lab workbench GUI:

- preparation bench
- flasks and vials
- autosampler rack
- results panel

## Planned Startup

Once the dependencies are installed:

### Backend

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

Backend tests:

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

Frontend dev notes:

- `pnpm dev` is the reference server for both the local frontend and the E2E tests.
- The local server uses `.next-dev`, the E2E tests use `.next-e2e`, and the production build uses `.next`. This isolation prevents a build or an E2E test from corrupting the live-reload cache.
- The E2E tests always reuse a server already available on their local port.
- To reset all Next.js caches in exceptional cases: `pnpm clean:next`.

## Next Steps

1. Wire the frontend to the backend API
2. Make the business commands interactive
3. Enrich the simulation of transitions and chromatograms
4. Introduce matrix and solvent scenarios
