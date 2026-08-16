"""Inspect a persisted betalab experiment and report its quality metrics.

Reads the sqlite snapshot directly (no HTTP, no mutation) and reconstructs the
whole quality chain: grind homogeneity -> sub-sampling representativeness ->
QuEChERS extraction -> matrix suppression -> measured recovery against the
calibration standard injected in the same sequence.

Run it from ``backend/`` so the simulation constants and the hidden reference
transition catalog can be imported:

    uv run python ../.claude/skills/inspect-experiment/scripts/inspect_experiment.py
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import statistics
from collections.abc import Iterator
from dataclasses import dataclass, field
from typing import Any

from app.services.domain_services.lcmsms import (
    INTERNAL_STANDARD_COMPOUND_ID,
    _reference_retention_time_s,
)
from app.services.physical_simulation_service import PhysicalSimulationService as Sim

#: The signal model computes ``pesticide_amount_ng = ug_per_kg * mass_g * 1e-3``
#: (lcmsms.py, _compute_sample_responses) while a calibration standard is built
#: straight in ng/mL. Sample and standard therefore sit 1000x apart on the same
#: sequence, and an external calibration only reads back the true residue level
#: once this factor is applied. Kept explicit so the report can flag it rather
#: than silently hide it.
EXTERNAL_CALIBRATION_UNIT_FACTOR = 1000.0

#: Below this, one weighed aliquot no longer represents the lot well enough for
#: the result to mean anything — the payoff of the cryogenic grinding chain.
LOW_HOMOGENEITY_THRESHOLD = 0.85
#: A calibration level further than this factor from the extract level makes the
#: quantification an extrapolation rather than an interpolation.
CALIBRATION_RANGE_FACTOR = 5.0


# --------------------------------------------------------------------------
# snapshot access
# --------------------------------------------------------------------------


def list_experiments(db_path: str) -> list[dict[str, Any]]:
    with sqlite3.connect(db_path) as connection:
        connection.row_factory = sqlite3.Row
        rows = connection.execute(
            """
            SELECT id, name, created_at, updated_at, status, run_count, material_count
            FROM experiments
            ORDER BY updated_at DESC
            """
        ).fetchall()
    return [dict(row) for row in rows]


def load_payload(db_path: str, experiment_id: str | None) -> tuple[str, dict[str, Any]]:
    with sqlite3.connect(db_path) as connection:
        if experiment_id is None:
            row = connection.execute("SELECT id, payload FROM experiments ORDER BY updated_at DESC LIMIT 1").fetchone()
        else:
            row = connection.execute("SELECT id, payload FROM experiments WHERE id = ?", (experiment_id,)).fetchone()
    if row is None:
        raise SystemExit(f"No experiment found for id={experiment_id!r} in {db_path}")
    return row[0], json.loads(row[1])


#: Entity ids are prefixed by their kind, and the prefix is already obvious from
#: the column the id sits in. Stripping it keeps the tables readable without
#: truncating a `produce_fraction_produce_<lot>_station_3` down to `tation_3`.
ID_PREFIXES = (
    "produce_material_state_",
    "produce_fraction_",
    "bench_liquid_",
    "bench_tool_",
    "produce_",
    "label_",
    "inj_",
    "seq_",
)


def short_id(entity_id: str) -> str:
    for prefix in ID_PREFIXES:
        if entity_id.startswith(prefix):
            return entity_id[len(prefix) :]
    return entity_id


def iter_tools(payload: dict[str, Any]) -> Iterator[tuple[str, dict[str, Any]]]:
    """Yield (location, tool) for every tool in the snapshot, wherever it sits."""
    for slot in payload.get("workbench", {}).get("slots", []):
        if slot.get("tool"):
            yield slot.get("label") or slot.get("id") or "workbench", slot["tool"]
    for slot in payload.get("rack", {}).get("slots", []):
        if slot.get("tool"):
            yield slot.get("label") or slot.get("id") or "rack", slot["tool"]
    for tool in payload.get("trash", {}).get("children", []):
        yield "trash", tool
    for tool in payload.get("basket_tools", []) or []:
        yield "basket", tool
    for widget in payload.get("workspace", {}).get("widgets", []):
        if widget.get("tool"):
            yield widget.get("label") or widget.get("widget_type") or "workspace", widget["tool"]


def find_tool(payload: dict[str, Any], tool_id: str) -> dict[str, Any] | None:
    for _, tool in iter_tools(payload):
        if tool.get("id") == tool_id:
            return tool
    return None


def iter_sequence_runs(payload: dict[str, Any]) -> Iterator[dict[str, Any]]:
    for widget in payload.get("workspace", {}).get("widgets", []):
        yield from widget.get("sequence_runs", []) or []


# --------------------------------------------------------------------------
# trace integration
# --------------------------------------------------------------------------


@dataclass
class PeakMetrics:
    compound_id: str
    role: str
    peak_height: float
    baseline: float
    area: float
    signal_to_noise: float
    peak_time_s: float
    declared_rt_s: float | None
    reference_rt_s: float | None
    in_declared_window: bool


def integrate_trace(trace: dict[str, Any]) -> PeakMetrics:
    """Integrate one transition trace around wherever its peak actually is.

    The window is centred on the observed maximum rather than on the retention
    time the method declares: a method pointing at the wrong moment is itself a
    finding, and centring on the declaration would hide it behind a noise-level
    area. ``in_declared_window`` carries that diagnostic instead.
    """
    transition = trace.get("transition", {})
    intensities: list[float] = trace["intensities"]
    times_s: list[float] = trace.get("times_s") or []
    if not times_s:
        interval = trace.get("acquisition", {}).get("sampling_interval_s", 1.0)
        times_s = [index * interval for index in range(len(intensities))]

    baseline = statistics.median(intensities)
    lower_half = sorted(intensities)[: max(2, len(intensities) // 2)]
    noise = statistics.pstdev(lower_half) or 1e-9

    peak_index = max(range(len(intensities)), key=lambda i: intensities[i])
    peak_height = intensities[peak_index]
    peak_time_s = times_s[peak_index]

    window_s = float(transition.get("retention_window_s") or 60.0)
    half_window = window_s / 2.0
    area = 0.0
    for time_s, intensity in zip(times_s, intensities, strict=False):
        if abs(time_s - peak_time_s) <= half_window:
            area += max(0.0, intensity - baseline)
    interval = trace.get("acquisition", {}).get("sampling_interval_s") or 1.0
    area *= interval

    declared_rt = transition.get("expected_retention_time_s")
    in_window = declared_rt is None or abs(peak_time_s - float(declared_rt)) <= half_window

    return PeakMetrics(
        compound_id=transition.get("compound_id", "?"),
        role=transition.get("role", "?"),
        peak_height=peak_height,
        baseline=baseline,
        area=area,
        signal_to_noise=(peak_height - baseline) / noise,
        peak_time_s=peak_time_s,
        declared_rt_s=float(declared_rt) if declared_rt is not None else None,
        reference_rt_s=_reference_retention_time_s(transition.get("compound_id", "")),
        in_declared_window=in_window,
    )


def quantifier_areas(injection: dict[str, Any]) -> dict[str, PeakMetrics]:
    metrics: dict[str, PeakMetrics] = {}
    for trace in injection.get("traces", []):
        peak = integrate_trace(trace)
        if peak.role == "quantifier":
            metrics[peak.compound_id] = peak
    return metrics


# --------------------------------------------------------------------------
# report sections
# --------------------------------------------------------------------------


@dataclass
class Report:
    lines: list[str] = field(default_factory=list)
    findings: list[str] = field(default_factory=list)

    def section(self, title: str) -> None:
        self.lines.append("")
        self.lines.append(f"## {title}")

    def line(self, text: str = "") -> None:
        self.lines.append(text)

    def finding(self, text: str) -> None:
        self.findings.append(text)

    def render(self) -> str:
        out = list(self.lines)
        out.append("")
        out.append("## Findings")
        if self.findings:
            out.extend(f"- {item}" for item in self.findings)
        else:
            out.append("- Nothing anomalous detected.")
        return "\n".join(out)


def report_header(report: Report, experiment_id: str, payload: dict[str, Any]) -> None:
    report.section("Experiment")
    report.line(f"- id: `{experiment_id}`")
    report.line(f"- name: {payload.get('name')!r}")
    report.line(f"- status: {payload.get('status')}")
    report.line(f"- last simulation: {payload.get('last_simulation_at')}")
    report.line(f"- audit entries: {len(payload.get('audit_log', []))}")
    runs = list(iter_sequence_runs(payload))
    report.line(f"- sequence runs: {len(runs)}")
    for run in runs:
        injections = run.get("injections", [])
        report.line(f"  - `{run.get('id')}` method={run.get('method_id')} {len(injections)} injection(s), {run.get('total_duration_s')} s")


def report_grind(report: Report, payload: dict[str, Any]) -> None:
    states = payload.get("produce_material_states", [])
    if not states:
        return
    report.section("Grinding / homogeneity")
    report.line("| material state | state | label | homogeneity | mean grind T | degradation factors |")
    report.line("|---|---|---|---|---|---|")
    for state in states:
        elapsed = state.get("grinding_elapsed_seconds") or 0.0
        integral = state.get("grinding_temperature_integral") or 0.0
        mean_t = f"{integral / elapsed:.1f} °C" if elapsed > 0 else "—"
        score = state.get("homogeneity_score")
        factors = state.get("pesticide_degradation_factors") or {}
        worst = f"{min(factors.values()):.3f}" if factors else "— (empty)"
        report.line(
            f"| `{short_id(state['id'])}` | {state.get('material_state')} "
            f"| {state.get('grind_quality_label') or '—'} "
            f"| {score if score is not None else '—'} | {mean_t} | worst {worst} |"
        )

        if score is not None and score < LOW_HOMOGENEITY_THRESHOLD:
            report.finding(
                f"Grind homogeneity {score:.3f} on `{short_id(state['id'])}` is below "
                f"{LOW_HOMOGENEITY_THRESHOLD} — a weighed aliquot no longer represents the lot "
                f"(threshold: fine powder needs ≤ {Sim.fine_powder_temperature_c} °C mean)."
            )

    report.line()
    report.line(
        f"_Scale: 0.97 at <= -75 C, 0.85 at {Sim.fine_powder_temperature_c} C (`powder_fine`), "
        f"0.55 at {Sim.granular_temperature_c} C (`granular`), "
        f"0.20 at {Sim.poor_grind_temperature_c} C (`coarse`)._"
    )


def report_quechers(report: Report, payload: dict[str, Any]) -> None:
    rows: list[tuple[str, dict[str, Any]]] = [
        (location, tool)
        for location, tool in iter_tools(payload)
        if (tool.get("quechers_state") or {}).get("salts_added") or tool.get("quechers_extraction_result")
    ]
    if not rows:
        return

    report.section("QuEChERS extraction")
    report.line("| tube | location | phase | cementation | separation | thermal deg. | ε_manip | ISTD phase | faults |")
    report.line("|---|---|---|---|---|---|---|---|---|")
    for location, tool in rows:
        state = tool.get("quechers_state") or {}
        result = tool.get("quechers_extraction_result") or {}
        faults = state.get("faults") or []
        report.line(
            f"| `{short_id(tool['id'])}` | {location} | {state.get('phase')} "
            f"| {state.get('cementation_progress', 0):.3f} "
            f"| {state.get('separation_progress', 0):.3f} "
            f"| {state.get('thermal_degradation_progress', 0):.3f} "
            f"| {result.get('extraction_manip_factor', '—')} "
            f"| {tool.get('istd_phase_added') or '—'} "
            f"| {', '.join(faults) or '—'} |"
        )

        if faults:
            report.finding(
                f"Tube `{short_id(tool['id'])}` ({location}) carries fault(s) {faults} — phase `{state.get('phase')}`, its content is not usable."
            )

        istd_manip = result.get("istd_manip_factor")
        manip = result.get("extraction_manip_factor")
        if result and istd_manip is not None and manip is not None and istd_manip != manip:
            report.finding(
                f"Tube `{short_id(tool['id'])}`: ISTD added at `{tool.get('istd_phase_added')}` got an "
                f"independent draw ({istd_manip} vs {manip}) — the ratio no longer corrects the "
                f"extraction loss and the result stays biased."
            )

        thermal = state.get("thermal_degradation_progress") or 0.0
        if thermal > 0:
            state_ids = {fraction.get("produce_material_state_id") for fraction in tool.get("produce_fractions", [])}
            booked = any(
                (material.get("pesticide_degradation_factors") or {})
                for material in payload.get("produce_material_states", [])
                if material.get("id") in state_ids
            )
            if not booked and state_ids:
                report.finding(
                    f"Tube `{short_id(tool['id'])}`: thermal_degradation_progress = {thermal:.3f} but no "
                    f"residue loss was booked — the material state(s) behind its fractions carry an "
                    f"empty `pesticide_degradation_factors`, which "
                    f"`advance_quechers_pesticide_degradation` skips. The exotherm cost nothing."
                )

    report.line()
    report.line(
        f"_Cementation window: {Sim.quechers_cementation_seconds} s of reacting phase. "
        f"Degradation starts above {Sim.quechers_degradation_threshold_c} °C "
        f"(peak {Sim.quechers_peak_temperature_c} °C). ε_manip drawn N({Sim.extraction_manip_mu}, "
        f"{Sim.extraction_manip_sigma})._"
    )


def report_contamination(report: Report, payload: dict[str, Any]) -> None:
    rows: list[str] = []
    for location, tool in iter_tools(payload):
        for fraction in tool.get("produce_fractions", []) or []:
            mass = fraction.get("true_mass_g") or fraction.get("mass_g") or 0.0
            impurity = fraction.get("impurity_mass_mg") or 0.0
            per_gram = impurity / mass if mass > 0 else 0.0
            flags = []
            if fraction.get("is_contaminated"):
                flags.append("contaminated")
            if fraction.get("is_mixed"):
                flags.append("mixed")
            rows.append(
                f"| `{short_id(fraction['id'])}` | {location} | {mass:.3f} g | {impurity:.4f} mg | {per_gram:.5f} mg/g | {', '.join(flags) or '—'} |"
            )
            if fraction.get("is_contaminated"):
                report.finding(
                    f"Fraction `{short_id(fraction['id'])}` in {location} is flagged contaminated — "
                    f"it raises the detector background across every channel "
                    f"({Sim.dirt_baseline_gain_per_mg} x per mg of foreign matter)."
                )
    if not rows:
        return
    report.section("Produce fractions / cleanliness")
    report.line("| fraction | location | mass | impurity | per gram | flags |")
    report.line("|---|---|---|---|---|---|")
    for row in rows:
        report.line(row)


def report_injection_contexts(report: Report, payload: dict[str, Any]) -> None:
    contexts = [(location, tool, tool["injection_context"]) for location, tool in iter_tools(payload) if tool.get("injection_context")]
    if not contexts:
        return

    report.section("Injection contexts / matrix suppression")
    for location, tool, ctx in contexts:
        mass = ctx.get("sample_true_mass_g") or ctx.get("sample_mass_g") or 0.0
        volume = ctx.get("extract_true_volume_ml") or ctx.get("extract_volume_ml") or 0.0
        load = Sim.matrix_load_g_per_ml(mass, volume)
        result = ctx.get("extraction_result") or {}
        representativeness = result.get("sampling_representativeness")
        manip = result.get("extraction_manip_factor")

        report.line()
        report.line(f"**`{short_id(tool['id'])}` ({tool.get('label')}, {location})**")
        report.line(
            f"- sample {ctx.get('sample_mass_g')} g nominal / {mass:.6f} g true, "
            f"extract {ctx.get('extract_volume_ml')} mL nominal / {volume:.6f} mL true"
        )
        report.line(
            f"- ISTD {ctx.get('istd_volume_ml')} mL nominal / {ctx.get('istd_true_volume_ml')} mL true "
            f"at {ctx.get('istd_reference_conc_ng_per_ml')} ng/mL, phase `{result.get('istd_phase')}`"
        )
        report.line(f"- matrix load **{load:.4f} g/mL**, foreign matter {ctx.get('foreign_matter_mass_mg')} mg")
        report.line(f"- ε_manip {manip}, sampling representativeness {representativeness}")
        report.line()
        report.line("| compound | true µg/kg | reference RT | suppression | expected recovery |")
        report.line("|---|---|---|---|---|")

        compounds = list(ctx.get("effective_residues_ug_per_kg", {}).items())
        for compound_id in [INTERNAL_STANDARD_COMPOUND_ID]:
            compounds.append((compound_id, None))
        for compound_id, residue in compounds:
            rt = _reference_retention_time_s(compound_id)
            suppression = Sim.matrix_suppression_factor(load, rt)
            expected = suppression * (manip or 1.0) * (representativeness or 1.0)
            if compound_id == INTERNAL_STANDARD_COMPOUND_ID:
                expected = suppression * (result.get("istd_manip_factor") or manip or 1.0)
            report.line(
                f"| {compound_id} | {residue if residue is not None else '(ISTD)'} "
                f"| {rt if rt is not None else '—'} s | {suppression:.4f} | {expected * 100:.1f} % |"
            )

        nominal_istd = ctx.get("istd_volume_ml")
        true_istd = ctx.get("istd_true_volume_ml")
        if nominal_istd and true_istd:
            deviation = (true_istd - nominal_istd) / nominal_istd
            if abs(deviation) > 0.05:
                report.finding(
                    f"Vial `{short_id(tool['id'])}`: ISTD volume delivered {deviation * 100:+.1f} % off "
                    f"nominal ({true_istd} vs {nominal_istd} mL) — the correction it is supposed to "
                    f"provide carries that error."
                )

        if load > 0.8:
            report.finding(
                f"Vial `{short_id(tool['id'])}`: matrix load {load:.3f} g/mL is an undiluted extract — "
                f"suppression costs 25-45 % of the response depending on retention time. Diluting "
                f"recovers it (dilute-and-shoot) or use matrix-matched calibration."
            )


def report_runs(report: Report, payload: dict[str, Any]) -> None:
    runs = list(iter_sequence_runs(payload))
    if not runs:
        return

    for run in runs:
        injections = run.get("injections", [])
        report.section(f"Sequence run `{run.get('id')}`")
        for injection in injections:
            report.line()
            report.line(
                f"**{injection.get('output_filename')}** — status `{injection.get('status')}`, "
                f"vial `{short_id(injection.get('vial_id', ''))}`, slot {injection.get('rack_slot_id')}, "
                f"{injection.get('injection_volume_ul')} µL"
            )
            report.line("| compound | role | peak | area | S/N | peak RT | declared RT | in window |")
            report.line("|---|---|---|---|---|---|---|---|")
            for trace in injection.get("traces", []):
                peak = integrate_trace(trace)
                report.line(
                    f"| {peak.compound_id} | {peak.role} | {peak.peak_height:.1f} "
                    f"| {peak.area:.1f} | {peak.signal_to_noise:.1f} "
                    f"| {peak.peak_time_s:.1f} s "
                    f"| {peak.declared_rt_s if peak.declared_rt_s is not None else '—'} s "
                    f"| {'yes' if peak.in_declared_window else 'NO'} |"
                )
                if not peak.in_declared_window and peak.signal_to_noise > 10:
                    report.finding(
                        f"{peak.compound_id} ({peak.role}) peaks at {peak.peak_time_s:.0f} s but the "
                        f"method declares {peak.declared_rt_s} s — outside the acquisition window."
                    )
            acquisition = (injection.get("traces") or [{}])[0].get("acquisition", {})
            if acquisition and not acquisition.get("acquired_in_retention_window", True):
                report.finding(
                    f"Injection {injection.get('output_filename')} was not acquired in its retention "
                    f"window — the method does not match the compounds."
                )

        report_recovery(report, payload, run)


def report_recovery(report: Report, payload: dict[str, Any], run: dict[str, Any]) -> None:
    injections = run.get("injections", [])
    samples = [inj for inj in injections if inj.get("status") == "ok"]
    calibrations = [inj for inj in injections if inj.get("status") == "calibration"]
    if not samples:
        report.finding(f"Run `{run.get('id')}` has no injection with an extract context — nothing quantifiable.")
        return
    if not calibrations:
        report.finding(f"Run `{run.get('id')}` has no calibration injection — the sample cannot be quantified against anything.")
        return

    calibration = calibrations[0]
    calibration_vial = find_tool(payload, calibration.get("vial_id", ""))
    calibration_ctx = (calibration_vial or {}).get("calibration_context") or {}
    level = calibration_ctx.get("true_level_ng_per_ml") or calibration_ctx.get("level_ng_per_ml")
    if not level:
        report.finding(f"Calibration vial `{short_id(calibration.get('vial_id', ''))}` carries no calibration context — its level is unknown.")
        return

    calibration_areas = quantifier_areas(calibration)
    istd_peak = next(
        (
            integrate_trace(trace)
            for trace in calibration.get("traces", [])
            if trace.get("transition", {}).get("compound_id") == INTERNAL_STANDARD_COMPOUND_ID
        ),
        None,
    )
    if istd_peak is not None and istd_peak.signal_to_noise < 6:
        report.finding(
            "The calibration standard contains no internal standard (its ISTD channel is at noise "
            "level) — ISTD correction across sample and standard is impossible, so matrix "
            "suppression stays uncorrected in the final result."
        )

    for sample in samples:
        vial = find_tool(payload, sample.get("vial_id", ""))
        ctx = (vial or {}).get("injection_context") or {}
        residues = ctx.get("effective_residues_ug_per_kg") or {}
        if not residues:
            continue
        mass = ctx.get("sample_true_mass_g") or ctx.get("sample_mass_g") or 0.0
        volume = ctx.get("extract_true_volume_ml") or ctx.get("extract_volume_ml") or 0.0
        if mass <= 0 or volume <= 0:
            continue
        load = Sim.matrix_load_g_per_ml(mass, volume)
        result = ctx.get("extraction_result") or {}
        manip = result.get("extraction_manip_factor") or 1.0
        representativeness = result.get("sampling_representativeness") or 1.0

        sample_areas = quantifier_areas(sample)
        report.line()
        report.line(f"**Recovery — {sample.get('output_filename')} vs {calibration.get('output_filename')} at {level:.4f} ng/mL**")
        report.line("| compound | true µg/kg | found µg/kg | recovery | expected | delta |")
        report.line("|---|---|---|---|---|---|")

        recoveries: list[float] = []
        for compound_id, true_value in residues.items():
            sample_peak = sample_areas.get(compound_id)
            calibration_peak = calibration_areas.get(compound_id)
            if sample_peak is None or calibration_peak is None or calibration_peak.area <= 0:
                report.line(f"| {compound_id} | {true_value} | — | — | — | no matching transition |")
                continue
            found = sample_peak.area / calibration_peak.area * level * volume / mass * EXTERNAL_CALIBRATION_UNIT_FACTOR
            recovery = found / true_value * 100 if true_value else 0.0
            suppression = Sim.matrix_suppression_factor(load, _reference_retention_time_s(compound_id))
            expected = suppression * manip * representativeness * 100
            recoveries.append(recovery)
            report.line(
                f"| {compound_id} | {true_value:.1f} | {found:.1f} | **{recovery:.1f} %** | {expected:.1f} % | {recovery - expected:+.1f} pt |"
            )

            if true_value and level:
                ratio = (true_value * mass / volume) / level
                if ratio > CALIBRATION_RANGE_FACTOR or ratio < 1 / CALIBRATION_RANGE_FACTOR:
                    report.finding(
                        f"{compound_id} sits {ratio:.0f}x away from the {level:.1f} ng/mL calibration "
                        f"level — the quantification extrapolates instead of interpolating. Dilute "
                        f"the extract or add calibration levels."
                    )

        if recoveries:
            mean_recovery = sum(recoveries) / len(recoveries)
            report.line()
            report.line(f"_Mean recovery: **{mean_recovery:.1f} %** over {len(recoveries)} compound(s)._")

        report.line()
        report.line(
            f"_Found values include the x{EXTERNAL_CALIBRATION_UNIT_FACTOR:.0f} unit factor: the "
            f"signal model builds the sample amount as `ug/kg * g * 1e-3` (lcmsms.py, "
            f"`_compute_sample_responses`) while the standard is built straight in ng/mL, so the two "
            f"injections of one sequence are 1000x apart. Without the factor every recovery reads "
            f"0.1 %._"
        )


def report_trash(report: Report, payload: dict[str, Any]) -> None:
    children = payload.get("trash", {}).get("children", []) or []
    if not children:
        return
    report.section("Discarded")
    discarded_from = payload.get("trash", {}).get("discarded_from", {}) or {}
    for tool in children:
        state = tool.get("quechers_state") or {}
        faults = state.get("faults") or []
        mass = sum(fraction.get("true_mass_g") or fraction.get("mass_g") or 0.0 for fraction in tool.get("produce_fractions", []) or [])
        report.line(
            f"- `{short_id(tool['id'])}` {tool.get('label')} from {discarded_from.get(tool['id'], '?')} "
            f"— phase `{state.get('phase')}`, faults {faults or '—'}, {mass:.3f} g of sample lost"
        )


# --------------------------------------------------------------------------
# entry point
# --------------------------------------------------------------------------


def build_report(experiment_id: str, payload: dict[str, Any]) -> str:
    report = Report()
    report_header(report, experiment_id, payload)
    report_grind(report, payload)
    report_quechers(report, payload)
    report_contamination(report, payload)
    report_injection_contexts(report, payload)
    report_runs(report, payload)
    report_trash(report, payload)
    return report.render()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--db",
        default="data/experiments.sqlite3",
        help="path to the sqlite snapshot (default: data/experiments.sqlite3, relative to backend/)",
    )
    parser.add_argument(
        "--experiment",
        default=None,
        help="experiment id to inspect (default: the most recently updated one)",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="list the stored experiments and exit",
    )
    args = parser.parse_args()

    if args.list:
        for row in list_experiments(args.db):
            print(f"{row['id']}  {row['updated_at']}  {row['status']:<12} runs={row['run_count']}  {row['name']!r}")
        return

    experiment_id, payload = load_payload(args.db, args.experiment)
    print(build_report(experiment_id, payload))


if __name__ == "__main__":
    main()
