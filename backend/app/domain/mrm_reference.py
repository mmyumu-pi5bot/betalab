"""Reference MRM catalog — the hidden instrumental truth of the simulation.

This module answers one question: *if the mass spectrometer is set to watch the
pair (Q1, Q3), which compound does it actually see?*

It is deliberately separate from :mod:`app.domain.acquisition_methods`, which
describes what the technician *asked* the instrument to watch. A method may
declare a transition that matches nothing here; the instrument will then record
baseline noise, which is exactly the pedagogical point.

.. warning::
   **Every m/z, collision energy and retention time below is an educational
   placeholder.** None of it comes from a validated laboratory method, a vendor
   application note or the literature. The values are internally consistent and
   plausible in magnitude so that the simulation teaches the right reflexes, but
   they must never be reused as analytical reference data. Each entry carries a
   ``provenance`` marker saying so.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

TransitionRole = Literal["quantifier", "qualifier"]
CompoundKind = Literal["analyte", "internal_standard"]
Polarity = Literal["positive", "negative"]
TransitionProvenance = Literal["educational_placeholder"]

#: Half-width, in m/z units, of the window within which a declared transition is
#: considered to address a reference transition. A quadrupole set 0.5 u away from
#: the true precursor still transmits part of the isotopic envelope; beyond that
#: the channel is empty. Used by the signal generator to decide whether a method
#: transition produces a peak or only baseline noise.
MZ_MATCH_TOLERANCE = 0.5

#: Identifier of the single internal standard channel modelled by the simulation.
#: The bench only ever offers one generic ``istd_solution`` liquid, so all
#: analytes are corrected against this one compound.
INTERNAL_STANDARD_COMPOUND_ID = "istd_triphenyl_phosphate_d15"


@dataclass(frozen=True, slots=True)
class ReferenceTransition:
    """One MRM channel that the simulated instrument can genuinely detect."""

    compound_id: str
    compound_label: str
    compound_kind: CompoundKind
    q1_mz: float
    q3_mz: float
    polarity: Polarity
    role: TransitionRole
    collision_energy_v: float
    expected_retention_time_s: float
    provenance: TransitionProvenance = "educational_placeholder"


# Retention times are spread over the 720 s run in rough order of increasing
# hydrophobicity, so that the teaching chromatogram reads left to right like a
# real reversed-phase separation.
MRM_REFERENCE_CATALOG: tuple[ReferenceTransition, ...] = (
    # --- Neonicotinoid insecticides: early eluting, positive electrospray ----
    ReferenceTransition(
        "imidacloprid", "Imidacloprid", "analyte",
        256.1, 209.1, "positive", "quantifier", 19.0, 186.0,
    ),
    ReferenceTransition(
        "imidacloprid", "Imidacloprid", "analyte",
        256.1, 175.1, "positive", "qualifier", 25.0, 186.0,
    ),
    ReferenceTransition(
        "acetamiprid", "Acetamiprid", "analyte",
        223.1, 126.0, "positive", "quantifier", 22.0, 204.0,
    ),
    ReferenceTransition(
        "acetamiprid", "Acetamiprid", "analyte",
        223.1, 56.1, "positive", "qualifier", 30.0, 204.0,
    ),
    ReferenceTransition(
        "thiacloprid", "Thiacloprid", "analyte",
        253.0, 126.0, "positive", "quantifier", 23.0, 228.0,
    ),
    ReferenceTransition(
        "thiacloprid", "Thiacloprid", "analyte",
        253.0, 90.1, "positive", "qualifier", 34.0, 228.0,
    ),
    # --- Carbamate insecticide --------------------------------------------
    ReferenceTransition(
        "pyrimicarb", "Pirimicarb", "analyte",
        239.2, 72.1, "positive", "quantifier", 24.0, 252.0,
    ),
    ReferenceTransition(
        "pyrimicarb", "Pirimicarb", "analyte",
        239.2, 182.1, "positive", "qualifier", 18.0, 252.0,
    ),
    # --- Phthalimide / contact fungicides ----------------------------------
    ReferenceTransition(
        "captan", "Captan", "analyte",
        300.0, 264.0, "positive", "quantifier", 12.0, 300.0,
    ),
    ReferenceTransition(
        "captan", "Captan", "analyte",
        300.0, 79.0, "positive", "qualifier", 28.0, 300.0,
    ),
    ReferenceTransition(
        "dithianon", "Dithianon", "analyte",
        297.0, 269.0, "negative", "quantifier", 20.0, 342.0,
    ),
    ReferenceTransition(
        "dithianon", "Dithianon", "analyte",
        297.0, 225.0, "negative", "qualifier", 29.0, 342.0,
    ),
    # --- SDHI fungicides ----------------------------------------------------
    ReferenceTransition(
        "spirotetramat", "Spirotetramat", "analyte",
        374.2, 330.2, "positive", "quantifier", 21.0, 366.0,
    ),
    ReferenceTransition(
        "spirotetramat", "Spirotetramat", "analyte",
        374.2, 302.2, "positive", "qualifier", 27.0, 366.0,
    ),
    ReferenceTransition(
        "boscalid", "Boscalid", "analyte",
        343.0, 307.0, "positive", "quantifier", 24.0, 402.0,
    ),
    ReferenceTransition(
        "boscalid", "Boscalid", "analyte",
        343.0, 271.1, "positive", "qualifier", 33.0, 402.0,
    ),
    ReferenceTransition(
        "fluxapyroxad", "Fluxapyroxad", "analyte",
        382.1, 362.1, "positive", "quantifier", 22.0, 420.0,
    ),
    ReferenceTransition(
        "fluxapyroxad", "Fluxapyroxad", "analyte",
        382.1, 342.1, "positive", "qualifier", 31.0, 420.0,
    ),
    # --- Organophosphate insecticide ---------------------------------------
    ReferenceTransition(
        "chlorpyrifos_methyl", "Chlorpyrifos-methyl", "analyte",
        322.0, 125.0, "positive", "quantifier", 20.0, 486.0,
    ),
    ReferenceTransition(
        "chlorpyrifos_methyl", "Chlorpyrifos-methyl", "analyte",
        322.0, 290.0, "positive", "qualifier", 15.0, 486.0,
    ),
    # --- Pyrethroid insecticides: late eluting ------------------------------
    ReferenceTransition(
        "lambda_cyhalothrin", "Lambda-cyhalothrin", "analyte",
        467.1, 225.1, "positive", "quantifier", 16.0, 570.0,
    ),
    ReferenceTransition(
        "lambda_cyhalothrin", "Lambda-cyhalothrin", "analyte",
        467.1, 141.1, "positive", "qualifier", 30.0, 570.0,
    ),
    ReferenceTransition(
        "deltamethrin", "Deltamethrin", "analyte",
        523.0, 281.0, "positive", "quantifier", 14.0, 612.0,
    ),
    ReferenceTransition(
        "deltamethrin", "Deltamethrin", "analyte",
        523.0, 207.9, "positive", "qualifier", 22.0, 612.0,
    ),
    # --- Internal standard --------------------------------------------------
    ReferenceTransition(
        INTERNAL_STANDARD_COMPOUND_ID, "Triphenyl phosphate-d15", "internal_standard",
        342.2, 168.1, "positive", "quantifier", 35.0, 396.0,
    ),
)


def reference_transitions_for(compound_id: str) -> tuple[ReferenceTransition, ...]:
    """Return every reference channel belonging to ``compound_id``."""
    return tuple(t for t in MRM_REFERENCE_CATALOG if t.compound_id == compound_id)


def find_reference_transition(
    q1_mz: float,
    q3_mz: float,
    tolerance: float = MZ_MATCH_TOLERANCE,
) -> ReferenceTransition | None:
    """Return the reference channel addressed by ``(q1_mz, q3_mz)``, if any.

    Matching is purely numeric: the compound named by a method transition is
    never consulted. Watching the right masses under the wrong compound name
    still yields signal, and watching the wrong masses under the right name
    still yields nothing.
    """
    best: ReferenceTransition | None = None
    best_distance = float("inf")
    for candidate in MRM_REFERENCE_CATALOG:
        q1_delta = abs(candidate.q1_mz - q1_mz)
        q3_delta = abs(candidate.q3_mz - q3_mz)
        if q1_delta > tolerance or q3_delta > tolerance:
            continue
        distance = q1_delta + q3_delta
        if distance < best_distance:
            best = candidate
            best_distance = distance
    return best
