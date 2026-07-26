from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from typing import cast

from app.domain.models import (
    Experiment,
    InjectionContext,
    PipetteState,
    ProduceFraction,
    ProduceFractionLocationKind,
    ProduceLot,
    WorkbenchLiquid,
    WorkbenchTool,
)
from app.domain.rules import can_tool_accept_liquids
from app.services.domain_services.base import ExperimentRuntime, WriteDomainService
from app.services.domain_services.lcmsms import _find_tool_anywhere, build_extract_injection_context
from app.services.helpers.lookups import round_volume
from app.services.helpers.produce_canonical import (
    _pour_produce_fractions_proportional,
    _split_produce_fraction,
    get_tool_remaining_fill_capacity_ml,
)
from app.services.helpers.tool_liquids import raise_if_quechers_unusable, transfer_liquid_portion
from app.services.physical_simulation_service import PhysicalSimulationService


@dataclass(frozen=True, slots=True)
class AspiratePipetteRequest:
    source_tool_id: str
    delta_volume_ml: float


@dataclass(frozen=True, slots=True)
class DispensePipetteRequest:
    target_tool_id: str
    delta_volume_ml: float


def _validate_positive_volume(volume_ml: float) -> None:
    if volume_ml <= 0:
        raise ValueError("Pipette volume must be positive.")


def _scaled_injection_context(
    context: InjectionContext,
    ratio: float,
    extract_volume_ml: float,
    *,
    true_ratio: float | None = None,
    extract_true_volume_ml: float | None = None,
    sample_mass_g: float | None = None,
    sample_true_mass_g: float | None = None,
) -> InjectionContext:
    actual_true_ratio = ratio if true_ratio is None else true_ratio
    context_true_sample_mass_g = (
        context.sample_true_mass_g
        if context.sample_true_mass_g is not None
        else context.sample_mass_g
    )
    context_true_extract_volume_ml = (
        context.extract_true_volume_ml
        if context.extract_true_volume_ml is not None
        else context.extract_volume_ml
    )
    return InjectionContext(
        source_tube_id=context.source_tube_id,
        sample_mass_g=round(
            sample_mass_g
            if sample_mass_g is not None
            else context.sample_mass_g * ratio,
            4,
        ),
        sample_true_mass_g=round(
            sample_true_mass_g
            if sample_true_mass_g is not None
            else context_true_sample_mass_g * actual_true_ratio,
            6,
        ),
        extract_volume_ml=round(extract_volume_ml, 3),
        effective_residues_ug_per_kg=dict(context.effective_residues_ug_per_kg),
        extraction_result=context.extraction_result,
        istd_volume_ml=round(context.istd_volume_ml * ratio, 4) if context.istd_volume_ml else None,
        istd_reference_conc_ng_per_ml=context.istd_reference_conc_ng_per_ml,
        extract_true_volume_ml=round(
            extract_true_volume_ml
            if extract_true_volume_ml is not None
            else context_true_extract_volume_ml * actual_true_ratio,
            6,
        ),
        istd_true_volume_ml=(
            round(context.istd_true_volume_ml * actual_true_ratio, 6)
            if context.istd_true_volume_ml
            else None
        ),
    )


def _merge_injection_context(base: InjectionContext, addition: InjectionContext) -> None:
    base_true_sample_mass_g = (
        base.sample_true_mass_g
        if base.sample_true_mass_g is not None
        else base.sample_mass_g
    )
    addition_true_sample_mass_g = (
        addition.sample_true_mass_g
        if addition.sample_true_mass_g is not None
        else addition.sample_mass_g
    )
    base_true_extract_volume_ml = (
        base.extract_true_volume_ml
        if base.extract_true_volume_ml is not None
        else base.extract_volume_ml
    )
    addition_true_extract_volume_ml = (
        addition.extract_true_volume_ml
        if addition.extract_true_volume_ml is not None
        else addition.extract_volume_ml
    )
    base.sample_mass_g = round(base.sample_mass_g + addition.sample_mass_g, 4)
    base.sample_true_mass_g = round(
        base_true_sample_mass_g + addition_true_sample_mass_g,
        6,
    )
    base.extract_volume_ml = round(base.extract_volume_ml + addition.extract_volume_ml, 3)
    base.extract_true_volume_ml = round(
        base_true_extract_volume_ml + addition_true_extract_volume_ml,
        6,
    )
    if addition.istd_volume_ml:
        base.istd_volume_ml = round((base.istd_volume_ml or 0) + addition.istd_volume_ml, 4)
    if addition.istd_true_volume_ml:
        base.istd_true_volume_ml = round(
            (base.istd_true_volume_ml or 0.0) + addition.istd_true_volume_ml,
            6,
        )


def _shrink_injection_context(
    context: InjectionContext,
    remaining_ratio: float,
    extract_volume_ml: float,
    *,
    true_remaining_ratio: float | None = None,
    extract_true_volume_ml: float | None = None,
) -> None:
    actual_true_remaining_ratio = (
        remaining_ratio
        if true_remaining_ratio is None
        else true_remaining_ratio
    )
    context_true_sample_mass_g = (
        context.sample_true_mass_g
        if context.sample_true_mass_g is not None
        else context.sample_mass_g
    )
    context_true_extract_volume_ml = (
        context.extract_true_volume_ml
        if context.extract_true_volume_ml is not None
        else context.extract_volume_ml
    )
    context.sample_mass_g = round(context.sample_mass_g * remaining_ratio, 4)
    context.sample_true_mass_g = round(
        context_true_sample_mass_g * actual_true_remaining_ratio,
        6,
    )
    context.extract_volume_ml = round(extract_volume_ml, 3)
    context.extract_true_volume_ml = round(
        extract_true_volume_ml
        if extract_true_volume_ml is not None
        else context_true_extract_volume_ml * actual_true_remaining_ratio,
        6,
    )
    if context.istd_volume_ml:
        context.istd_volume_ml = round(context.istd_volume_ml * remaining_ratio, 4)
    if context.istd_true_volume_ml:
        context.istd_true_volume_ml = round(
            context.istd_true_volume_ml * actual_true_remaining_ratio,
            6,
        )


def _pipettable_volume_ml(tool: WorkbenchTool) -> float:
    # Product suspensions use the deliberate simulation simplification 1 g = 1 mL.
    canonical_lot_ids = {lot.id for lot in tool.produce_lots}
    return round(
        sum(max(liquid.volume_ml, 0.0) for liquid in tool.liquids)
        + sum(
            max(fraction.mass_g, 0.0)
            for fraction in tool.produce_fractions
            if fraction.produce_lot_id in canonical_lot_ids
        ),
        6,
    )


def _pipettable_true_volume_ml(tool: WorkbenchTool) -> float:
    canonical_lot_ids = {lot.id for lot in tool.produce_lots}
    return round(
        sum(
            max(
                liquid.true_volume_ml
                if liquid.true_volume_ml is not None
                else liquid.volume_ml,
                0.0,
            )
            for liquid in tool.liquids
        )
        + sum(
            max(
                fraction.true_mass_g
                if fraction.true_mass_g is not None
                else fraction.mass_g,
                0.0,
            )
            for fraction in tool.produce_fractions
            if fraction.produce_lot_id in canonical_lot_ids
        ),
        6,
    )


def _pipette_content_volume_ml(pipette: PipetteState) -> float:
    return round(
        sum(max(liquid.volume_ml, 0.0) for liquid in pipette.liquids)
        + sum(max(fraction.mass_g, 0.0) for fraction in pipette.produce_fractions),
        6,
    )


def _pipette_true_content_volume_ml(pipette: PipetteState) -> float:
    return round(
        sum(
            max(
                liquid.true_volume_ml
                if liquid.true_volume_ml is not None
                else liquid.volume_ml,
                0.0,
            )
            for liquid in pipette.liquids
        )
        + sum(
            max(
                fraction.true_mass_g
                if fraction.true_mass_g is not None
                else fraction.mass_g,
                0.0,
            )
            for fraction in pipette.produce_fractions
        ),
        6,
    )


def _allocate_weighted_amounts(
    total: float,
    available: list[float],
    weights: list[float],
) -> list[float]:
    """Allocate a total across components without exceeding hidden availability."""
    allocations = [0.0] * len(available)
    remaining = min(max(total, 0.0), sum(max(value, 0.0) for value in available))
    active = {
        index
        for index, component_available in enumerate(available)
        if component_available > 0
    }
    while remaining > 1e-9 and active:
        weight_total = sum(max(weights[index], 0.0) for index in active)
        if weight_total <= 0:
            weight_total = sum(available[index] - allocations[index] for index in active)
            effective_weights = {
                index: available[index] - allocations[index]
                for index in active
            }
        else:
            effective_weights = {
                index: max(weights[index], 0.0)
                for index in active
            }
        capped: set[int] = set()
        proposals: dict[int, float] = {}
        for index in active:
            proposal = remaining * effective_weights[index] / weight_total
            capacity = available[index] - allocations[index]
            if proposal >= capacity:
                allocations[index] += capacity
                remaining -= capacity
                capped.add(index)
            else:
                proposals[index] = proposal
        if capped:
            active -= capped
            continue
        for index, proposal in proposals.items():
            allocations[index] += proposal
        remaining = 0.0
    return [round(value, 6) for value in allocations]


def _sync_produce_lot_masses(
    produce_lots: list[ProduceLot],
    produce_fractions: list[ProduceFraction],
) -> None:
    masses_by_lot_id: dict[str, float] = {}
    for fraction in produce_fractions:
        masses_by_lot_id[fraction.produce_lot_id] = (
            masses_by_lot_id.get(fraction.produce_lot_id, 0.0) + max(fraction.mass_g, 0.0)
        )
    for lot in produce_lots:
        lot.total_mass_g = round(masses_by_lot_id.get(lot.id, 0.0), 3)
    true_mass_lot_ids = {
        fraction.produce_lot_id
        for fraction in produce_fractions
        if (fraction.true_mass_g or 0.0) > 0
    }
    produce_lots[:] = [
        lot
        for lot in produce_lots
        if lot.total_mass_g > 0 or lot.id in true_mass_lot_ids
    ]


def _copy_missing_produce_lots(
    source_lots: list[ProduceLot],
    target_lots: list[ProduceLot],
    fractions: list[ProduceFraction],
) -> None:
    target_ids = {lot.id for lot in target_lots}
    required_ids = {fraction.produce_lot_id for fraction in fractions}
    for lot in source_lots:
        if lot.id in required_ids and lot.id not in target_ids:
            target_lots.append(deepcopy(lot))
            target_ids.add(lot.id)


def _find_tool_produce_location(
    experiment: Experiment,
    tool_id: str,
) -> tuple[ProduceFractionLocationKind, str]:
    for tool in experiment.basket_tools:
        if tool.id == tool_id:
            return "basket_tool", tool.id
    for slot in experiment.workbench.slots:
        if slot.tool is not None and slot.tool.id == tool_id:
            return "workbench_tool", slot.id
    for slot in experiment.rack.slots:
        if slot.tool is not None and slot.tool.id == tool_id:
            return "rack_tool", slot.id
    for widget in experiment.workspace.widgets:
        if widget.tool is not None and widget.tool.id == tool_id:
            return "workspace_widget_tool", widget.id
    raise ValueError("Pipette target location not found.")


class AspiratePipetteService(WriteDomainService[AspiratePipetteRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: AspiratePipetteRequest) -> None:
        _validate_positive_volume(request.delta_volume_ml)
        source = _find_tool_anywhere(experiment, request.source_tool_id)
        if source is None:
            raise ValueError("Pipette source not found.")
        if source.is_sealed:
            raise ValueError(f"Open {source.label} before aspirating.")
        if (
            source.tool_type == "centrifuge_tube"
            and source.quechers_extraction_result is not None
            and source.quechers_state.phase != "separated"
        ):
            raise ValueError(
                f"{source.label} must be centrifuged before aspirating the extract."
            )
        total_source_ml = _pipettable_volume_ml(source)
        if total_source_ml <= 0:
            raise ValueError(f"{source.label} contains no liquid or material to aspirate.")
        pipette = experiment.pipette
        if pipette.source_tool_id not in (None, source.id):
            raise ValueError("The pipette contains another liquid; dispense it first.")
        requested_ml = min(request.delta_volume_ml, pipette.capacity_ml - pipette.volume_ml, total_source_ml)
        if requested_ml <= 0:
            return

        # An unvortexed suspension does not aspirate at the container's average
        # composition; the per-liquid bias is drawn by the simulation facade.
        canonical_lot_ids = {lot.id for lot in source.produce_lots}
        pipettable_fractions = [
            fraction
            for fraction in source.produce_fractions
            if fraction.produce_lot_id in canonical_lot_ids
        ]
        components = [
            (
                "liquid",
                liquid,
                liquid.volume_ml,
                liquid.true_volume_ml
                if liquid.true_volume_ml is not None
                else liquid.volume_ml,
            )
            for liquid in source.liquids
            if liquid.volume_ml > 0
        ] + [
            (
                "produce",
                fraction,
                fraction.mass_g,
                fraction.true_mass_g
                if fraction.true_mass_g is not None
                else fraction.mass_g,
            )
            for fraction in pipettable_fractions
            if fraction.mass_g > 0
        ]
        nominal_available = [
            nominal_amount
            for _, _, nominal_amount, _ in components
        ]
        true_available = [
            max(true_amount, 0.0)
            for _, _, _, true_amount in components
        ]
        nominal_allocations = _allocate_weighted_amounts(
            requested_ml,
            nominal_available,
            nominal_available,
        )
        requested_true_ml = min(
            PhysicalSimulationService.draw_dispensed_volume(requested_ml),
            sum(true_available),
        )
        true_weights = PhysicalSimulationService.draw_aspiration_weights(
            true_available,
            source.contents_homogeneity,
        )
        true_allocations = _allocate_weighted_amounts(
            requested_true_ml,
            true_available,
            true_weights,
        )
        if sum(nominal_allocations) <= 0:
            return

        nominal_sample_mass_g = sum(
            nominal_amount
            for (kind, _, _, _), nominal_amount in zip(
                components,
                nominal_allocations,
                strict=True,
            )
            if kind == "produce"
        )
        true_sample_mass_g = sum(
            true_amount
            for (kind, _, _, _), true_amount in zip(
                components,
                true_allocations,
                strict=True,
            )
            if kind == "produce"
        )
        nominal_istd_volume_ml = sum(
            nominal_amount
            for (kind, component, _, _), nominal_amount in zip(
                components,
                nominal_allocations,
                strict=True,
            )
            if kind == "liquid"
            and cast(WorkbenchLiquid, component).liquid_id == "istd_solution"
        )
        true_istd_volume_ml = sum(
            true_amount
            for (kind, component, _, _), true_amount in zip(
                components,
                true_allocations,
                strict=True,
            )
            if kind == "liquid"
            and cast(WorkbenchLiquid, component).liquid_id == "istd_solution"
        )
        aspirated_context = self._build_aspirated_context(
            experiment,
            source,
            pipette,
            requested_ml,
            requested_true_ml,
            total_source_ml,
            _pipettable_true_volume_ml(source),
            nominal_sample_mass_g,
            true_sample_mass_g,
            nominal_istd_volume_ml,
            true_istd_volume_ml,
        )
        source_lots_before = list(source.produce_lots)
        for (kind, component), nominal_amount, true_amount in zip(
            (component[:2] for component in components),
            nominal_allocations,
            true_allocations,
            strict=True,
        ):
            if kind == "liquid":
                liquid = cast(WorkbenchLiquid, component)
                transfer_liquid_portion(
                    source.liquids,
                    pipette.liquids,
                    liquid,
                    nominal_amount,
                    target_id_prefix="pipette_liquid",
                    true_volume_ml=true_amount,
                )
                continue
            fraction = cast(ProduceFraction, component)
            transferred = _split_produce_fraction(
                fraction,
                nominal_amount / fraction.mass_g,
                true_ratio=(
                    true_amount / (fraction.true_mass_g or 0.0)
                    if (fraction.true_mass_g or 0.0) > 0
                    else 0.0
                ),
                location_kind="pipette",
                location_id="pipette",
                container_id="pipette",
                container_label="Pipette",
            )
            if transferred is not None:
                pipette.produce_fractions.append(transferred)
        source.liquids = [
            liquid
            for liquid in source.liquids
            if liquid.volume_ml > 0 or (liquid.true_volume_ml or 0.0) > 0
        ]
        source.produce_fractions = [
            fraction
            for fraction in source.produce_fractions
            if fraction.mass_g > 0 or (fraction.true_mass_g or 0.0) > 0
        ]
        _copy_missing_produce_lots(source_lots_before, pipette.produce_lots, pipette.produce_fractions)
        _sync_produce_lot_masses(source.produce_lots, source.produce_fractions)
        _sync_produce_lot_masses(pipette.produce_lots, pipette.produce_fractions)
        pipette.volume_ml = min(_pipette_content_volume_ml(pipette), pipette.capacity_ml)
        pipette.true_volume_ml = _pipette_true_content_volume_ml(pipette)
        pipette.source_tool_id = source.id
        pipette.injection_context = aspirated_context
        if not source.liquids and not source.produce_fractions:
            source.injection_context = None
        experiment.audit_log.append(f"Pipette aspirated {requested_ml:.3f} mL from {source.label}.")

    @staticmethod
    def _build_aspirated_context(
        experiment: Experiment,
        source,
        pipette,
        nominal_ml: float,
        true_ml: float,
        total_source_ml: float,
        total_source_true_ml: float,
        nominal_sample_mass_g: float,
        true_sample_mass_g: float,
        nominal_istd_volume_ml: float,
        true_istd_volume_ml: float,
    ) -> InjectionContext | None:
        if source.quechers_extraction_result is not None and source.produce_fractions:
            existing_nominal_sample_mass_g = sum(
                fraction.mass_g
                for fraction in pipette.produce_fractions
            )
            existing_true_sample_mass_g = sum(
                fraction.true_mass_g
                if fraction.true_mass_g is not None
                else fraction.mass_g
                for fraction in pipette.produce_fractions
            )
            existing_istd = next(
                (
                    liquid
                    for liquid in pipette.liquids
                    if liquid.liquid_id == "istd_solution"
                ),
                None,
            )
            total_nominal_istd_volume_ml = (
                (existing_istd.volume_ml if existing_istd is not None else 0.0)
                + nominal_istd_volume_ml
            )
            total_true_istd_volume_ml = (
                (
                    existing_istd.true_volume_ml
                    if existing_istd is not None
                    and existing_istd.true_volume_ml is not None
                    else 0.0
                )
                + true_istd_volume_ml
            )
            return build_extract_injection_context(
                experiment,
                source,
                pipette.volume_ml + nominal_ml,
                sample_mass_g=(
                    existing_nominal_sample_mass_g + nominal_sample_mass_g
                    if existing_nominal_sample_mass_g + nominal_sample_mass_g > 0
                    else None
                ),
                sample_true_mass_g=(
                    existing_true_sample_mass_g + true_sample_mass_g
                    if existing_true_sample_mass_g + true_sample_mass_g > 0
                    else None
                ),
                extract_true_volume_ml=(pipette.true_volume_ml or 0.0) + true_ml,
                istd_volume_ml=(
                    total_nominal_istd_volume_ml
                    if total_nominal_istd_volume_ml > 0
                    else None
                ),
                istd_true_volume_ml=(
                    total_true_istd_volume_ml
                    if total_true_istd_volume_ml > 0
                    else None
                ),
            )
        if source.injection_context is None:
            return pipette.injection_context
        # The source carries extract that was dispensed into it earlier: the
        # aspirated share takes a proportional part of that provenance along.
        share_ratio = min(nominal_ml / total_source_ml, 1.0)
        true_share_ratio = min(
            true_ml / total_source_true_ml,
            1.0,
        ) if total_source_true_ml > 0 else share_ratio
        source_context = source.injection_context
        original_sample_mass_g = source_context.sample_mass_g
        original_true_sample_mass_g = (
            source_context.sample_true_mass_g
            if source_context.sample_true_mass_g is not None
            else source_context.sample_mass_g
        )
        share = _scaled_injection_context(
            source_context,
            share_ratio,
            nominal_ml,
            true_ratio=true_share_ratio,
            extract_true_volume_ml=true_ml,
            sample_mass_g=(
                nominal_sample_mass_g
                if nominal_sample_mass_g > 0
                else None
            ),
            sample_true_mass_g=(
                true_sample_mass_g
                if true_sample_mass_g > 0
                else None
            ),
        )
        remaining_ratio = 1.0 - share_ratio
        true_remaining_ratio = 1.0 - true_share_ratio
        if remaining_ratio <= 0:
            source.injection_context = None
        else:
            _shrink_injection_context(
                source_context,
                remaining_ratio,
                max(total_source_ml - nominal_ml, 0.0),
                true_remaining_ratio=true_remaining_ratio,
                extract_true_volume_ml=max(total_source_true_ml - true_ml, 0.0),
            )
            if nominal_sample_mass_g > 0:
                source_context.sample_mass_g = round(
                    max(original_sample_mass_g - nominal_sample_mass_g, 0.0),
                    4,
                )
            if true_sample_mass_g > 0:
                source_context.sample_true_mass_g = round(
                    max(original_true_sample_mass_g - true_sample_mass_g, 0.0),
                    6,
                )
        if pipette.injection_context is not None:
            _merge_injection_context(share, pipette.injection_context)
        return share


class DispensePipetteService(WriteDomainService[DispensePipetteRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: DispensePipetteRequest) -> None:
        _validate_positive_volume(request.delta_volume_ml)
        target = _find_tool_anywhere(experiment, request.target_tool_id)
        if target is None:
            raise ValueError("Pipette target not found.")
        raise_if_quechers_unusable(target)
        if not can_tool_accept_liquids(target.tool_type):
            raise ValueError(f"{target.label} does not accept liquids.")
        if target.is_sealed:
            raise ValueError(f"Open {target.label} before dispensing.")
        pipette = experiment.pipette
        if not (pipette.liquids or pipette.produce_fractions) or pipette.volume_ml <= 0:
            raise ValueError("The pipette is empty; aspirate some contents first.")
        pipette_context = pipette.injection_context
        if (
            pipette_context is not None
            and target.injection_context is not None
            and target.injection_context.source_tube_id != pipette_context.source_tube_id
        ):
            raise ValueError("This vial already contains extract from another tube.")
        target_remaining_ml = round_volume(
            get_tool_remaining_fill_capacity_ml(target, material_states=experiment.produce_material_states)
        )
        requested_ml = min(request.delta_volume_ml, pipette.volume_ml, target_remaining_ml)
        if requested_ml <= 0:
            raise ValueError(f"{target.label} is already full.")

        target_had_contents = bool(target.liquids or target.produce_fractions)
        volume_before_ml = pipette.volume_ml
        ratio = requested_ml / volume_before_ml
        dispensed_ml = 0.0
        for liquid in list(pipette.liquids):
            dispensed_ml += transfer_liquid_portion(
                pipette.liquids, target.liquids, liquid, round(liquid.volume_ml * ratio, 6), target_id_prefix="bench_liquid"
            )
        produce_mass_before_g = sum(fraction.mass_g for fraction in pipette.produce_fractions)
        if pipette.produce_fractions:
            target_location_kind, target_location_id = _find_tool_produce_location(experiment, target.id)
            _copy_missing_produce_lots(
                pipette.produce_lots,
                target.produce_lots,
                pipette.produce_fractions,
            )
            _pour_produce_fractions_proportional(
                pipette.produce_fractions,
                target.produce_fractions,
                ratio,
                target,
                location_kind=target_location_kind,
                location_id=target_location_id,
            )
            pipette.produce_fractions = [
                fraction for fraction in pipette.produce_fractions if fraction.mass_g > 0
            ]
            produce_mass_after_g = sum(fraction.mass_g for fraction in pipette.produce_fractions)
            dispensed_ml += produce_mass_before_g - produce_mass_after_g
            _sync_produce_lot_masses(target.produce_lots, target.produce_fractions)
            _sync_produce_lot_masses(pipette.produce_lots, pipette.produce_fractions)
        dispensed_ml = round(dispensed_ml, 6)
        if dispensed_ml <= 0:
            return

        if pipette_context is not None:
            addition = _scaled_injection_context(pipette_context, ratio, dispensed_ml)
            if target.injection_context is None:
                target.injection_context = addition
            else:
                _merge_injection_context(target.injection_context, addition)

        remaining_ratio = max(volume_before_ml - dispensed_ml, 0.0) / volume_before_ml
        pipette.volume_ml = _pipette_content_volume_ml(pipette)
        pipette.true_volume_ml = _pipette_true_content_volume_ml(pipette)
        if pipette.volume_ml <= 0 or not (pipette.liquids or pipette.produce_fractions):
            pipette.volume_ml = 0.0
            pipette.true_volume_ml = 0.0
            pipette.liquids = []
            pipette.produce_lots = []
            pipette.produce_fractions = []
            pipette.source_tool_id = None
            pipette.injection_context = None
        elif pipette_context is not None:
            _shrink_injection_context(pipette_context, remaining_ratio, pipette.volume_ml)
        target.contents_homogeneity = 0.0 if target_had_contents else 1.0
        experiment.audit_log.append(f"Pipette dispensed {dispensed_ml:.3f} mL into {target.label}.")
