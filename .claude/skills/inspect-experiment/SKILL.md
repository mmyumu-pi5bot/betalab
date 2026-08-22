---
name: inspect-experiment
description: "Inspect a persisted betalab experiment and report its quality chain — grind homogeneity, sub-sampling representativeness, QuEChERS extraction, matrix suppression, and measured recovery against the calibration standard. Use when: 'inspecte la dernière experiment', 'donne les scores qualité', 'inspect experiment', 'why is my recovery low', 'analyse ce run LC-MS/MS', '/inspect-experiment'"
user-invocable: true
allowed-tools: Bash, Read
---

# Inspect Experiment — Quality Chain Report

Reads an experiment snapshot straight from the sqlite store and reconstructs every
quality factor between the orchard lot and the detector. Read-only: it never calls
the API and never writes to the database.

## Command

```bash
uv run --directory backend python ../.claude/skills/inspect-experiment/scripts/inspect_experiment.py [OPTIONS]
```

Run it from the repository root. `--directory backend` is what makes `app.*`
importable — the script imports the simulation constants and the hidden reference
transition catalog rather than re-hardcoding them, so the report always reflects
the current model. That flag also moves the working directory into `backend/`,
which is why the script path is prefixed with `../` and why `--db` defaults are
relative to `backend/`.

| Option | Effect |
|---|---|
| *(none)* | inspect the most recently updated experiment |
| `--list` | list stored experiments (id, updated_at, status, run count, name) and exit |
| `--experiment <id>` | inspect a specific experiment |
| `--db <path>` | point at another snapshot (default `data/experiments.sqlite3`, relative to `backend/`) |

## Arguments

- `/inspect-experiment` — latest experiment
- `/inspect-experiment list` — run `--list` and show the table only
- `/inspect-experiment <experiment_id>` — that experiment
- Anything else (a name fragment, "celle d'hier") — run `--list` first, pick the
  matching id, then inspect it.

## What the report contains

1. **Experiment** — id, name, status, audit entry count, sequence runs.
2. **Grinding / homogeneity** — per material state: `homogeneity_score`,
   `grind_quality_label`, mean grinding temperature (integral ÷ elapsed), worst
   pesticide degradation factor. The scale printed underneath comes from
   `PhysicalSimulationService`.
3. **QuEChERS extraction** — per tube: phase, cementation progress against the
   15 s window, separation, thermal degradation, `ε_manip`, ISTD phase, faults.
4. **Produce fractions / cleanliness** — mass, absolute and per-gram impurity,
   contaminated/mixed flags.
5. **Injection contexts / matrix suppression** — nominal vs true mass and volume,
   matrix load in g/mL, then per compound the reference retention time, the
   suppression factor at that time, and the recovery to expect from
   `suppression × ε_manip × representativeness`.
6. **Sequence runs** — every transition trace integrated: peak height, area, S/N,
   observed peak time vs the retention time the method declares.
7. **Recovery** — sample injection quantified against the calibration injection of
   the same run, compared to the true residue levels, with the delta against the
   expected recovery. A delta within a few points means the physical model behaved;
   a large one means something else happened.
8. **Discarded** — tubes in the trash with their faults and the sample mass lost.
9. **Findings** — the anomalies detected, listed at the end.

## Reading the results

- **Recovery close to expected** — the loss is matrix suppression and manipulation,
  not a mistake. Recovering it needs dilution or matrix-matched calibration, not a
  cleaner technique.
- **`ε_manip` ≠ `istd_manip`** — the ISTD was added at `post_salts`, so it got an
  independent draw and the ratio no longer corrects the extraction loss.
- **Calibration ISTD channel at noise level** — the standard was never spiked with
  internal standard, so nothing can be ISTD-corrected across the two injections and
  matrix suppression stays in the final result. The fix is on the bench: pipette the
  ISTD solution into the calibration vial too, as the tutorial now instructs.

## Reporting to the user

Summarise the script output — do not paste it whole. The trace tables run to 25
rows per injection; quote only the compounds that carry signal. Keep the recovery
table, the quality chain figures, and the findings. Answer in the user's language.

When a finding points at simulation code rather than at the operator's technique,
say so explicitly and name the file and function — the two are easy to confuse and
only one of them is a bug.
