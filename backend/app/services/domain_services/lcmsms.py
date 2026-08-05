"""LC-MS/MS domain services: pour extract from tube to vial, run sequence."""
from __future__ import annotations

import random
from dataclasses import dataclass

from app.domain.acquisition_methods import (
    get_acquisition_method,
    snapshot_acquisition_method,
)
from app.domain.models import (
    CalibrationContext,
    Experiment,
    InjectionContext,
    InjectionMeasurement,
    ProduceLot,
    ProduceMaterialState,
    RackSlot,
    SequenceRun,
    WorkbenchTool,
    new_id,
)
from app.domain.mrm_reference import INTERNAL_STANDARD_COMPOUND_ID
from app.services.domain_services.base import ExperimentRuntime, WriteDomainService
from app.services.domain_services.mrm_signal import generate_transition_traces
from app.services.helpers.lookups import find_workspace_widget
from app.services.helpers.produce_material_states import find_material_state
from app.services.helpers.tool_liquids import add_liquid_to_tool
from app.services.physical_simulation_service import PhysicalSimulationService

ISTD_SOLUTION_ID = "istd_solution"
ACETONITRILE_ID = "acetonitrile_extraction"
APPLE_EXTRACT_ID = "apple_extract"
ISTD_REFERENCE_CONC_NG_PER_ML = 100.0
CALIBRATION_STANDARD_VOLUME_ML = 1.0
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

    Effective = initial_residue x degradation_factor. Fractions from the same lot
    are combined proportionally by mass.
    """
    lot_map = {lot.id: lot for lot in produce_lots}

    total_mass_g: dict[str, float] = {}
    weighted_residues: dict[str, dict[str, float]] = {}

    for fraction in produce_fractions:
        lot_id = fraction.produce_lot_id
        lot = lot_map.get(lot_id)
        if lot is None or not lot.pesticide_residues:
            continue
        state = find_material_state(material_states, lot_id)
        deg_factors = state.pesticide_degradation_factors if state else {}

        mass = (
            fraction.true_mass_g
            if fraction.true_mass_g is not None
            else fraction.mass_g
        )
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


def build_extract_injection_context(
    experiment: Experiment,
    tube: WorkbenchTool,
    extract_volume_ml: float,
    *,
    sample_mass_g: float | None = None,
    sample_true_mass_g: float | None = None,
    extract_true_volume_ml: float | None = None,
    istd_volume_ml: float | None = None,
    istd_true_volume_ml: float | None = None,
) -> InjectionContext:
    all_lots: list[ProduceLot] = list(tube.produce_lots)
    referenced_lot_ids = {fraction.produce_lot_id for fraction in tube.produce_fractions}
    for lot_id in referenced_lot_ids:
        if not any(lot.id == lot_id for lot in all_lots):
            for slot in experiment.workbench.slots:
                for lot in slot.surface_produce_lots or []:
                    if lot.id == lot_id:
                        all_lots.append(lot)

    total_sample_mass_g = sum(fraction.mass_g for fraction in tube.produce_fractions)
    total_sample_true_mass_g = sum(
        fraction.true_mass_g
        if fraction.true_mass_g is not None
        else fraction.mass_g
        for fraction in tube.produce_fractions
    )
    if total_sample_mass_g <= 0:
        raise ValueError(f"{tube.label} contains no sample mass to pipette.")
    acetonitrile = next((liquid for liquid in tube.liquids if liquid.liquid_id == ACETONITRILE_ID), None)
    total_extract_volume_ml = acetonitrile.volume_ml if acetonitrile is not None else 10.0
    total_extract_true_volume_ml = (
        acetonitrile.true_volume_ml
        if acetonitrile is not None and acetonitrile.true_volume_ml is not None
        else total_extract_volume_ml
    )
    if total_extract_volume_ml <= 0:
        raise ValueError(f"{tube.label} contains no extract volume to pipette.")
    volume_ratio = extract_volume_ml / total_extract_volume_ml
    true_volume_ratio = (
        extract_true_volume_ml / total_extract_true_volume_ml
        if extract_true_volume_ml is not None and total_extract_true_volume_ml > 0
        else volume_ratio
    )
    istd_liquid = next((liquid for liquid in tube.liquids if liquid.liquid_id == ISTD_SOLUTION_ID), None)
    effective = _effective_residues(tube.produce_fractions, all_lots, experiment.produce_material_states)
    return InjectionContext(
        source_tube_id=tube.id,
        sample_mass_g=round(
            sample_mass_g
            if sample_mass_g is not None
            else total_sample_mass_g * volume_ratio,
            4,
        ),
        sample_true_mass_g=round(
            sample_true_mass_g
            if sample_true_mass_g is not None
            else total_sample_true_mass_g * true_volume_ratio,
            6,
        ),
        extract_volume_ml=round(extract_volume_ml, 3),
        effective_residues_ug_per_kg={key: round(value, 4) for key, value in effective.items()},
        extraction_result=tube.quechers_extraction_result,
        istd_volume_ml=(
            round(istd_volume_ml, 4)
            if istd_volume_ml is not None
            else round(istd_liquid.volume_ml * volume_ratio, 4)
            if istd_liquid is not None
            else None
        ),
        istd_reference_conc_ng_per_ml=ISTD_REFERENCE_CONC_NG_PER_ML,
        extract_true_volume_ml=round(
            extract_true_volume_ml
            if extract_true_volume_ml is not None
            else extract_volume_ml,
            6,
        ),
        istd_true_volume_ml=(
            round(istd_true_volume_ml, 6)
            if istd_true_volume_ml is not None
            else round((istd_liquid.true_volume_ml or istd_liquid.volume_ml) * volume_ratio, 6)
            if istd_liquid is not None
            else None
        ),
    )


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
        if qs.phase != "separated" or "dry_salts_wetted" in qs.faults:
            raise ValueError(
                f"{tube.label} does not contain a separated extract. "
                "Complete vortexing and centrifugation first."
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

        acetonitrile = next(
            (liq for liq in tube.liquids if liq.liquid_id == ACETONITRILE_ID), None
        )
        extract_volume_ml = acetonitrile.volume_ml if acetonitrile is not None else 10.0
        vial.injection_context = build_extract_injection_context(experiment, tube, extract_volume_ml)
        context = vial.injection_context

        experiment.audit_log.append(
            f"Extract poured from {tube.label} into {vial.label} "
            f"({context.sample_mass_g:.2f} g sample, "
            f"{len(context.effective_residues_ug_per_kg)} compound(s)"
            + (f", ISTD {context.istd_volume_ml:.3f} mL" if context.istd_volume_ml else ", no ISTD")
            + ")."
        )


# ---------------------------------------------------------------------------
# Run sequence
# ---------------------------------------------------------------------------

@dataclass(frozen=True, slots=True)
class LoadRackIntoInstrumentRequest:
    pass


class LoadRackIntoInstrumentService(WriteDomainService[LoadRackIntoInstrumentRequest]):
    def _run(self, experiment: Experiment, request: LoadRackIntoInstrumentRequest) -> None:
        del request
        instrument = find_workspace_widget(experiment.workspace, "instrument")
        if not instrument.is_present:
            raise ValueError("LC-MS/MS instrument is not deployed on the bench.")

        rack_widget = find_workspace_widget(experiment.workspace, "rack")
        if not rack_widget.is_present:
            raise ValueError("Autosampler rack is not deployed.")
        if not any(slot.tool is not None for slot in experiment.rack.slots):
            raise ValueError("The autosampler rack contains no vials.")
        if experiment.rack.state != "available":
            raise ValueError("The autosampler rack is already loaded into the LC-MS/MS.")

        experiment.rack.state = "loaded"
        experiment.audit_log.append("Autosampler rack loaded into the LC-MS/MS.")


@dataclass(frozen=True, slots=True)
class UnloadRackFromInstrumentRequest:
    pass


class UnloadRackFromInstrumentService(WriteDomainService[UnloadRackFromInstrumentRequest]):
    def _run(self, experiment: Experiment, request: UnloadRackFromInstrumentRequest) -> None:
        del request
        instrument = find_workspace_widget(experiment.workspace, "instrument")
        if not instrument.is_present:
            raise ValueError("LC-MS/MS instrument is not deployed on the bench.")

        rack_widget = find_workspace_widget(experiment.workspace, "rack")
        if not rack_widget.is_present:
            raise ValueError("Autosampler rack is not deployed.")
        if experiment.rack.state == "locked":
            raise ValueError("The autosampler rack cannot be unloaded during an acquisition.")
        if experiment.rack.state not in {"loaded", "completed"}:
            raise ValueError("The autosampler rack is not loaded into the LC-MS/MS.")

        experiment.rack.state = "available"
        experiment.audit_log.append("Autosampler rack unloaded from the LC-MS/MS.")


@dataclass(frozen=True, slots=True)
class AcquisitionSequenceLineRequest:
    rack_slot_id: str
    sample_name: str
    injection_volume_ul: float
    repetitions: int
    output_filename: str


@dataclass(frozen=True, slots=True)
class RunSequenceRequest:
    method_id: str
    injections: list[AcquisitionSequenceLineRequest]


class RunSequenceService(WriteDomainService[RunSequenceRequest]):
    def __init__(self, runtime: ExperimentRuntime, rng: random.Random | None = None) -> None:
        super().__init__(runtime)
        # Injectable so a test can reproduce a whole acquisition byte for byte.
        self._rng = rng if rng is not None else random.Random()

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
        if experiment.rack.state != "loaded":
            raise ValueError("The autosampler rack is not loaded into the LC-MS/MS.")

        method = get_acquisition_method(request.method_id)
        configured_by_slot = _validate_acquisition_sequence(request, vials_in_rack)

        injections: list[InjectionMeasurement] = []
        for rack_slot in vials_in_rack:
            vial = rack_slot.tool
            assert vial is not None  # guaranteed by the filter above
            configured = configured_by_slot[rack_slot.id]

            for replicate_index in range(1, configured.repetitions + 1):
                if vial.calibration_context is not None:
                    status = "calibration"
                    responses = _compute_calibration_responses(vial.calibration_context)
                elif vial.injection_context is None:
                    status = "no_extract_context"
                    responses = {}
                else:
                    status = "ok"
                    responses = _compute_sample_responses(vial, vial.injection_context)

                injection_id = new_id("inj")
                # An empty vial is still injected and still records every channel:
                # the run produces flat traces rather than no data at all.
                traces = generate_transition_traces(
                    injection_id, method, responses, self._rng
                )
                injections.append(
                    InjectionMeasurement(
                        id=injection_id,
                        vial_id=vial.id,
                        vial_label=vial.label,
                        rack_slot_id=rack_slot.id,
                        status=status,
                        traces=traces,
                        sample_name=configured.sample_name.strip(),
                        injection_volume_ul=configured.injection_volume_ul,
                        replicate_index=replicate_index,
                        output_filename=_replicate_output_filename(
                            configured.output_filename.strip(),
                            replicate_index,
                            configured.repetitions,
                        ),
                    )
                )

        run = SequenceRun(
            id=new_id("seq"),
            injections=injections,
            method_id=method.id,
            method_snapshot=snapshot_acquisition_method(method),
        )
        instrument.sequence_runs.append(run)
        experiment.rack.state = "completed"

        n_ok = sum(1 for inj in injections if inj.status == "ok")
        experiment.audit_log.append(
            f"LC-MS/MS sequence run {run.id}: {len(injections)} vial(s) injected, "
            f"{n_ok} with extract context."
        )


def _validate_acquisition_sequence(
    request: RunSequenceRequest,
    occupied_slots: list[RackSlot],
) -> dict[str, AcquisitionSequenceLineRequest]:
    occupied_slot_ids = [slot.id for slot in occupied_slots]
    configured_slot_ids = [line.rack_slot_id for line in request.injections]
    if len(configured_slot_ids) != len(set(configured_slot_ids)):
        raise ValueError("Each occupied rack position must appear exactly once.")
    if set(configured_slot_ids) != set(occupied_slot_ids):
        raise ValueError("The acquisition sequence must match the occupied rack positions.")

    filenames: set[str] = set()
    for line in request.injections:
        if not line.sample_name.strip():
            raise ValueError("Every acquisition line requires a sample name.")
        if line.injection_volume_ul <= 0 or line.injection_volume_ul > 100:
            raise ValueError("Injection volume must be between 0 and 100 µL.")
        if line.repetitions < 1 or line.repetitions > 10:
            raise ValueError("Repetitions must be between 1 and 10.")
        output_filename = line.output_filename.strip()
        if not output_filename.lower().endswith(".mzml"):
            raise ValueError("Every output filename must end with .mzML.")
        for replicate_index in range(1, line.repetitions + 1):
            result_filename = _replicate_output_filename(
                output_filename,
                replicate_index,
                line.repetitions,
            ).lower()
            if result_filename in filenames:
                raise ValueError("Output filenames must be unique.")
            filenames.add(result_filename)

    return {line.rack_slot_id: line for line in request.injections}


def _replicate_output_filename(
    output_filename: str,
    replicate_index: int,
    repetitions: int,
) -> str:
    if repetitions == 1:
        return output_filename
    stem = output_filename[:-5]
    return f"{stem}_r{replicate_index}.mzML"


# ---------------------------------------------------------------------------
# Add calibration standard to vial
# ---------------------------------------------------------------------------

@dataclass(frozen=True, slots=True)
class AddCalibrationToVialRequest:
    vial_tool_id: str
    level_ng_per_ml: float


def apply_calibration_standard(
    experiment: Experiment,
    vial: WorkbenchTool,
    level_ng_per_ml: float,
) -> None:
    """Mark ``vial`` as a multi-residue calibration standard at ``level_ng_per_ml``.

    Draws the hidden true concentration, records the calibration context and adds the
    calibration solution. Shared by the manual ``AddCalibrationToVialService`` drop and
    the debug calibration-vial preset so both prepare an identical standard.
    """
    from app.domain.dnd_rules import can_tool_receive_liquids
    from app.domain.pesticide_catalog import APPLE_PESTICIDE_CATALOG

    if level_ng_per_ml <= 0:
        raise ValueError("Calibration level must be positive.")
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
    true_level = round(PhysicalSimulationService.draw_prepared_level(level_ng_per_ml), 6)
    vial.calibration_context = CalibrationContext(
        level_ng_per_ml=round(level_ng_per_ml, 4),
        compound_ids=compound_ids,
        true_level_ng_per_ml=true_level,
    )
    add_liquid_to_tool(
        experiment,
        vial,
        liquid_id="calibration_solution",
        volume_ml=CALIBRATION_STANDARD_VOLUME_ML,
    )


class AddCalibrationToVialService(WriteDomainService[AddCalibrationToVialRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: AddCalibrationToVialRequest) -> None:
        vial = _find_tool_anywhere(experiment, request.vial_tool_id)
        if vial is None:
            raise ValueError("Tool not found.")
        apply_calibration_standard(experiment, vial, request.level_ng_per_ml)
        experiment.audit_log.append(
            f"Calibration standard {request.level_ng_per_ml} ng/mL prepared in {vial.label}."
        )


def _compute_calibration_responses(ctx: CalibrationContext) -> dict[str, float]:
    """Extract concentration seen by the detector for a calibration standard.

    A pure solution carries no extraction variance: the response follows the
    truly prepared concentration, with environmental noise only.
    """
    true_level = ctx.true_level_ng_per_ml if ctx.true_level_ng_per_ml is not None else ctx.level_ng_per_ml
    return {
        compound_id: round(true_level * random.gauss(1.0, ENV_NOISE_SIGMA), 6)
        for compound_id in ctx.compound_ids
    }


def _compute_sample_responses(
    vial: WorkbenchTool, ctx: InjectionContext
) -> dict[str, float]:
    """Apply the two-tier variance model to get per-compound detector responses.

    Returns the concentration reaching the detector for each compound, plus the
    internal standard under its own compound id when one was added. Everything
    downstream of this — ratios, calibration curves, concentrations — belongs to
    the analysis application, not to Betalab.
    """
    del vial  # physics lives entirely in the injection context
    responses: dict[str, float] = {}
    extraction_result = ctx.extraction_result

    extraction_manip = extraction_result.extraction_manip_factor if extraction_result else 1.0
    istd_manip = extraction_result.istd_manip_factor if extraction_result else None

    # Resolve true vs nominal volumes with fallbacks
    extract_true_v = ctx.extract_true_volume_ml if ctx.extract_true_volume_ml is not None else ctx.extract_volume_ml
    if not extract_true_v:
        extract_true_v = ctx.extract_volume_ml or 1.0
    istd_true_v = ctx.istd_true_volume_ml if ctx.istd_true_volume_ml is not None else ctx.istd_volume_ml
    sample_true_mass_g = (
        ctx.sample_true_mass_g
        if ctx.sample_true_mass_g is not None
        else ctx.sample_mass_g
    )

    for compound_id, true_effective_ug_per_kg in ctx.effective_residues_ug_per_kg.items():
        # Pesticide amount in the extract (ng) — same unit convention as before
        pesticide_amount_ng = true_effective_ug_per_kg * sample_true_mass_g * 1e-3

        env_pest = random.gauss(1.0, ENV_NOISE_SIGMA)
        # Concentration in the extract using the TRUE delivered solvent volume
        pesticide_conc = (pesticide_amount_ng * extraction_manip) / extract_true_v
        responses[compound_id] = round(pesticide_conc * env_pest, 6)

    if istd_true_v is not None and istd_manip is not None:
        # The ISTD travelled with the sample through the extraction, so it carries
        # its own manip factor and the same true solvent volume. Its channel is a
        # transition like any other; whether it is used to correct anything is the
        # analysis application's decision.
        istd_amount_ng_true = istd_true_v * ctx.istd_reference_conc_ng_per_ml
        istd_conc = (istd_amount_ng_true * istd_manip) / extract_true_v
        responses[INTERNAL_STANDARD_COMPOUND_ID] = round(
            istd_conc * random.gauss(1.0, ENV_NOISE_SIGMA), 6
        )

    return responses
