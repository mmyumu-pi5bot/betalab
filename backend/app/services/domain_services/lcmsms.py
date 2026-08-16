"""LC-MS/MS domain services: pour extract from tube to vial, run sequence."""
from __future__ import annotations

import random
from collections.abc import Callable
from dataclasses import dataclass

from app.domain.acquisition_methods import (
    AcquisitionMethod,
    snapshot_acquisition_method,
)
from app.domain.dnd_rules import can_tool_seal
from app.domain.models import (
    CalibrationContext,
    Experiment,
    InjectionContext,
    InjectionMeasurement,
    ProduceLot,
    ProduceMaterialState,
    QuechersExtractionResult,
    RackSlot,
    SequenceRun,
    WorkbenchTool,
    new_id,
)
from app.domain.mrm_reference import (
    INTERNAL_STANDARD_COMPOUND_ID,
    reference_transitions_for,
)
from app.domain.pesticide_catalog import generate_pesticide_residues
from app.services.acquisition_method_service import acquisition_method_service
from app.services.domain_services.acquisition_clock import (
    is_sequence_complete,
    skip_to_end_of_sequence,
)
from app.services.domain_services.base import ExperimentRuntime, WriteDomainService
from app.services.domain_services.mrm_signal import generate_transition_traces
from app.services.helpers.lookups import find_workspace_widget
from app.services.helpers.produce_canonical import collect_produce_lots
from app.services.helpers.produce_material_states import find_material_state
from app.services.helpers.tool_liquids import add_liquid_to_tool
from app.services.physical_simulation_service import PhysicalSimulationService

ISTD_SOLUTION_ID = "istd_solution"
ACETONITRILE_ID = "acetonitrile_extraction"
APPLE_EXTRACT_ID = "apple_extract"
ISTD_REFERENCE_CONC_NG_PER_ML = 100.0
CALIBRATION_STANDARD_VOLUME_ML = 1.0
#: Aliquot a technician pipettes from a separated extract into an autosampler vial.
PREPARED_EXTRACT_ALIQUOT_ML = 1.0
ENV_NOISE_SIGMA = 0.005  # 0.5% environmental noise per measurement
#: Volume the autosampler needle cannot reach at the bottom of a vial. A vial is
#: never emptied to the last drop, so a sequence must leave this much behind.
VIAL_DEAD_VOLUME_ML = 0.05


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
    # A wetted portion gets a material state of its own, distinct from the one
    # describing the stock it was scooped from, and both carry the same lot id.
    # Resolving by lot id alone returns whichever comes first -- usually the
    # untouched powder still in the jar -- so the exotherm's cost would show up
    # or not depending on where the two containers sat on the bench.
    states_by_id = {state.id: state for state in material_states}

    total_mass_g: dict[str, float] = {}
    weighted_residues: dict[str, dict[str, float]] = {}

    for fraction in produce_fractions:
        lot_id = fraction.produce_lot_id
        lot = lot_map.get(lot_id)
        if lot is None or not lot.pesticide_residues:
            continue
        state = states_by_id.get(fraction.produce_material_state_id) or find_material_state(
            material_states, lot_id
        )
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


def _vial_total_volume_ml(vial: WorkbenchTool) -> float:
    return sum(max(liquid.volume_ml, 0.0) for liquid in vial.liquids)


def _draw_injection_volume(vial: WorkbenchTool, injection_volume_ul: float) -> None:
    """Withdraw one injected aliquot from the vial.

    An injection really removes liquid: a few microlitres leave the vial and do
    not come back, which is why a vial cannot be re-injected forever. The draw is
    proportional across the vial's liquids, since the autosampler samples a
    homogeneous solution — the composition is unchanged, only the volume drops.
    """
    drawn_ml = injection_volume_ul / 1000.0
    total_ml = _vial_total_volume_ml(vial)
    if total_ml <= 0 or drawn_ml <= 0:
        return
    remaining_share = max(0.0, 1.0 - drawn_ml / total_ml)
    for liquid in vial.liquids:
        liquid.volume_ml = round(max(liquid.volume_ml * remaining_share, 0.0), 6)
        if liquid.true_volume_ml is not None:
            liquid.true_volume_ml = round(
                max(liquid.true_volume_ml * remaining_share, 0.0), 6
            )


def _reference_retention_time_s(compound_id: str) -> float | None:
    """When a compound truly elutes, read from the hidden reference catalog.

    Suppression is local in time, so the signal model needs the real elution
    moment — not the one a method happens to declare. ``None`` for a compound
    the catalog does not know, which callers must not read as "elutes at zero".
    """
    references = reference_transitions_for(compound_id)
    if not references:
        return None
    quantifier = next(
        (reference for reference in references if reference.role == "quantifier"),
        references[0],
    )
    return quantifier.expected_retention_time_s


def _aliquot_homogeneity(
    produce_fractions: list,
    material_states: list[ProduceMaterialState],
) -> float | None:
    """Mass-weighted grind homogeneity of the powder weighed into the tube."""
    total_mass_g = 0.0
    weighted = 0.0
    for fraction in produce_fractions:
        state = find_material_state(material_states, fraction.produce_lot_id)
        if state is None or state.homogeneity_score is None:
            continue
        mass = fraction.true_mass_g if fraction.true_mass_g is not None else fraction.mass_g
        total_mass_g += mass
        weighted += state.homogeneity_score * mass
    if total_mass_g <= 0:
        return None
    return weighted / total_mass_g


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
    # A weighed test portion is a fraction: the spatula moves powder into the
    # tube while the ProduceLot carrying the residue concentrations stays in the
    # jar it was scooped from. So the lot behind a fraction has to be looked up
    # experiment-wide — restricting the search to the tube or to bench surfaces
    # silently yields no residues, and the sample injects as a blank.
    all_lots: list[ProduceLot] = list(tube.produce_lots)
    known_lot_ids = {lot.id for lot in all_lots}
    experiment_lots = collect_produce_lots(experiment)
    for fraction in tube.produce_fractions:
        if fraction.produce_lot_id in known_lot_ids:
            continue
        lot = experiment_lots.get(fraction.produce_lot_id)
        if lot is not None:
            all_lots.append(lot)
            known_lot_ids.add(lot.id)

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

    # Drawn once per tube and memoised on its extraction result: two vials poured
    # from the same extract come from the same weighed aliquot, so they must
    # carry the same sampling bias.
    extraction_result = tube.quechers_extraction_result
    if extraction_result is not None and extraction_result.sampling_representativeness is None:
        extraction_result.sampling_representativeness = (
            PhysicalSimulationService.draw_sampling_representativeness(
                _aliquot_homogeneity(
                    tube.produce_fractions, experiment.produce_material_states
                )
            )
        )

    # Grime carried in with the powder: measured container contacts, plus a
    # nominal credit for anything left on a dirty bench. The poured aliquot takes
    # its share like everything else in the tube.
    foreign_matter_mg = sum(
        fraction.impurity_mass_mg
        + (
            PhysicalSimulationService.contaminated_fraction_impurity_mg
            if fraction.is_contaminated
            else 0.0
        )
        for fraction in tube.produce_fractions
    )

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
        foreign_matter_mass_mg=round(foreign_matter_mg * volume_ratio, 6),
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

        # Placing an uncapped vial in the rack is allowed — it is a real mistake a
        # technician can make, and the rack shows it. The autosampler is where it
        # stops: the needle pierces a septum, and an open vial would evaporate.
        open_positions = [
            slot.label
            for slot in experiment.rack.slots
            if slot.tool is not None
            and can_tool_seal(slot.tool.tool_type)
            and not slot.tool.is_sealed
        ]
        if open_positions:
            raise ValueError(
                "Close every vial before loading the rack: "
                f"{', '.join(open_positions)} still open."
            )

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
class SkipAcquisitionRequest:
    """No payload: skipping applies to whatever sequence is currently running."""


class SkipAcquisitionService(WriteDomainService[SkipAcquisitionRequest]):
    """Fast-forward a running sequence to its end.

    The traces were generated in full when the sequence started, so skipping
    reveals the data the run would have produced anyway. It changes how long the
    user waits, never what the instrument recorded.
    """

    def _run(self, experiment: Experiment, request: SkipAcquisitionRequest) -> None:
        del request
        instrument = find_workspace_widget(experiment.workspace, "instrument")
        running = [
            run for run in instrument.sequence_runs if not is_sequence_complete(run)
        ]
        if not running:
            raise ValueError("No acquisition is currently running.")
        for run in running:
            skip_to_end_of_sequence(experiment, run)


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
    def __init__(
        self,
        runtime: ExperimentRuntime,
        rng: random.Random | None = None,
        method_resolver: Callable[[str], AcquisitionMethod] | None = None,
    ) -> None:
        super().__init__(runtime)
        # Injectable so a test can reproduce a whole acquisition byte for byte.
        self._rng = rng if rng is not None else random.Random()
        # Resolves built-in *and* user-authored methods; injectable for tests.
        self._resolve_method = (
            method_resolver
            if method_resolver is not None
            else acquisition_method_service.get_method
        )

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

        method = self._resolve_method(request.method_id)
        configured_by_slot = _validate_acquisition_sequence(request, vials_in_rack)

        injections: list[InjectionMeasurement] = []
        # Injections run one after the other, each paying the method's full
        # chromatographic run time.
        start_offset_s = 0.0
        for rack_slot in vials_in_rack:
            vial = rack_slot.tool
            assert vial is not None  # guaranteed by the filter above
            configured = configured_by_slot[rack_slot.id]

            for replicate_index in range(1, configured.repetitions + 1):
                # The needle cannot reach the bottom of the vial. A vial drained
                # by earlier injections is still injected — the autosampler tries
                # — but draws nothing, so every channel records baseline.
                held_ml = _vial_total_volume_ml(vial)
                is_dry = (
                    held_ml > 0
                    and held_ml - VIAL_DEAD_VOLUME_ML
                    < configured.injection_volume_ul / 1000.0
                )
                if is_dry:
                    status = "insufficient_volume"
                    responses = {}
                    foreign_matter_mg = 0.0
                elif vial.calibration_context is not None:
                    status = "calibration"
                    responses = _compute_calibration_responses(vial.calibration_context)
                    # A standard is prepared in clean solvent: no grime, no matrix.
                    foreign_matter_mg = 0.0
                elif vial.injection_context is None:
                    status = "no_extract_context"
                    responses = {}
                    foreign_matter_mg = 0.0
                else:
                    status = "ok"
                    responses = _compute_sample_responses(vial, vial.injection_context)
                    foreign_matter_mg = vial.injection_context.foreign_matter_mass_mg

                if not is_dry:
                    _draw_injection_volume(vial, configured.injection_volume_ul)
                injection_id = new_id("inj")
                # An empty vial is still injected and still records every channel:
                # the run produces flat traces rather than no data at all.
                traces = generate_transition_traces(
                    injection_id,
                    method,
                    responses,
                    self._rng,
                    foreign_matter_mg,
                    configured.injection_volume_ul,
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
                        start_offset_s=start_offset_s,
                    )
                )
                start_offset_s += method.runtime_s

        run = SequenceRun(
            id=new_id("seq"),
            injections=injections,
            method_id=method.id,
            method_snapshot=snapshot_acquisition_method(method),
            total_duration_s=start_offset_s,
        )
        instrument.sequence_runs.append(run)
        # The rack stays in the autosampler until the last injection is recorded.
        experiment.rack.state = "locked"

        experiment.audit_log.append(
            f"LC-MS/MS sequence run {run.id} started: {len(injections)} injection(s), "
            f"{run.total_duration_s:.0f} s of acquisition."
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


def apply_prepared_extract(
    experiment: Experiment,
    vial: WorkbenchTool,
    *,
    sample_mass_g: float,
    extract_volume_ml: float,
    extraction_recovery: float,
    sampling_accuracy: float,
    istd_volume_ml: float,
) -> None:
    """Fill ``vial`` with a finished apple extract, skipping the whole QuEChERS prep.

    Leaves exactly what the manual path leaves behind once a supernatant has been
    pipetted into a vial: a ``PREPARED_EXTRACT_ALIQUOT_ML`` aliquot of the tube's
    extract, its share of the internal standard, and the injection context carrying
    the residues and the extraction variance. ``sample_mass_g`` and
    ``extract_volume_ml`` describe the *tube* the aliquot was taken from, so the
    dilution behaves like the real one.

    The factors a real prep draws at random — extraction recovery and how well the
    weighed aliquot represented the lot — are supplied by the caller instead, so a
    debug vial injects reproducibly at a chosen preparation quality.
    """
    if sample_mass_g <= 0:
        raise ValueError("Apple mass must be greater than zero.")
    if extract_volume_ml <= 0:
        raise ValueError("Extract volume must be greater than zero.")
    if extraction_recovery <= 0:
        raise ValueError("Extraction recovery must be greater than zero.")
    if sampling_accuracy <= 0:
        raise ValueError("Sampling accuracy must be greater than zero.")
    if istd_volume_ml < 0:
        raise ValueError("ISTD volume cannot be negative.")
    if vial.calibration_context is not None:
        raise ValueError(f"{vial.label} already contains a calibration standard.")
    if vial.injection_context is not None:
        raise ValueError(f"{vial.label} already contains a sample extract.")

    # The aliquot cannot be larger than the extract it is taken from.
    aliquot_ml = min(PREPARED_EXTRACT_ALIQUOT_ML, extract_volume_ml)
    volume_ratio = aliquot_ml / extract_volume_ml
    vial_istd_volume_ml = round(istd_volume_ml * volume_ratio, 6)

    add_liquid_to_tool(experiment, vial, liquid_id=ACETONITRILE_ID, volume_ml=aliquot_ml)
    if vial_istd_volume_ml > 0:
        add_liquid_to_tool(
            experiment, vial, liquid_id=ISTD_SOLUTION_ID, volume_ml=vial_istd_volume_ml
        )

    recovery = round(extraction_recovery, 4)
    vial.injection_context = InjectionContext(
        source_tube_id=new_id("debug_tube"),
        sample_mass_g=round(sample_mass_g * volume_ratio, 4),
        sample_true_mass_g=round(sample_mass_g * volume_ratio, 6),
        extract_volume_ml=round(aliquot_ml, 3),
        extract_true_volume_ml=round(aliquot_ml, 6),
        effective_residues_ug_per_kg=generate_pesticide_residues("apple"),
        extraction_result=QuechersExtractionResult(
            extraction_manip_factor=recovery,
            # The standard was added before the solvent, so it shares the tube's
            # single recovery draw and the ratio can correct against it.
            istd_manip_factor=recovery if vial_istd_volume_ml > 0 else None,
            istd_phase="pre_solvent" if vial_istd_volume_ml > 0 else None,
            sampling_representativeness=round(sampling_accuracy, 4),
        ),
        istd_volume_ml=round(vial_istd_volume_ml, 4) if vial_istd_volume_ml > 0 else None,
        istd_true_volume_ml=vial_istd_volume_ml if vial_istd_volume_ml > 0 else None,
        istd_reference_conc_ng_per_ml=ISTD_REFERENCE_CONC_NG_PER_ML,
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
    # The weighed aliquot may not represent the lot. This multiplies the residues
    # only: the internal standard was pipetted into the tube afterwards, so it
    # never carries the sampling error and the ratio cannot correct it.
    sampling_bias = (
        extraction_result.sampling_representativeness
        if extraction_result is not None
        and extraction_result.sampling_representativeness is not None
        else 1.0
    )

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

    # How much sample each injected millilitre carries. A calibration standard
    # in pure solvent has none, which is why it is never suppressed.
    matrix_load = PhysicalSimulationService.matrix_load_g_per_ml(
        sample_true_mass_g, extract_true_v
    )

    for compound_id, true_effective_ug_per_kg in ctx.effective_residues_ug_per_kg.items():
        # Pesticide amount in the extract (ng) — same unit convention as before
        pesticide_amount_ng = true_effective_ug_per_kg * sample_true_mass_g * 1e-3

        env_pest = random.gauss(1.0, ENV_NOISE_SIGMA)
        suppression = PhysicalSimulationService.matrix_suppression_factor(
            matrix_load, _reference_retention_time_s(compound_id)
        )
        # Concentration in the extract using the TRUE delivered solvent volume
        pesticide_conc = (
            pesticide_amount_ng * extraction_manip * sampling_bias * suppression
        ) / extract_true_v
        responses[compound_id] = round(pesticide_conc * env_pest, 6)

    if istd_true_v is not None and istd_manip is not None:
        # The ISTD travelled with the sample through the extraction, so it carries
        # its own manip factor and the same true solvent volume. Its channel is a
        # transition like any other; whether it is used to correct anything is the
        # analysis application's decision.
        istd_amount_ng_true = istd_true_v * ctx.istd_reference_conc_ng_per_ml
        # The standard is suppressed too, but at *its own* retention time. That is
        # why it corrects a co-eluting compound well and a distant one badly.
        istd_suppression = PhysicalSimulationService.matrix_suppression_factor(
            matrix_load, _reference_retention_time_s(INTERNAL_STANDARD_COMPOUND_ID)
        )
        istd_conc = (istd_amount_ng_true * istd_manip * istd_suppression) / extract_true_v
        responses[INTERNAL_STANDARD_COMPOUND_ID] = round(
            istd_conc * random.gauss(1.0, ENV_NOISE_SIGMA), 6
        )

    return responses
