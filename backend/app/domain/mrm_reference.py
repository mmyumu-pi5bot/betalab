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
        "imidacloprid",
        "Imidacloprid",
        "analyte",
        256.1,
        209.1,
        "positive",
        "quantifier",
        19.0,
        186.0,
    ),
    ReferenceTransition(
        "imidacloprid",
        "Imidacloprid",
        "analyte",
        256.1,
        175.1,
        "positive",
        "qualifier",
        25.0,
        186.0,
    ),
    ReferenceTransition(
        "acetamiprid",
        "Acetamiprid",
        "analyte",
        223.1,
        126.0,
        "positive",
        "quantifier",
        22.0,
        204.0,
    ),
    ReferenceTransition(
        "acetamiprid",
        "Acetamiprid",
        "analyte",
        223.1,
        56.1,
        "positive",
        "qualifier",
        30.0,
        204.0,
    ),
    ReferenceTransition(
        "thiacloprid",
        "Thiacloprid",
        "analyte",
        253.0,
        126.0,
        "positive",
        "quantifier",
        23.0,
        228.0,
    ),
    ReferenceTransition(
        "thiacloprid",
        "Thiacloprid",
        "analyte",
        253.0,
        90.1,
        "positive",
        "qualifier",
        34.0,
        228.0,
    ),
    # --- Carbamate insecticide --------------------------------------------
    ReferenceTransition(
        "pyrimicarb",
        "Pirimicarb",
        "analyte",
        239.2,
        72.1,
        "positive",
        "quantifier",
        24.0,
        252.0,
    ),
    ReferenceTransition(
        "pyrimicarb",
        "Pirimicarb",
        "analyte",
        239.2,
        182.1,
        "positive",
        "qualifier",
        18.0,
        252.0,
    ),
    # --- Phthalimide / contact fungicides ----------------------------------
    ReferenceTransition(
        "captan",
        "Captan",
        "analyte",
        300.0,
        264.0,
        "positive",
        "quantifier",
        12.0,
        300.0,
    ),
    ReferenceTransition(
        "captan",
        "Captan",
        "analyte",
        300.0,
        79.0,
        "positive",
        "qualifier",
        28.0,
        300.0,
    ),
    ReferenceTransition(
        "dithianon",
        "Dithianon",
        "analyte",
        297.0,
        269.0,
        "negative",
        "quantifier",
        20.0,
        342.0,
    ),
    ReferenceTransition(
        "dithianon",
        "Dithianon",
        "analyte",
        297.0,
        225.0,
        "negative",
        "qualifier",
        29.0,
        342.0,
    ),
    # --- SDHI fungicides ----------------------------------------------------
    ReferenceTransition(
        "spirotetramat",
        "Spirotetramat",
        "analyte",
        374.2,
        330.2,
        "positive",
        "quantifier",
        21.0,
        366.0,
    ),
    ReferenceTransition(
        "spirotetramat",
        "Spirotetramat",
        "analyte",
        374.2,
        302.2,
        "positive",
        "qualifier",
        27.0,
        366.0,
    ),
    ReferenceTransition(
        "boscalid",
        "Boscalid",
        "analyte",
        343.0,
        307.0,
        "positive",
        "quantifier",
        24.0,
        402.0,
    ),
    ReferenceTransition(
        "boscalid",
        "Boscalid",
        "analyte",
        343.0,
        271.1,
        "positive",
        "qualifier",
        33.0,
        402.0,
    ),
    ReferenceTransition(
        "fluxapyroxad",
        "Fluxapyroxad",
        "analyte",
        382.1,
        362.1,
        "positive",
        "quantifier",
        22.0,
        420.0,
    ),
    ReferenceTransition(
        "fluxapyroxad",
        "Fluxapyroxad",
        "analyte",
        382.1,
        342.1,
        "positive",
        "qualifier",
        31.0,
        420.0,
    ),
    # --- Organophosphate insecticide ---------------------------------------
    ReferenceTransition(
        "chlorpyrifos_methyl",
        "Chlorpyrifos-methyl",
        "analyte",
        322.0,
        125.0,
        "positive",
        "quantifier",
        20.0,
        486.0,
    ),
    ReferenceTransition(
        "chlorpyrifos_methyl",
        "Chlorpyrifos-methyl",
        "analyte",
        322.0,
        290.0,
        "positive",
        "qualifier",
        15.0,
        486.0,
    ),
    # --- Pyrethroid insecticides: late eluting ------------------------------
    ReferenceTransition(
        "lambda_cyhalothrin",
        "Lambda-cyhalothrin",
        "analyte",
        467.1,
        225.1,
        "positive",
        "quantifier",
        16.0,
        570.0,
    ),
    ReferenceTransition(
        "lambda_cyhalothrin",
        "Lambda-cyhalothrin",
        "analyte",
        467.1,
        141.1,
        "positive",
        "qualifier",
        30.0,
        570.0,
    ),
    ReferenceTransition(
        "deltamethrin",
        "Deltamethrin",
        "analyte",
        523.0,
        281.0,
        "positive",
        "quantifier",
        14.0,
        612.0,
    ),
    ReferenceTransition(
        "deltamethrin",
        "Deltamethrin",
        "analyte",
        523.0,
        207.9,
        "positive",
        "qualifier",
        22.0,
        612.0,
    ),
    # --- Internal standard --------------------------------------------------
    ReferenceTransition(
        INTERNAL_STANDARD_COMPOUND_ID,
        "Triphenyl phosphate-d15",
        "internal_standard",
        342.2,
        168.1,
        "positive",
        "quantifier",
        35.0,
        396.0,
    ),
)


def reference_transitions_for(compound_id: str) -> tuple[ReferenceTransition, ...]:
    """Return every reference channel belonging to ``compound_id``."""
    return tuple(t for t in MRM_REFERENCE_CATALOG if t.compound_id == compound_id)


def find_reference_transition(
    q1_mz: float,
    q3_mz: float,
    polarity: Polarity,
    tolerance: float = MZ_MATCH_TOLERANCE,
) -> ReferenceTransition | None:
    """Return the reference channel addressed by ``(q1_mz, q3_mz)``, if any.

    Matching is purely numeric: the compound named by a method transition is
    never consulted. Watching the right masses under the wrong compound name
    still yields signal, and watching the wrong masses under the right name
    still yields nothing.

    Polarity is part of the address, not a label. A molecule that only ionises
    in positive mode produces no ions at all when the source is run negative,
    so the right masses under the wrong polarity address nothing.
    """
    best: ReferenceTransition | None = None
    best_distance = float("inf")
    for candidate in MRM_REFERENCE_CATALOG:
        if candidate.polarity != polarity:
            continue
        q1_delta = abs(candidate.q1_mz - q1_mz)
        q3_delta = abs(candidate.q3_mz - q3_mz)
        if q1_delta > tolerance or q3_delta > tolerance:
            continue
        distance = q1_delta + q3_delta
        if distance < best_distance:
            best = candidate
            best_distance = distance
    return best


@dataclass(frozen=True, slots=True)
class CompoundPeakProfile:
    """What makes one compound's chromatogram look unlike its neighbour's.

    Three properties, all read by the signal generator and none of them
    instrumental settings the technician can reach: they belong to the molecule
    and the column, the way a retention time does.

    .. warning::
       Like every value in this module these are **educational placeholders**.
       They are plausible in magnitude and internally consistent — bases tail,
       late eluters are broader, ion ratios differ per compound — but none of
       them was measured. Do not reuse them as analytical reference data.
    """

    #: Multiplies the shared band width. Late, strongly retained compounds leave
    #: the column broader than early ones.
    width_factor: float
    #: How much wider the trailing half of the peak is than the leading half. 1.0
    #: is a symmetric gaussian; above it the peak drags, which is what a basic
    #: compound interacting with residual silanols actually does on C18.
    tailing_factor: float
    #: Qualifier response as a fraction of the quantifier. This is the ion ratio
    #: an analyst checks to confirm identity, so it has to be a property of the
    #: compound rather than one number shared by the whole method.
    ion_ratio: float


#: Fallback for a compound with no profile of its own: symmetric, average width,
#: and the ion ratio the whole method used before profiles existed.
DEFAULT_PEAK_PROFILE = CompoundPeakProfile(width_factor=1.0, tailing_factor=1.0, ion_ratio=0.35)

#: One entry per compound in :data:`MRM_REFERENCE_CATALOG`. Keyed by compound so
#: the quantifier and the qualifier of one molecule can never drift apart: they
#: are the same peak seen on two channels, and a shape that differed between
#: them would be physically meaningless.
COMPOUND_PEAK_PROFILES: dict[str, CompoundPeakProfile] = {
    # Neonicotinoids and the carbamate: basic, early eluting, visibly tailing.
    "imidacloprid": CompoundPeakProfile(0.95, 1.35, 0.42),
    "acetamiprid": CompoundPeakProfile(0.90, 1.30, 0.34),
    "thiacloprid": CompoundPeakProfile(0.92, 1.28, 0.51),
    "pyrimicarb": CompoundPeakProfile(0.88, 1.45, 0.28),
    # Contact fungicides: neutral, close to symmetric.
    "captan": CompoundPeakProfile(1.15, 1.10, 0.62),
    "dithianon": CompoundPeakProfile(1.05, 1.15, 0.23),
    "spirotetramat": CompoundPeakProfile(1.00, 1.12, 0.47),
    # SDHI fungicides: neutral amides, the best-behaved peaks of the method.
    "boscalid": CompoundPeakProfile(1.02, 1.06, 0.55),
    "fluxapyroxad": CompoundPeakProfile(1.00, 1.05, 0.38),
    # Organophosphate: neutral, broad, symmetric.
    "chlorpyrifos_methyl": CompoundPeakProfile(1.10, 1.04, 0.66),
    # Pyrethroids: last off the column and the broadest of the run.
    "lambda_cyhalothrin": CompoundPeakProfile(1.30, 1.20, 0.19),
    "deltamethrin": CompoundPeakProfile(1.35, 1.25, 0.31),
    # The internal standard has no qualifier channel, so its ion ratio is unused.
    INTERNAL_STANDARD_COMPOUND_ID: CompoundPeakProfile(0.95, 1.08, 0.35),
}


def peak_profile_for(compound_id: str) -> CompoundPeakProfile:
    """Return the peak profile of ``compound_id``, or the neutral default."""
    return COMPOUND_PEAK_PROFILES.get(compound_id, DEFAULT_PEAK_PROFILE)
