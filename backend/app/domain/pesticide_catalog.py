from __future__ import annotations

import random
from dataclasses import dataclass
from math import exp


@dataclass(frozen=True)
class PesticideInfo:
    compound_id: str
    label: str
    family: str
    mrl_ug_per_kg: float
    # Degradation rate constant [1/(°C·s)] above the degradation threshold.
    # Calibrated so that 30 s at 65°C (25°C above the 40°C threshold):
    #   high k (~3e-3): ~90 % loss  (organophosphates)
    #   medium k (~1e-3): ~50 % loss (carbamates, phthalimide fungicides)
    #   low k (~1e-4): ~7 % loss   (neonicotinoids, SDHI fungicides)
    thermal_k: float
    prevalence: float
    min_ug_per_kg: float
    max_ug_per_kg: float


APPLE_PESTICIDE_CATALOG: list[PesticideInfo] = [
    # SDHI fungicides — very thermostable
    PesticideInfo("boscalid", "Boscalid", "fungicide", 2000.0, 8e-5, 0.70, 20.0, 1200.0),
    PesticideInfo("fluxapyroxad", "Fluxapyroxad", "fungicide", 600.0, 6e-5, 0.35, 10.0, 350.0),
    # Contact/phthalimide fungicides — moderately to highly thermolabile
    PesticideInfo("captan", "Captan", "fungicide", 3000.0, 2e-3, 0.55, 30.0, 1500.0),
    PesticideInfo("dithianon", "Dithianon", "fungicide", 500.0, 1e-3, 0.40, 10.0, 300.0),
    # Neonicotinoid insecticides — thermostable
    PesticideInfo("acetamiprid", "Acetamiprid", "insecticide", 400.0, 9e-5, 0.25, 5.0, 200.0),
    PesticideInfo("imidacloprid", "Imidacloprid", "insecticide", 500.0, 1e-4, 0.20, 5.0, 200.0),
    PesticideInfo("thiacloprid", "Thiacloprid", "insecticide", 300.0, 1e-4, 0.20, 5.0, 150.0),
    # Pyrethroid insecticides — moderately stable
    PesticideInfo("lambda_cyhalothrin", "Lambda-cyhalothrin", "insecticide", 100.0, 2e-4, 0.30, 2.0, 60.0),
    PesticideInfo("deltamethrin", "Deltamethrin", "insecticide", 100.0, 1.5e-4, 0.15, 2.0, 50.0),
    # Organophosphate insecticides — highly thermolabile
    PesticideInfo("chlorpyrifos_methyl", "Chlorpyrifos-methyl", "insecticide", 10.0, 3e-3, 0.12, 0.5, 8.0),
    # Carbamate insecticides — thermolabile
    PesticideInfo("pyrimicarb", "Pirimicarb", "insecticide", 1000.0, 1.5e-3, 0.20, 10.0, 500.0),
    # Tetronic acid insecticides — thermostable
    PesticideInfo("spirotetramat", "Spirotetramat", "insecticide", 800.0, 7e-5, 0.20, 10.0, 400.0),
]

CATALOG_BY_ID: dict[str, PesticideInfo] = {p.compound_id: p for p in APPLE_PESTICIDE_CATALOG}


def generate_pesticide_residues(produce_type: str, rng: random.Random | None = None) -> dict[str, float]:
    if produce_type != "apple":
        return {}
    r = rng or random
    residues: dict[str, float] = {}
    for info in APPLE_PESTICIDE_CATALOG:
        if r.random() < info.prevalence:
            residues[info.compound_id] = round(r.uniform(info.min_ug_per_kg, info.max_ug_per_kg), 1)
    return residues


def compute_current_residue_ug_per_kg(
    initial_ug_per_kg: float,
    degradation_factor: float,
) -> float:
    return initial_ug_per_kg * max(0.0, min(1.0, degradation_factor))


def apply_degradation_step(
    degradation_factors: dict[str, float],
    temperature_c: float,
    elapsed_seconds: float,
    *,
    threshold_c: float = 40.0,
) -> dict[str, float]:
    """Return updated degradation factors for one simulation step."""
    if temperature_c <= threshold_c:
        return degradation_factors
    thermal_stress = (temperature_c - threshold_c) * elapsed_seconds
    return {
        cid: factor * exp(-CATALOG_BY_ID[cid].thermal_k * thermal_stress)
        for cid, factor in degradation_factors.items()
        if cid in CATALOG_BY_ID
    }
