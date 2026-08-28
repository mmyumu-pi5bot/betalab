"""The per-analysis sample data the platform needs to report a residue.

The chromatogram files say what the detector saw; this one says what was on the
balance. Without it the platform can only report a concentration in the vial,
because the step back to a residue in the fruit divides by the weighed mass.

The formula the platform evaluates is::

    residue = C_vial (ug/L) * vol_sol_ext (mL) / weight (g) * dilution_factor

``vol_sol_ext`` is *not* in this file: it is a constant of the platform's own
configuration, one value for every analysis it processes. Betalab's extraction
volume is whatever the learner poured into the tube, so the two are reconciled
through ``dilution_factor``, which is a plain dimensionless multiplier — the
volume actually used, expressed in units of the configured nominal one.

.. warning::
   That makes :data:`NOMINAL_EXTRACT_VOLUME_ML` a shared assumption rather than
   a local choice. It must equal ``formula_infos.vol_sol_ext`` in the receiving
   platform's configuration; if the two disagree, every residue it reports is
   wrong by their ratio, silently and uniformly.
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from app.domain.models import InjectionMeasurement
from app.services.exports.injection_json import analysis_name

#: The platform's ``formula_infos.vol_sol_ext``, in mL. See the module warning.
NOMINAL_EXTRACT_VOLUME_ML = 10.0

#: ``final_factor`` maps to ``F_cal``, which the platform's default formula does
#: not reference at all. Betalab writes the neutral value rather than smuggling
#: a correction into a field that may or may not be read.
_NEUTRAL_FINAL_FACTOR = 1.0

#: Enough digits that a volume typed to the microlitre survives the division.
_FACTOR_DECIMALS = 6

BATCH_INFOS_FILENAME = "batch_infos.json"


def build_batch_infos_document(injections: Iterable[InjectionMeasurement]) -> dict[str, Any]:
    """Describe every weighed sample among ``injections``, keyed as they are named.

    Injections with nothing behind them on a balance — calibration standards,
    vials that never held an extract — are left out entirely rather than given
    neutral figures: the platform must not read a weighing that never happened.
    """
    analyses: dict[str, Any] = {}
    for injection in injections:
        weighing = injection.weighing
        if weighing is None:
            continue
        name = analysis_name(injection.output_filename)
        analyses[name] = {
            "name": name,
            "weight": weighing.sample_mass_g,
            "dilution_factor": round(weighing.extract_volume_ml / NOMINAL_EXTRACT_VOLUME_ML, _FACTOR_DECIMALS),
            "final_factor": _NEUTRAL_FINAL_FACTOR,
        }
    return {"batch_infos": {"analyses_infos": analyses}}
