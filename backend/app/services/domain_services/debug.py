from __future__ import annotations

from dataclasses import dataclass

from app.domain.models import (
    Experiment,
    ProduceFraction,
    ProduceFractionLocationKind,
    ProduceLot,
    WorkbenchTool,
    new_id,
)
from app.domain.pesticide_catalog import generate_pesticide_residues
from app.services.dnd_move_service import DndObjectRef, place_new_tool
from app.services.domain_services.base import ExperimentRuntime, WriteDomainService
from app.services.domain_services.gross_balance import GrossBalanceProduceLotTarget
from app.services.helpers.lookups import find_workbench_slot
from app.services.helpers.produce_material_states import set_material_state_name, update_material_state
from app.services.helpers.workbench import build_workbench_tool
from app.services.transfer import GrinderProduceLotTarget, WorkbenchProduceLotTarget


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
            temperature_c=produce_lot_temperature_c(request.temperature_c),
            grind_quality_label="powder_fine",
            homogeneity_score=0.96,
            residual_co2_mass_g=(request.residual_co2_mass_g if request.residual_co2_mass_g is not None else 18.0),
        )
        target = WorkbenchProduceLotTarget(slot_id=request.target_slot_id)
        target.validate(experiment)
        placement = target.place(experiment, produce_lot)
        experiment.audit_log.append(f"Debug preset {produce_lot.label} spawned on {placement.target_label}.")


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
            temperature_c=produce_lot_temperature_c(request.temperature_c),
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
        experiment.audit_log.append(f"Debug preset {produce_lot.label} spawned in {placement.target_label}.")


class CreateDebugToolPresetService(WriteDomainService[CreateDebugToolPresetRequest]):
    def _run(self, experiment: Experiment, request: CreateDebugToolPresetRequest) -> None:
        if request.preset_id != "apple_slurry_centrifuge_tube":
            raise ValueError("Unknown debug tool preset")

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
            experiment.audit_log.append(f"Debug Apple slurry added to {tool.label} on {slot.label}.")
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
        produce_type="apple",
        total_mass_g=produce_mass_g,
        unit_count=None,
        pesticide_residues=generate_pesticide_residues("apple"),
    )
    tool.produce_lots.append(produce_lot)
    set_material_state_name(experiment.produce_material_states, produce_lot.id, "slurry")
    state = next(state for state in experiment.produce_material_states if state.produce_lot_id == produce_lot.id)
    state.temperature_c = temperature_c
    state.grind_quality_label = "slurry"
    state.homogeneity_score = 1.0
    tool.contents_homogeneity = 1.0
    tool.produce_fractions.append(
        ProduceFraction(
            id=new_id("produce_fraction"),
            produce_lot_id=produce_lot.id,
            produce_material_state_id=state.id,
            mass_g=produce_mass_g,
            is_mixed=True,
            location_kind=location_kind,
            location_id=location_id,
            container_id=tool.id,
            container_label=tool.label,
        )
    )
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
            produce_type="apple",
            total_mass_g=total_mass_g if total_mass_g is not None else 2450.0,
            unit_count=None,
            pesticide_residues=generate_pesticide_residues("apple"),
        )

    raise ValueError("Unknown debug produce preset")


def produce_lot_temperature_c(temperature_c: float | None) -> float:
    return temperature_c if temperature_c is not None else -62.0
