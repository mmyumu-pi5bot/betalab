from __future__ import annotations

from dataclasses import dataclass

from app.domain.dnd_rules import (
    can_tool_be_discarded,
    can_tool_be_stored,
    can_tool_move_as_object,
    can_tool_receive_liquids,
    can_tool_receive_produce,
    can_tool_seal,
    get_liquid_allowed_drop_targets,
    get_sample_label_allowed_drop_targets,
    get_tool_allowed_drop_targets,
)


@dataclass(frozen=True)
class WorkbenchToolDefinition:
    id: str
    name: str
    subtitle: str
    accent: str
    tool_type: str
    capacity_ml: float


@dataclass(frozen=True)
class WorkbenchLiquidDefinition:
    id: str
    name: str
    accent: str
    transfer_volume_ml: float


WORKBENCH_TOOLS = {
    "centrifuge_tube_50ml": WorkbenchToolDefinition(
        id="centrifuge_tube_50ml",
        name="50 mL centrifuge tube",
        subtitle="QuEChERS extraction",
        accent="amber",
        tool_type="centrifuge_tube",
        capacity_ml=50.0,
    ),
    "cleanup_tube_dspe": WorkbenchToolDefinition(
        id="cleanup_tube_dspe",
        name="d-SPE cleanup tube",
        subtitle="Matrix cleanup",
        accent="emerald",
        tool_type="cleanup_tube",
        capacity_ml=15.0,
    ),
    "sample_vial_lcms": WorkbenchToolDefinition(
        id="sample_vial_lcms",
        name="Autosampler vial",
        subtitle="Injection ready",
        accent="sky",
        tool_type="sample_vial",
        capacity_ml=2.0,
    ),
    "beaker_rinse": WorkbenchToolDefinition(
        id="beaker_rinse",
        name="Bench beaker",
        subtitle="Temporary holding",
        accent="rose",
        tool_type="beaker",
        capacity_ml=100.0,
    ),
    "cutting_board_hdpe": WorkbenchToolDefinition(
        id="cutting_board_hdpe",
        name="Cutting board",
        subtitle="Prep surface",
        accent="amber",
        tool_type="cutting_board",
        capacity_ml=0.0,
    ),
    "sealed_sampling_bag": WorkbenchToolDefinition(
        id="sealed_sampling_bag",
        name="Sealed sampling bag",
        subtitle="Field collection",
        accent="emerald",
        tool_type="sample_bag",
        capacity_ml=500.0,
    ),
    "hdpe_storage_jar_2l": WorkbenchToolDefinition(
        id="hdpe_storage_jar_2l",
        name="Wide-neck HDPE jar",
        subtitle="Bulk powder storage",
        accent="sky",
        tool_type="storage_jar",
        capacity_ml=2000.0,
    ),
}


WORKBENCH_LIQUIDS = {
    "acetonitrile_extraction": WorkbenchLiquidDefinition(
        id="acetonitrile_extraction",
        name="Acetonitrile",
        accent="amber",
        transfer_volume_ml=10.0,
    ),
    "apple_extract": WorkbenchLiquidDefinition(
        id="apple_extract",
        name="Apple extract",
        accent="rose",
        transfer_volume_ml=10.0,
    ),
    "ultrapure_water_rinse": WorkbenchLiquidDefinition(
        id="ultrapure_water_rinse",
        name="Ultrapure water",
        accent="sky",
        transfer_volume_ml=5.0,
    ),
    "dry_ice_pellets": WorkbenchLiquidDefinition(
        id="dry_ice_pellets",
        name="Dry ice pellets",
        accent="sky",
        transfer_volume_ml=1000.0,
    ),
    "quechers_salts": WorkbenchLiquidDefinition(
        id="quechers_salts",
        name="QuEChERS salts packet",
        accent="violet",
        transfer_volume_ml=1.0,
    ),
    "istd_solution": WorkbenchLiquidDefinition(
        id="istd_solution",
        name="ISTD solution",
        accent="emerald",
        transfer_volume_ml=0.05,
    ),
}


_TOOL_DESCRIPTIONS = {
    "centrifuge_tube_50ml": "Receives apple sample and extraction solvent before salts and centrifugation.",
    "cleanup_tube_dspe": "Collects the supernatant for dispersive SPE cleanup before final vialing.",
    "sample_vial_lcms": "Standard autosampler vial used to load the final extract into the chromatograph.",
    "beaker_rinse": "Open vessel for rinse, discard, or intermediate handling on the bench.",
    "hdpe_storage_jar_2l": "Wide-mouth 2 L HDPE storage jar with a thick screw cap for cold, sealed bulk homogenate handling.",
    "sealed_sampling_bag": "Tamper-evident sample collection bag for sealed produce or field intake.",
    "cutting_board_hdpe": "Clean prep board used to stage apples before cutting.",
}

_LIQUID_DETAILS = {
    "acetonitrile_extraction": {
        "description": "Primary extraction solvent used in the QuEChERS workflow.",
        "liquid_type": "acetonitrile",
        "subtitle": "Extraction solvent",
    },
    "apple_extract": {
        "description": "Cryogenic apple homogenate represented as the incoming sample matrix.",
        "liquid_type": "apple_extract",
        "subtitle": "Homogenized sample",
    },
    "ultrapure_water_rinse": {
        "description": "Support liquid for rinsing or simple dilution during setup.",
        "liquid_type": "ultrapure_water",
        "subtitle": "Rinse / dilution",
    },
    "dry_ice_pellets": {
        "description": "Solid CO2 pellets used for chilled handling and cold-chain prep in the cryogenic grinder.",
        "liquid_type": "dry_ice_pellets",
        "subtitle": "Cryogenic cooling",
    },
    "quechers_salts": {
        "description": "Pre-portioned extraction salts that trigger the exothermic QuEChERS partitioning reaction.",
        "liquid_type": "quechers_salts",
        "subtitle": "Extraction salts packet",
    },
    "istd_solution": {
        "description": (
            "Pre-mixed internal standard solution — atrazine-d5, imidaclopride-d4 and deltaméthrine-d6 "
            "at 100 ng/mL each in acetonitrile. Added to the final extract before LC-MS/MS injection "
            "for matrix effect correction and analyte quantification."
        ),
        "liquid_type": "istd_solution",
        "subtitle": "100 ng/mL · atrazine-d5 / imidaclopride-d4 / deltaméthrine-d6",
    },
}

_WORKSPACE_WIDGET_ITEMS = {
    "autosampler_rack_widget": {
        "accent": "sky",
        "description": "Rack widget used to organize injection-ready vials before an LC-MS/MS run.",
        "name": "Autosampler rack",
        "subtitle": "Sequence staging",
        "widget_type": "autosampler_rack",
    },
    "lc_msms_instrument_widget": {
        "accent": "emerald",
        "description": "Pedagogical LC-MS/MS system widget with separate LC and MS/MS visual modules.",
        "name": "LC-MS/MS",
        "subtitle": "Instrument system",
        "widget_type": "lc_msms_instrument",
    },
    "cryogenic_grinder_widget": {
        "accent": "amber",
        "description": "Benchtop grinder used to homogenize chilled produce before extraction.",
        "name": "Cryogenic grinder",
        "subtitle": "Cold homogenization",
        "widget_type": "cryogenic_grinder",
    },
    "vortex_mixer_widget": {
        "accent": "violet",
        "description": "Benchtop vortex used to mix centrifuge and cleanup tubes.",
        "name": "Vortex mixer",
        "subtitle": "Tube agitation",
        "widget_type": "vortex_mixer",
    },
    "lims_terminal_widget": {
        "accent": "emerald",
        "description": "Terminal used to register the sample and print the lab label.",
        "name": "LIMS terminal",
        "subtitle": "Sample login",
        "widget_type": "lims_terminal",
    },
    "gross_balance_widget": {
        "accent": "rose",
        "description": "Bench balance used to record the incoming bag gross mass.",
        "name": "Gross balance",
        "subtitle": "Receiving weight",
        "widget_type": "gross_balance",
    },
    "analytical_balance_widget": {
        "accent": "emerald",
        "description": "Precision balance used to tare the Falcon tube and capture the 10.000 g QuEChERS test portion.",
        "name": "Analytical balance",
        "subtitle": "Sample intake",
        "widget_type": "analytical_balance",
    },
}

_TOOLBAR_CATEGORY_DEFINITIONS = (
    {
        "description": "Bench containers used from extraction to cleanup before injection.",
        "id": "prep_tools",
        "item_ids": (
            "centrifuge_tube_50ml",
            "cleanup_tube_dspe",
            "sample_vial_lcms",
            "beaker_rinse",
            "hdpe_storage_jar_2l",
        ),
        "item_source": "tools",
        "label": "Containers",
    },
    {
        "description": "Reagents and supporting materials for the pesticide extraction workflow.",
        "id": "workflow_liquids",
        "item_ids": (
            "acetonitrile_extraction",
            "apple_extract",
            "ultrapure_water_rinse",
            "dry_ice_pellets",
            "quechers_salts",
            "istd_solution",
        ),
        "item_source": "liquids",
        "label": "Reagents & materials",
    },
    {
        "description": "Large lab systems that can be dropped onto the open workspace canvas.",
        "id": "workspace_equipment",
        "item_ids": (
            "autosampler_rack_widget",
            "lc_msms_instrument_widget",
            "cryogenic_grinder_widget",
            "vortex_mixer_widget",
            "lims_terminal_widget",
            "gross_balance_widget",
            "analytical_balance_widget",
        ),
        "item_source": "workspace_widgets",
        "label": "Workspace equipment",
    },
    {
        "description": "Temporary catch-all for supporting lab items not yet grouped elsewhere.",
        "id": "misc",
        "item_ids": ("sealed_sampling_bag", "sampling_bag_label", "cutting_board_hdpe"),
        "item_source": "mixed",
        "label": "MISC",
    },
)


def get_workbench_tool_definition(tool_id: str) -> WorkbenchToolDefinition:
    try:
        return WORKBENCH_TOOLS[tool_id]
    except KeyError as exc:
        raise ValueError("Unknown workbench tool") from exc


def get_workbench_liquid_definition(liquid_id: str) -> WorkbenchLiquidDefinition:
    try:
        return WORKBENCH_LIQUIDS[liquid_id]
    except KeyError as exc:
        raise ValueError("Unknown workbench liquid") from exc


def _build_tool_toolbar_item(tool_id: str) -> dict[str, object]:
    tool = get_workbench_tool_definition(tool_id)
    return {
        "accent": tool.accent,
        "allowed_drop_targets": get_tool_allowed_drop_targets(tool.tool_type),
        "is_discardable": can_tool_be_discarded(tool.tool_type),
        "is_storable": can_tool_be_stored(tool.tool_type),
        "supports_object_move": can_tool_move_as_object(tool.tool_type),
        "can_receive_liquids": can_tool_receive_liquids(tool.tool_type),
        "can_receive_produce": can_tool_receive_produce(tool.tool_type),
        "can_seal": can_tool_seal(tool.tool_type),
        "capacity_ml": tool.capacity_ml,
        "description": _TOOL_DESCRIPTIONS[tool_id],
        "id": tool.id,
        "item_type": "tool",
        "name": tool.name,
        "subtitle": tool.subtitle,
        "tool_type": tool.tool_type,
    }


def _build_liquid_toolbar_item(liquid_id: str) -> dict[str, object]:
    liquid = get_workbench_liquid_definition(liquid_id)
    details = _LIQUID_DETAILS[liquid_id]
    liquid_type = str(details["liquid_type"])
    return {
        "accent": liquid.accent,
        "allowed_drop_targets": get_liquid_allowed_drop_targets(liquid_type),
        "description": details["description"],
        "id": liquid.id,
        "item_type": "liquid",
        "liquid_type": liquid_type,
        "name": liquid.name,
        "subtitle": details["subtitle"],
        "transfer_volume_ml": liquid.transfer_volume_ml,
    }


def _build_workspace_widget_toolbar_item(widget_id: str) -> dict[str, object]:
    widget = _WORKSPACE_WIDGET_ITEMS[widget_id]
    return {
        "accent": widget["accent"],
        "allowed_drop_targets": ["workspace_canvas"],
        "description": widget["description"],
        "id": widget_id,
        "item_type": "workspace_widget",
        "name": widget["name"],
        "subtitle": widget["subtitle"],
        "widget_type": widget["widget_type"],
    }


def _build_sample_label_toolbar_item() -> dict[str, object]:
    return {
        "accent": "sky",
        "allowed_drop_targets": get_sample_label_allowed_drop_targets(),
        "description": "Manual adhesive label with editable free text.",
        "id": "sampling_bag_label",
        "item_type": "sample_label",
        "name": "Label",
        "subtitle": "Free note",
    }


def _build_toolbar_item(item_id: str, item_source: str) -> dict[str, object]:
    if item_id == "sampling_bag_label":
        return _build_sample_label_toolbar_item()
    if item_source == "tools" or item_id in WORKBENCH_TOOLS:
        return _build_tool_toolbar_item(item_id)
    if item_source == "liquids" or item_id in WORKBENCH_LIQUIDS:
        return _build_liquid_toolbar_item(item_id)
    if item_source == "workspace_widgets":
        return _build_workspace_widget_toolbar_item(item_id)
    raise ValueError(f"Unknown toolbar item: {item_id}")


def get_toolbar_categories() -> list[dict[str, object]]:
    return [
        {
            "description": category["description"],
            "id": category["id"],
            "items": [_build_toolbar_item(str(item_id), str(category["item_source"])) for item_id in category["item_ids"]],
            "label": category["label"],
        }
        for category in _TOOLBAR_CATEGORY_DEFINITIONS
    ]
