from __future__ import annotations

from dataclasses import dataclass

from app.domain.models import Experiment, InjectionContext
from app.services.domain_services.base import ExperimentRuntime, WriteDomainService
from app.services.domain_services.lcmsms import _find_tool_anywhere, build_extract_injection_context


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


class AspiratePipetteService(WriteDomainService[AspiratePipetteRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: AspiratePipetteRequest) -> None:
        _validate_positive_volume(request.delta_volume_ml)
        source = _find_tool_anywhere(experiment, request.source_tool_id)
        if source is None:
            raise ValueError("Pipette source not found.")
        if source.tool_type != "centrifuge_tube":
            raise ValueError("The pipette can currently aspirate prepared extract from a centrifuge tube only.")
        if source.is_sealed:
            raise ValueError(f"Open {source.label} before aspirating.")
        if source.quechers_state.phase != "cemented" or "dry_salts_wetted" in source.quechers_state.faults:
            raise ValueError("Complete the QuEChERS extraction before aspirating it.")
        if source.quechers_extraction_result is None:
            raise ValueError("Run the simulation clock before aspirating the extract.")
        pipette = experiment.pipette
        if pipette.source_tool_id not in (None, source.id):
            raise ValueError("The pipette contains another liquid; dispense it first.")
        aspirated_ml = min(request.delta_volume_ml, pipette.capacity_ml - pipette.volume_ml)
        if aspirated_ml <= 0:
            return
        pipette.volume_ml = round(pipette.volume_ml + aspirated_ml, 3)
        pipette.source_tool_id = source.id
        pipette.injection_context = build_extract_injection_context(experiment, source, pipette.volume_ml)
        experiment.audit_log.append(f"Pipette aspirated {aspirated_ml:.3f} mL from {source.label}.")


class DispensePipetteService(WriteDomainService[DispensePipetteRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: DispensePipetteRequest) -> None:
        _validate_positive_volume(request.delta_volume_ml)
        target = _find_tool_anywhere(experiment, request.target_tool_id)
        if target is None:
            raise ValueError("Pipette target not found.")
        if target.tool_type != "sample_vial":
            raise ValueError("Extract can currently be dispensed into an autosampler vial only.")
        if target.is_sealed:
            raise ValueError(f"Open {target.label} before dispensing.")
        pipette = experiment.pipette
        if pipette.injection_context is None or pipette.volume_ml <= 0:
            raise ValueError("The pipette is empty; aspirate extract first.")
        if target.injection_context is not None and target.injection_context.source_tube_id != pipette.source_tool_id:
            raise ValueError("This vial already contains extract from another tube.")
        dispensed_ml = min(request.delta_volume_ml, pipette.volume_ml)
        source_context = pipette.injection_context
        ratio = dispensed_ml / pipette.volume_ml
        addition = InjectionContext(
            source_tube_id=source_context.source_tube_id,
            sample_mass_g=round(source_context.sample_mass_g * ratio, 4),
            extract_volume_ml=round(dispensed_ml, 3),
            effective_residues_ug_per_kg=dict(source_context.effective_residues_ug_per_kg),
            extraction_result=source_context.extraction_result,
            istd_volume_ml=round(source_context.istd_volume_ml * ratio, 4) if source_context.istd_volume_ml else None,
            istd_reference_conc_ng_per_ml=source_context.istd_reference_conc_ng_per_ml,
            extract_true_volume_ml=round(dispensed_ml, 6),
            istd_true_volume_ml=(
                round(source_context.istd_true_volume_ml * ratio, 6)
                if source_context.istd_true_volume_ml
                else None
            ),
        )
        if target.injection_context is None:
            target.injection_context = addition
        else:
            target.injection_context.sample_mass_g = round(target.injection_context.sample_mass_g + addition.sample_mass_g, 4)
            target.injection_context.extract_volume_ml = round(target.injection_context.extract_volume_ml + addition.extract_volume_ml, 3)
            if addition.istd_volume_ml:
                target.injection_context.istd_volume_ml = round((target.injection_context.istd_volume_ml or 0) + addition.istd_volume_ml, 4)
        remaining_ratio = (pipette.volume_ml - dispensed_ml) / pipette.volume_ml
        pipette.volume_ml = round(pipette.volume_ml - dispensed_ml, 3)
        if pipette.volume_ml <= 0:
            pipette.volume_ml = 0.0
            pipette.source_tool_id = None
            pipette.injection_context = None
        else:
            source_context.sample_mass_g = round(source_context.sample_mass_g * remaining_ratio, 4)
            source_context.extract_volume_ml = pipette.volume_ml
            if source_context.istd_volume_ml:
                source_context.istd_volume_ml = round(source_context.istd_volume_ml * remaining_ratio, 4)
        experiment.audit_log.append(f"Pipette dispensed {dispensed_ml:.3f} mL into {target.label}.")
