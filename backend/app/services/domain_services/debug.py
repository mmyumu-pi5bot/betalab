from __future__ import annotations

from dataclasses import dataclass

from app.domain.dnd_rules import can_tool_seal
from app.domain.models import (
    Experiment,
    ProduceFraction,
    ProduceFractionLocationKind,
    ProduceLot,
    WorkbenchLiquid,
    WorkbenchTool,
    new_id,
)
from app.domain.pesticide_catalog import generate_pesticide_residues
from app.services.dnd_move_service import DndObjectRef, place_new_tool
from app.services.domain_services.base import ExperimentRuntime, WriteDomainService
from app.services.domain_services.gross_balance import GrossBalanceProduceLotTarget
from app.services.domain_services.lcmsms import (
    apply_calibration_standard,
    apply_prepared_extract,
)
from app.services.helpers.lookups import find_workbench_slot
from app.services.helpers.produce_canonical import set_lot_fraction_temperatures
from app.services.helpers.produce_material_states import set_material_state_name, update_material_state
from app.services.helpers.tool_liquids import ACETONITRILE_ID
from app.services.helpers.workbench import build_workbench_tool
from app.services.physical_simulation_service import PhysicalSimulationService
from app.services.transfer import GrinderProduceLotTarget, WorkbenchProduceLotTarget
from app.domain.journal_codes import JournalCode
from app.services.journal_refs import produce_ref, slot_ref, text_ref, tool_ref
from app.services.journal_service import record_journal

_physical_simulation_service = PhysicalSimulationService()

# Debug tube presets that prefill a 50 mL centrifuge tube with apple slurry.
_RAW_SLURRY_TUBE_PRESET = "apple_slurry_centrifuge_tube"
_VORTEXED_SLURRY_TUBE_PRESET = "vortexed_slurry_centrifuge_tube"
_SEPARATED_SLURRY_TUBE_PRESET = "separated_slurry_centrifuge_tube"
_SLURRY_TUBE_PRESETS = frozenset({_RAW_SLURRY_TUBE_PRESET, _VORTEXED_SLURRY_TUBE_PRESET, _SEPARATED_SLURRY_TUBE_PRESET})
_SLURRY_PRESET_LABELS = {
    _RAW_SLURRY_TUBE_PRESET: "Apple slurry",
    _VORTEXED_SLURRY_TUBE_PRESET: "vortexed apple slurry",
    _SEPARATED_SLURRY_TUBE_PRESET: "centrifuged apple slurry",
}

# Debug calibration stock: a tube of multi-residue standard at a known concentration
# that the user pipettes into a rack vial themselves (the pipette carries the
# calibration identity across — see AspiratePipetteService). The vial variant is not
# a debug affordance any more: the standards shelf in the real palette hands out
# ready-to-use calibration vials — see PlaceCalibrationStandardVialService.
_CALIBRATION_TUBE_PRESET = "calibration_standard_tube"
_CALIBRATION_PRESETS = frozenset({_CALIBRATION_TUBE_PRESET})
_CALIBRATION_PRESET_TOOL_IDS = {
    _CALIBRATION_TUBE_PRESET: "centrifuge_tube_50ml",
}
_DEFAULT_CALIBRATION_LEVEL_NG_PER_ML = 100.0

# Debug preset that spawns an autosampler vial already holding a finished apple
# extract — the whole grind/extract/centrifuge/pipette chain skipped in one drop.
# Its parameters describe the preparation the vial pretends to come from: how much
# apple in how much solvent, and how well the prep went.
_EXTRACT_VIAL_PRESET = "apple_extract_vial"
_EXTRACT_VIAL_TOOL_ID = "sample_vial_lcms"
_DEFAULT_EXTRACT_APPLE_MASS_G = 10.0
_DEFAULT_EXTRACT_VOLUME_ML = 10.0
_DEFAULT_EXTRACTION_RECOVERY_PERCENT = 92.0
_DEFAULT_SAMPLING_ACCURACY_PERCENT = 100.0
_DEFAULT_EXTRACT_ISTD_VOLUME_ML = 0.1


@dataclass(frozen=True, slots=True)
class CreateDebugProduceLotOnWorkbenchRequest:
    preset_id: str
    target_slot_id: str
    total_mass_g: float | None = None
    temperature_c: float | None = None
    residual_co2_mass_g: float | None = None


@dataclass(frozen=True, slots=True)
class CreateDebugProduceLotToWidgetRequest:
    preset_id: str
    widget_id: str
    total_mass_g: float | None = None
    temperature_c: float | None = None
    residual_co2_mass_g: float | None = None


@dataclass(frozen=True, slots=True)
class CreateDebugToolPresetRequest:
    preset_id: str
    destination_kind: str
    destination_id: str
    produce_mass_g: float | None = None
    temperature_c: float | None = None
    level_ng_per_ml: float | None = None
    extract_volume_ml: float | None = None
    extraction_recovery_percent: float | None = None
    sampling_accuracy_percent: float | None = None
    istd_volume_ml: float | None = None


class CreateDebugProduceLotOnWorkbenchService(WriteDomainService[CreateDebugProduceLotOnWorkbenchRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: CreateDebugProduceLotOnWorkbenchRequest) -> None:
        produce_lot = _build_debug_produce_lot(
            request.preset_id,
            total_mass_g=request.total_mass_g,
            temperature_c=request.temperature_c,
            residual_co2_mass_g=request.residual_co2_mass_g,
        )
        set_material_state_name(experiment.produce_material_states, produce_lot.id, "ground")
        update_material_state(
            experiment.produce_material_states,
            produce_lot.id,
            grind_quality_label="powder_fine",
            homogeneity_score=0.96,
            residual_co2_mass_g=(request.residual_co2_mass_g if request.residual_co2_mass_g is not None else 18.0),
        )
        target = WorkbenchProduceLotTarget(slot_id=request.target_slot_id)
        target.validate(experiment)
        placement = target.place(experiment, produce_lot)
        set_lot_fraction_temperatures(experiment, produce_lot.id, produce_lot_temperature_c(request.temperature_c))
        record_journal(
            experiment,
            JournalCode.DEBUG_PRODUCE_SPAWNED_ON,
            produce=produce_ref(produce_lot),
            target=text_ref(placement.target_label),
        )


class CreateDebugProduceLotToWidgetService(WriteDomainService[CreateDebugProduceLotToWidgetRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: CreateDebugProduceLotToWidgetRequest) -> None:
        produce_lot = _build_debug_produce_lot(
            request.preset_id,
            total_mass_g=request.total_mass_g,
            temperature_c=request.temperature_c,
            residual_co2_mass_g=request.residual_co2_mass_g,
        )
        set_material_state_name(experiment.produce_material_states, produce_lot.id, "ground")
        update_material_state(
            experiment.produce_material_states,
            produce_lot.id,
            grind_quality_label="powder_fine",
            homogeneity_score=0.96,
            residual_co2_mass_g=(request.residual_co2_mass_g if request.residual_co2_mass_g is not None else 18.0),
        )
        if request.widget_id == "gross_balance":
            target = GrossBalanceProduceLotTarget()
        else:
            target = GrinderProduceLotTarget(widget_id=request.widget_id)
        target.validate(experiment)
        placement = target.place(experiment, produce_lot)
        set_lot_fraction_temperatures(experiment, produce_lot.id, produce_lot_temperature_c(request.temperature_c))
        record_journal(
            experiment,
            JournalCode.DEBUG_PRODUCE_SPAWNED_IN,
            produce=produce_ref(produce_lot),
            target=text_ref(placement.target_label),
        )


class CreateDebugToolPresetService(WriteDomainService[CreateDebugToolPresetRequest]):
    def _run(self, experiment: Experiment, request: CreateDebugToolPresetRequest) -> None:
        if request.preset_id in _CALIBRATION_PRESETS:
            self._spawn_calibration_standard(experiment, request)
            return
        if request.preset_id == _EXTRACT_VIAL_PRESET:
            self._spawn_prepared_extract_vial(experiment, request)
            return
        if request.preset_id not in _SLURRY_TUBE_PRESETS:
            raise ValueError("Unknown debug tool preset")
        self._spawn_slurry_tube(experiment, request)

    def _spawn_slurry_tube(self, experiment: Experiment, request: CreateDebugToolPresetRequest) -> None:
        produce_mass_g = request.produce_mass_g if request.produce_mass_g is not None else 10.0
        temperature_c = request.temperature_c if request.temperature_c is not None else 20.0
        if produce_mass_g <= 0:
            raise ValueError("Produce mass must be greater than zero.")
        if request.destination_kind == "workbench_tool":
            slot = find_workbench_slot(experiment.workbench, request.destination_id)
            if slot.tool is None or slot.tool.tool_type not in {"centrifuge_tube", "sample_vial"}:
                raise ValueError("Apple slurry requires a centrifuge tube or autosampler vial.")
            if slot.tool.is_sealed:
                raise ValueError(f"Open {slot.tool.label} before adding apple slurry.")
            if slot.tool.produce_lots or slot.tool.produce_fractions:
                raise ValueError(f"{slot.tool.label} already contains produce.")
            tool = slot.tool
            _fill_tool_with_debug_slurry(
                experiment,
                tool,
                produce_mass_g=produce_mass_g,
                temperature_c=temperature_c,
                location_kind="workbench_tool",
                location_id=slot.id,
            )
            _apply_slurry_extract_preset(request.preset_id, tool)
            record_journal(
                experiment,
                JournalCode.DEBUG_SLURRY_ADDED,
                preset=_SLURRY_PRESET_LABELS[request.preset_id],
                tool=tool_ref(tool),
                location=slot_ref(slot),
            )
            return

        tool = build_workbench_tool("centrifuge_tube_50ml")
        _fill_tool_with_debug_slurry(
            experiment,
            tool,
            produce_mass_g=produce_mass_g,
            temperature_c=temperature_c,
            location_kind="workbench_tool",
            location_id=tool.id,
        )
        _apply_slurry_extract_preset(request.preset_id, tool)

        place_new_tool(
            self._runtime,
            experiment,
            tool,
            DndObjectRef(kind=request.destination_kind, id=request.destination_id),
            source_label="Debug palette",
        )
        if request.destination_kind == "trash_bin":
            location_kind: ProduceFractionLocationKind = "trash"
        elif request.destination_kind == "workbench_slot":
            location_kind = "workbench_tool"
        else:
            location_kind = "workspace_widget_tool"
        location_id = tool.id if request.destination_kind == "trash_bin" else request.destination_id
        for fraction in tool.produce_fractions:
            fraction.location_kind = location_kind
            fraction.location_id = location_id

    def _spawn_calibration_standard(self, experiment: Experiment, request: CreateDebugToolPresetRequest) -> None:
        level_ng_per_ml = request.level_ng_per_ml if request.level_ng_per_ml is not None else _DEFAULT_CALIBRATION_LEVEL_NG_PER_ML
        if request.destination_kind == "workbench_tool":
            slot = find_workbench_slot(experiment.workbench, request.destination_id)
            if slot.tool is None or slot.tool.tool_type not in {"sample_vial", "centrifuge_tube"}:
                raise ValueError("A calibration standard requires an autosampler vial or centrifuge tube.")
            if slot.tool.is_sealed:
                raise ValueError(f"Open {slot.tool.label} before adding a calibration standard.")
            container = slot.tool
            apply_calibration_standard(experiment, container, level_ng_per_ml)
            record_journal(
                experiment,
                JournalCode.DEBUG_CALIBRATION_ADDED,
                level=level_ng_per_ml,
                tool=tool_ref(container),
                location=slot_ref(slot),
            )
            return

        container = build_workbench_tool(_CALIBRATION_PRESET_TOOL_IDS[request.preset_id])
        apply_calibration_standard(experiment, container, level_ng_per_ml)
        place_new_tool(
            self._runtime,
            experiment,
            container,
            DndObjectRef(kind=request.destination_kind, id=request.destination_id),
            source_label="Debug palette",
        )
        _cap_vial_spawned_into_rack(container, request.destination_kind)

    def _spawn_prepared_extract_vial(self, experiment: Experiment, request: CreateDebugToolPresetRequest) -> None:
        apply_kwargs = {
            "sample_mass_g": _value_or_default(request.produce_mass_g, _DEFAULT_EXTRACT_APPLE_MASS_G),
            "extract_volume_ml": _value_or_default(request.extract_volume_ml, _DEFAULT_EXTRACT_VOLUME_ML),
            "extraction_recovery": _value_or_default(request.extraction_recovery_percent, _DEFAULT_EXTRACTION_RECOVERY_PERCENT) / 100.0,
            "sampling_accuracy": _value_or_default(request.sampling_accuracy_percent, _DEFAULT_SAMPLING_ACCURACY_PERCENT) / 100.0,
            "istd_volume_ml": _value_or_default(request.istd_volume_ml, _DEFAULT_EXTRACT_ISTD_VOLUME_ML),
        }

        if request.destination_kind == "workbench_tool":
            slot = find_workbench_slot(experiment.workbench, request.destination_id)
            if slot.tool is None or slot.tool.tool_type != "sample_vial":
                raise ValueError("A prepared extract requires an autosampler vial.")
            if slot.tool.is_sealed:
                raise ValueError(f"Open {slot.tool.label} before adding a prepared extract.")
            vial = slot.tool
            apply_prepared_extract(experiment, vial, **apply_kwargs)
            record_journal(
                experiment,
                JournalCode.DEBUG_EXTRACT_ADDED,
                tool=tool_ref(vial),
                location=slot_ref(slot),
            )
            return

        vial = build_workbench_tool(_EXTRACT_VIAL_TOOL_ID)
        apply_prepared_extract(experiment, vial, **apply_kwargs)
        place_new_tool(
            self._runtime,
            experiment,
            vial,
            DndObjectRef(kind=request.destination_kind, id=request.destination_id),
            source_label="Debug palette",
        )
        _cap_vial_spawned_into_rack(vial, request.destination_kind)


def _value_or_default(value: float | None, default: float) -> float:
    return value if value is not None else default


def _cap_vial_spawned_into_rack(tool: WorkbenchTool, destination_kind: str) -> None:
    """Close a debug vial that was dropped straight into the autosampler rack.

    Capping is a bench action — a vial already in a rack slot has no way to be
    closed — and the instrument refuses to load a rack holding an open vial. A
    preset dropped into the rack stands for a finished preparation, so it arrives
    capped and the rack loads. Anywhere else the vial is still work in progress
    and keeps its cap off.
    """
    if destination_kind == "rack_slot" and can_tool_seal(tool.tool_type):
        tool.is_sealed = True


def _fill_tool_with_debug_slurry(
    experiment: Experiment,
    tool: WorkbenchTool,
    *,
    produce_mass_g: float,
    temperature_c: float,
    location_kind: ProduceFractionLocationKind,
    location_id: str,
) -> None:
    produce_lot = ProduceLot(
        id=new_id("produce"),
        label="Apple",
        label_code="apple",
        produce_type="apple",
        total_mass_g=produce_mass_g,
        unit_count=None,
        pesticide_residues=generate_pesticide_residues("apple"),
    )
    tool.produce_lots.append(produce_lot)
    set_material_state_name(experiment.produce_material_states, produce_lot.id, "slurry")
    state = next(state for state in experiment.produce_material_states if state.produce_lot_id == produce_lot.id)
    state.grind_quality_label = "slurry"
    state.homogeneity_score = 1.0
    tool.contents_homogeneity = 1.0
    tool.produce_fractions.append(
        ProduceFraction(
            id=new_id("produce_fraction"),
            produce_lot_id=produce_lot.id,
            produce_material_state_id=state.id,
            temperature_c=temperature_c,
            mass_g=produce_mass_g,
            is_mixed=True,
            location_kind=location_kind,
            location_id=location_id,
            container_id=tool.id,
            container_label=tool.label,
        )
    )


def _apply_slurry_extract_preset(preset_id: str, tool: WorkbenchTool) -> None:
    """Advance a freshly filled slurry tube to the extraction state its preset encodes."""
    if preset_id == _VORTEXED_SLURRY_TUBE_PRESET:
        _prepare_vortexed_extract(tool)
    elif preset_id == _SEPARATED_SLURRY_TUBE_PRESET:
        _prepare_separated_extract(tool)


def _prepare_vortexed_extract(tool: WorkbenchTool) -> None:
    """Bring a debug slurry tube to the post-vortex "mixed" state.

    This mirrors the manual QuEChERS path (add acetonitrile, add salts, seal, then
    vortex to "mixed") so the tube carries a valid extract and can be centrifuged
    straight into a pipettable supernatant. The centrifuge only produces a valid
    separation when phase is in {mixed, separated}; see StartCentrifugeCycleService.
    """
    tool.liquids.append(
        WorkbenchLiquid(
            id=new_id("liquid"),
            liquid_id=ACETONITRILE_ID,
            name="Acetonitrile",
            volume_ml=10.0,
            accent="amber",
        )
    )
    tool.quechers_state.salts_added = True
    tool.quechers_state.phase = "mixed"
    tool.contents_homogeneity = 1.0
    _physical_simulation_service.complete_quechers_extraction(tool)
    tool.is_sealed = True


def _prepare_separated_extract(tool: WorkbenchTool) -> None:
    """Bring a debug slurry tube to the post-centrifuge "separated" state.

    Runs the full vortex prep, then stratifies the tube the way a finished centrifuge
    run does: the matrix pellet settles and the acetonitrile supernatant sits on top,
    ready to pipette. The tube is left unsealed so the very next action is aspiration
    straight into a rack vial (see AspiratePipetteService: a separated centrifuge tube
    carrying a valid extract yields a supernatant-only draw).
    """
    _prepare_vortexed_extract(tool)
    tool.quechers_state.phase = "separated"
    tool.quechers_state.separation_progress = 1.0
    tool.is_sealed = False


def _build_debug_produce_lot(
    preset_id: str,
    *,
    total_mass_g: float | None = None,
    temperature_c: float | None = None,
    residual_co2_mass_g: float | None = None,
) -> ProduceLot:
    if preset_id == "apple_powder_residual_co2":
        return ProduceLot(
            id=new_id("produce"),
            label="Apple powder lot",
            label_code="apple_powder_lot",
            produce_type="apple",
            total_mass_g=total_mass_g if total_mass_g is not None else 2450.0,
            unit_count=None,
            pesticide_residues=generate_pesticide_residues("apple"),
        )

    raise ValueError("Unknown debug produce preset")


def produce_lot_temperature_c(temperature_c: float | None) -> float:
    return temperature_c if temperature_c is not None else -62.0
