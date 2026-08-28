from __future__ import annotations

import random
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from app.domain.models import SAMPLE_BAG_TARE_MASS_G, ProduceLot, WorkbenchTool, new_id
from app.domain.pesticide_catalog import generate_pesticide_residues
from app.services.helpers.produce_canonical import get_tool_total_produce_mass_g
from app.services.helpers.workbench import sample_tool_contact_impurity_mg_per_g

_ORCHARD_NAME_WEIGHTS: tuple[tuple[str, float], ...] = (
    ("Martin Orchard", 0.24),
    ("North Field Orchard", 0.18),
    ("Golden Ridge Orchard", 0.18),
    ("Riverbend Orchard", 0.14),
    ("Valley Crest Orchard", 0.14),
    ("Green Hollow Orchard", 0.12),
)
_HARVEST_DAYS_BACK_WEIGHTS: tuple[tuple[int, float], ...] = (
    (1, 0.12),
    (2, 0.16),
    (3, 0.18),
    (4, 0.16),
    (5, 0.12),
    (6, 0.1),
    (7, 0.08),
    (8, 0.04),
    (9, 0.02),
    (10, 0.02),
)

_THEORETICAL_LOT_MASS_WEIGHTS_G: tuple[tuple[float, float], ...] = (
    (2000.0, 0.22),
    (2500.0, 0.34),
    (3000.0, 0.2),
    (4000.0, 0.12),
    (5000.0, 0.06),
    (1500.0, 0.06),
)


@dataclass(frozen=True)
class ReceivedAppleSampleSpec:
    orchard_name: str
    harvest_date: str
    theoretical_mass_g: float
    actual_mass_g: float
    unit_count: int

    @property
    def field_label_text(self) -> str:
        return f"{self.orchard_name} • Harvest {self.harvest_date} • Approx. {self.theoretical_mass_g / 1000:.2f} kg"

    @property
    def gross_mass_g(self) -> float:
        return round(self.actual_mass_g + SAMPLE_BAG_TARE_MASS_G, 1)


def generate_received_apple_sample_spec(rng: random.Random | None = None) -> ReceivedAppleSampleSpec:
    rng = rng or random.Random()  # nosec B311 — simulation data, not cryptographic use
    orchard_name = rng.choices(
        [name for name, _weight in _ORCHARD_NAME_WEIGHTS],
        weights=[weight for _name, weight in _ORCHARD_NAME_WEIGHTS],
        k=1,
    )[0]
    harvest_days_back = rng.choices(
        [days for days, _weight in _HARVEST_DAYS_BACK_WEIGHTS],
        weights=[weight for _days, weight in _HARVEST_DAYS_BACK_WEIGHTS],
        k=1,
    )[0]
    harvest_date = (datetime.now(UTC).date() - timedelta(days=harvest_days_back)).isoformat()
    theoretical_mass_g = rng.choices(
        [mass for mass, _weight in _THEORETICAL_LOT_MASS_WEIGHTS_G],
        weights=[weight for _mass, weight in _THEORETICAL_LOT_MASS_WEIGHTS_G],
        k=1,
    )[0]
    deviation_limit_g = max(45.0, theoretical_mass_g * 0.045)
    deviation_g = rng.gauss(0.0, theoretical_mass_g * 0.012)
    deviation_g = max(min(deviation_g, deviation_limit_g), -deviation_limit_g)
    actual_mass_g = round(max(theoretical_mass_g + deviation_g, 1000.0), 1)
    unit_count = max(8, round(actual_mass_g / 205.0))

    return ReceivedAppleSampleSpec(
        orchard_name=orchard_name,
        harvest_date=harvest_date,
        theoretical_mass_g=theoretical_mass_g,
        actual_mass_g=actual_mass_g,
        unit_count=unit_count,
    )


def build_received_sampling_bag(label: str = "Sealed sampling bag") -> WorkbenchTool:
    sample_spec = generate_received_apple_sample_spec()
    tool_id = new_id("bench_tool")
    generator = random.Random(f"sealed_sampling_bag:{tool_id}")  # nosec B311
    produce_lot = ProduceLot(
        id=new_id("produce"),
        label="Orchard apple lot",
        label_code="orchard_apple_lot",
        produce_type="apple",
        total_mass_g=sample_spec.actual_mass_g,
        unit_count=sample_spec.unit_count,
        pesticide_residues=generate_pesticide_residues("apple", generator),
    )
    return WorkbenchTool(
        id=tool_id,
        tool_id="sealed_sampling_bag",
        label=label,
        subtitle="Field reception",
        accent="emerald",
        tool_type="sample_bag",
        capacity_ml=500.0,
        contact_impurity_mg_per_g=sample_tool_contact_impurity_mg_per_g("sample_bag", generator),
        is_sealed=True,
        field_label_text=sample_spec.field_label_text,
        produce_lots=[produce_lot],
    )


def resolve_received_bag_gross_mass_g(received_bag: WorkbenchTool | None) -> float | None:
    if received_bag is None or received_bag.tool_type != "sample_bag":
        return None

    produce_mass_g = get_tool_total_produce_mass_g(received_bag)
    return round(produce_mass_g + SAMPLE_BAG_TARE_MASS_G, 1)
