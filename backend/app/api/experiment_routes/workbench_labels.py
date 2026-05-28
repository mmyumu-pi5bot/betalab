from app.schemas.experiment import (
    ExperimentSchema,
    WorkbenchToolSampleLabelUpdateSchema,
)
from app.services.domain_services.workbench import (
    ApplySampleLabelToWorkbenchToolService,
    DiscardSampleLabelFromPaletteRequest,
    DiscardSampleLabelFromPaletteService,
    DiscardSampleLabelFromWorkbenchToolService,
    UpdateWorkbenchToolSampleLabelTextRequest,
    UpdateWorkbenchToolSampleLabelTextService,
    WorkbenchSampleLabelRequest,
    WorkbenchSlotRequest,
)

from .common import (
    experiment_service,
    find_default_tool_label_id,
    find_tool_slot,
    handle_service_errors,
    router,
)


@router.post("/{experiment_id}/workbench/tools/{tool_id}/sample-label", response_model=ExperimentSchema)
def apply_sample_label_to_workbench_tool(experiment_id: str, tool_id: str) -> ExperimentSchema:
    return handle_service_errors(
        lambda: ApplySampleLabelToWorkbenchToolService(experiment_service).run(
            experiment_id,
            WorkbenchSlotRequest(slot_id=find_tool_slot(experiment_id, tool_id)),
        )
    )


@router.patch(
    "/{experiment_id}/workbench/tools/{tool_id}/sample-labels/{label_id}",
    response_model=ExperimentSchema,
)
def update_workbench_tool_sample_label_text(
    experiment_id: str,
    tool_id: str,
    label_id: str,
    request: WorkbenchToolSampleLabelUpdateSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: UpdateWorkbenchToolSampleLabelTextService(experiment_service).run(
            experiment_id,
            UpdateWorkbenchToolSampleLabelTextRequest(
                slot_id=find_tool_slot(experiment_id, tool_id),
                label_id=label_id,
                sample_label_text=request.sample_label_text,
            ),
        )
    )


@router.patch("/{experiment_id}/workbench/tools/{tool_id}/sample-label", response_model=ExperimentSchema)
def update_workbench_tool_primary_sample_label_text(
    experiment_id: str,
    tool_id: str,
    request: WorkbenchToolSampleLabelUpdateSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: UpdateWorkbenchToolSampleLabelTextService(experiment_service).run(
            experiment_id,
            UpdateWorkbenchToolSampleLabelTextRequest(
                slot_id=find_tool_slot(experiment_id, tool_id),
                label_id=find_default_tool_label_id(experiment_id, tool_id),
                sample_label_text=request.sample_label_text,
            ),
        )
    )


@router.delete(
    "/{experiment_id}/workbench/tools/{tool_id}/sample-labels/{label_id}",
    response_model=ExperimentSchema,
)
def discard_sample_label_from_workbench_tool(
    experiment_id: str,
    tool_id: str,
    label_id: str,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: DiscardSampleLabelFromWorkbenchToolService(experiment_service).run(
            experiment_id,
            WorkbenchSampleLabelRequest(
                slot_id=find_tool_slot(experiment_id, tool_id),
                label_id=label_id,
            ),
        )
    )


@router.delete("/{experiment_id}/workbench/tools/{tool_id}/sample-label", response_model=ExperimentSchema)
def discard_primary_sample_label_from_workbench_tool(
    experiment_id: str,
    tool_id: str,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: DiscardSampleLabelFromWorkbenchToolService(experiment_service).run(
            experiment_id,
            WorkbenchSampleLabelRequest(
                slot_id=find_tool_slot(experiment_id, tool_id),
                label_id=find_default_tool_label_id(experiment_id, tool_id),
            ),
        )
    )


@router.post("/{experiment_id}/palette/sample-labels/discard", response_model=ExperimentSchema)
def discard_sample_label_from_palette(experiment_id: str) -> ExperimentSchema:
    return handle_service_errors(
        lambda: DiscardSampleLabelFromPaletteService(experiment_service).run(
            experiment_id,
            DiscardSampleLabelFromPaletteRequest(sample_label_id="sampling_bag_label"),
        )
    )
