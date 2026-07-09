"""LC-MS/MS domain services: pour extract from tube to vial, run sequence."""
from __future__ import annotations

import random
from dataclasses import dataclass

from app.domain.models import (
    CalibrationContext,
    CompoundMeasurement,
    Experiment,
    InjectionContext,
    InjectionMeasurement,
    ProduceLot,
    ProduceMaterialState,
    SequenceRun,
    WorkbenchTool,
    new_id,
)
from app.services.domain_services.base import ExperimentRuntime, WriteDomainService
from app.services.helpers.lookups import find_workspace_widget
from app.services.helpers.produce_material_states import find_material_state

ISTD_SOLUTION_ID = "istd_solution"
ACETONITRILE_ID = "acetonitrile_extraction"
APPLE_EXTRACT_ID = "apple_extract"
ISTD_REFERENCE_CONC_NG_PER_ML = 100.0
ENV_NOISE_SIGMA = 0.005  # 0.5% environmental noise per measurement


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _find_tool_anywhere(experiment: Experiment, tool_id: str) -> WorkbenchTool | None:
    """Return the tool with the given ID from any location in the experiment."""
    for slot in experiment.workbench.slots:
        if slot.tool and slot.tool.id == tool_id:
            return slot.tool
    for slot in experiment.rack.slots:
        if slot.tool and slot.tool.id == tool_id:
            return slot.tool
    for tool in experiment.basket_tools:
        if tool.id == tool_id:
            return tool
    for widget in experiment.workspace.widgets:
        if widget.tool and widget.tool.id == tool_id:
            return widget.tool
    return None


def _effective_residues(
    produce_fractions: list,
    produce_lots: list[ProduceLot],
    material_states: list[ProduceMaterialState],
) -> dict[str, float]:
    """Return weighted-average effective residues (µg/kg) across all fractions in a tube.

    Effective = initial_residue × degradation_factor.  Fractions from the same lot
    are combined proportionally by mass.
    """
    lot_map = {lot.id: lot for lot in produce_lots}
    # Also include lots whose fractions live in the tube
    for fraction in produce_fractions:
        # lot itself may be on the experiment, not on the tool
        pass

    total_mass_g: dict[str, float] = {}
    weighted_residues: dict[str, dict[str, float]] = {}

    for fraction in produce_fractions:
        lot_id = fraction.produce_lot_id
        lot = lot_map.get(lot_id)
        if lot is None or not lot.pesticide_residues:
            continue
        state = find_material_state(material_states, lot_id)
        deg_factors = state.pesticide_degradation_factors if state else {}

        mass = fraction.mass_g
        total_mass_g[lot_id] = total_mass_g.get(lot_id, 0.0) + mass
        if lot_id not in weighted_residues:
            weighted_residues[lot_id] = {}
        for compound_id, initial in lot.pesticide_residues.items():
            factor = deg_factors.get(compound_id, 1.0)
            effective = initial * max(0.0, min(1.0, factor))
            weighted_residues[lot_id][compound_id] = (
                weighted_residues[lot_id].get(compound_id, 0.0) + effective * mass
            )

    # Average across all lot fractions (weighted by mass)
    merged: dict[str, float] = {}
    for lot_id, compounds in weighted_residues.items():
        mass = total_mass_g[lot_id]
        if mass <= 0:
            continue
        for compound_id, weighted in compounds.items():
            merged[compound_id] = merged.get(compound_id, 0.0) + weighted / mass

    return merged


# ---------------------------------------------------------------------------
# Pour extract
# ---------------------------------------------------------------------------

@dataclass(frozen=True, slots=True)
class PourExtractToVialRequest:
    tube_tool_id: str
    vial_tool_id: str


class PourExtractToVialService(WriteDomainService[PourExtractToVialRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: PourExtractToVialRequest) -> None:
        tube = _find_tool_anywhere(experiment, request.tube_tool_id)
        if tube is None:
            raise ValueError("Centrifuge tube not found.")
        if tube.tool_type != "centrifuge_tube":
            raise ValueError(f"{tube.label} is not a centrifuge tube.")

        qs = tube.quechers_state
        if qs.phase != "cemented" or "dry_salts_wetted" in qs.faults:
            raise ValueError(
                f"{tube.label} does not contain a completed extraction. "
                "Complete the QuEChERS process first."
            )
        if tube.quechers_extraction_result is None:
            raise ValueError(f"{tube.label} has no extraction result — run the simulation clock first.")

        vial = _find_tool_anywhere(experiment, request.vial_tool_id)
        if vial is None:
            raise ValueError("Autosampler vial not found.")
        if vial.tool_type != "sample_vial":
            raise ValueError(f"{vial.label} is not an autosampler vial.")
        if vial.injection_context is not None:
            raise ValueError(f"{vial.label} already contains an extract.")

        # Collect all ProduceLots referenced by the tube's fractions
        all_lots: list[ProduceLot] = list(tube.produce_lots)
        referenced_lot_ids = {f.produce_lot_id for f in tube.produce_fractions}
        for lot_id in referenced_lot_ids:
            if not any(lot.id == lot_id for lot in all_lots):
                for slot in experiment.workbench.slots:
                    for lot in (slot.surface_produce_lots or []):
                        if lot.id == lot_id:
                            all_lots.append(lot)

        sample_mass_g = sum(f.mass_g for f in tube.produce_fractions)
        if sample_mass_g <= 0:
            raise ValueError(f"{tube.label} contains no sample mass to pour.")

        acetonitrile = next(
            (liq for liq in tube.liquids if liq.liquid_id == ACETONITRILE_ID), None
        )
        extract_volume_ml = acetonitrile.volume_ml if acetonitrile is not None else 10.0

        istd_liquid = next(
            (liq for liq in tube.liquids if liq.liquid_id == ISTD_SOLUTION_ID), None
        )
        istd_volume_ml = istd_liquid.volume_ml if istd_liquid is not None else None

        effective = _effective_residues(
            tube.produce_fractions, all_lots, experiment.produce_material_states
        )

        vial.injection_context = InjectionContext(
            source_tube_id=tube.id,
            sample_mass_g=round(sample_mass_g, 4),
            extract_volume_ml=round(extract_volume_ml, 3),
            effective_residues_ug_per_kg={k: round(v, 4) for k, v in effective.items()},
            extraction_result=tube.quechers_extraction_result,
            istd_volume_ml=round(istd_volume_ml, 4) if istd_volume_ml is not None else None,
            istd_reference_conc_ng_per_ml=ISTD_REFERENCE_CONC_NG_PER_ML,
        )

        experiment.audit_log.append(
            f"Extract poured from {tube.label} into {vial.label} "
            f"({sample_mass_g:.2f} g sample, "
            f"{len(effective)} compound(s)"
            + (f", ISTD {istd_volume_ml:.3f} mL" if istd_volume_ml else ", no ISTD")
            + ")."
        )


# ---------------------------------------------------------------------------
# Run sequence
# ---------------------------------------------------------------------------

@dataclass(frozen=True, slots=True)
class RunSequenceRequest:
    pass


class RunSequenceService(WriteDomainService[RunSequenceRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: RunSequenceRequest) -> None:
        instrument = find_workspace_widget(experiment.workspace, "instrument")
        if not instrument.is_present:
            raise ValueError("LC-MS/MS instrument is not deployed on the bench.")

        rack_widget = find_workspace_widget(experiment.workspace, "rack")
        if not rack_widget.is_present:
            raise ValueError("Autosampler rack is not deployed.")

        vials_in_rack = [slot for slot in experiment.rack.slots if slot.tool is not None]
        if not vials_in_rack:
            raise ValueError("The autosampler rack contains no vials.")

        injections: list[InjectionMeasurement] = []
        for rack_slot in vials_in_rack:
            vial = rack_slot.tool
            assert vial is not None  # guaranteed by the filter above

            if vial.calibration_context is not None:
                injections.append(
                    InjectionMeasurement(
                        vial_id=vial.id,
                        vial_label=vial.label,
                        rack_slot_id=rack_slot.id,
                        status="calibration",
                        compounds=_compute_calibration_compounds(vial.calibration_context),
                    )
                )
                continue

            if vial.injection_context is None:
                injections.append(
                    InjectionMeasurement(
                        vial_id=vial.id,
                        vial_label=vial.label,
                        rack_slot_id=rack_slot.id,
                        status="no_extract_context",
                        compounds=[],
                    )
                )
                continue

            compounds = _compute_compounds(vial, vial.injection_context)
            injections.append(
                InjectionMeasurement(
                    vial_id=vial.id,
                    vial_label=vial.label,
                    rack_slot_id=rack_slot.id,
                    status="ok",
                    compounds=compounds,
                )
            )

        run = SequenceRun(id=new_id("seq"), injections=injections)
        instrument.sequence_runs.append(run)

        n_ok = sum(1 for inj in injections if inj.status == "ok")
        experiment.audit_log.append(
            f"LC-MS/MS sequence run {run.id}: {len(injections)} vial(s) injected, "
            f"{n_ok} with extract context."
        )


# ---------------------------------------------------------------------------
# Add calibration standard to vial
# ---------------------------------------------------------------------------

@dataclass(frozen=True, slots=True)
class AddCalibrationToVialRequest:
    vial_tool_id: str
    level_ng_per_ml: float


class AddCalibrationToVialService(WriteDomainService[AddCalibrationToVialRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: AddCalibrationToVialRequest) -> None:
        from app.domain.pesticide_catalog import APPLE_PESTICIDE_CATALOG

        if request.level_ng_per_ml <= 0:
            raise ValueError("Calibration level must be positive.")

        from app.domain.dnd_rules import can_tool_receive_liquids

        vial = _find_tool_anywhere(experiment, request.vial_tool_id)
        if vial is None:
            raise ValueError("Tool not found.")
        # A liquid can physically go into any container that holds liquids. If the
        # container can never enter the autosampler rack (e.g. a centrifuge tube) the
        # calibrant is simply never injected — useless, but not an error.
        if not can_tool_receive_liquids(vial.tool_type):
            raise ValueError(f"{vial.label} cannot receive liquids.")
        if vial.calibration_context is not None:
            raise ValueError(f"{vial.label} already contains a calibration standard.")
        if vial.injection_context is not None:
            raise ValueError(f"{vial.label} already contains a sample extract.")

        compound_ids = [p.compound_id for p in APPLE_PESTICIDE_CATALOG]
        vial.calibration_context = CalibrationContext(
            level_ng_per_ml=round(request.level_ng_per_ml, 4),
            compound_ids=compound_ids,
        )
        experiment.audit_log.append(
            f"Calibration standard {request.level_ng_per_ml} ng/mL prepared in {vial.label}."
        )


def _compute_calibration_compounds(ctx: CalibrationContext) -> list[CompoundMeasurement]:
    """Simulate LC-MS/MS measurements for a multi-residue calibration standard.

    Signal is proportional to nominal concentration with small environmental noise only —
    no extraction variance applies since the standard is a pure solution.
    """
    results: list[CompoundMeasurement] = []
    for compound_id in ctx.compound_ids:
        env_noise = random.gauss(1.0, ENV_NOISE_SIGMA)
        signal = ctx.level_ng_per_ml * env_noise
        results.append(
            CompoundMeasurement(
                compound_id=compound_id,
                true_effective_ug_per_kg=0.0,
                calculated_conc_ug_per_kg=None,
                pesticide_signal=round(signal, 6),
                istd_signal=None,
                extraction_manip_factor=1.0,
                istd_correction_applied=False,
                istd_phase=None,
                nominal_conc_ng_per_ml=ctx.level_ng_per_ml,
            )
        )
    return results


def _compute_compounds(
    vial: WorkbenchTool, ctx: InjectionContext
) -> list[CompoundMeasurement]:
    """Apply the two-tier variance model to compute per-compound LC-MS/MS results."""
    results: list[CompoundMeasurement] = []
    extraction_result = ctx.extraction_result

    # Determine if ISTD correction is applicable
    extraction_manip = extraction_result.extraction_manip_factor if extraction_result else 1.0
    istd_manip = extraction_result.istd_manip_factor if extraction_result else None
    istd_phase = extraction_result.istd_phase if extraction_result else None

    # ISTD parameters
    istd_amount_ng = (
        ctx.istd_volume_ml * ctx.istd_reference_conc_ng_per_ml
        if ctx.istd_volume_ml is not None
        else None
    )

    for compound_id, true_effective_ug_per_kg in ctx.effective_residues_ug_per_kg.items():
        # Pesticide amount in the extract (ng)
        pesticide_amount_ng = true_effective_ug_per_kg * ctx.sample_mass_g * 1e-3

        # Apply shared extraction manip factor + small env noise
        env_pest = random.gauss(1.0, ENV_NOISE_SIGMA)
        pesticide_signal = pesticide_amount_ng * extraction_manip * env_pest

        istd_signal: float | None = None
        calculated: float | None = None
        correction_applied = False

        if istd_amount_ng is not None and istd_manip is not None:
            # ISTD was present in the tube during extraction at some phase
            env_istd = random.gauss(1.0, ENV_NOISE_SIGMA)
            istd_signal = istd_amount_ng * istd_manip * env_istd
            ratio = pesticide_signal / istd_signal
            # Back-calculate: true = ratio × istd_amount / (sample_mass × 1e-3)
            calculated = ratio * istd_amount_ng / (ctx.sample_mass_g * 1e-3)
            correction_applied = True
        else:
            # No ISTD correction — external calibration, biased by extraction manip
            calculated = true_effective_ug_per_kg * extraction_manip * env_pest

        results.append(
            CompoundMeasurement(
                compound_id=compound_id,
                true_effective_ug_per_kg=round(true_effective_ug_per_kg, 4),
                calculated_conc_ug_per_kg=round(calculated, 4) if calculated is not None else None,
                pesticide_signal=round(pesticide_signal, 6),
                istd_signal=round(istd_signal, 6) if istd_signal is not None else None,
                extraction_manip_factor=round(extraction_manip, 4),
                istd_correction_applied=correction_applied,
                istd_phase=istd_phase,
            )
        )
    return results
