"""Grind quality reaching the chromatogram through sampling representativeness."""
from __future__ import annotations

import random

import pytest

from app.domain.models import InjectionContext, QuechersExtractionResult
from app.domain.mrm_reference import INTERNAL_STANDARD_COMPOUND_ID
from app.schemas.experiment import QuechersExtractionResultSchema
from app.services.domain_services.lcmsms import _compute_sample_responses
from app.services.physical_simulation_service import PhysicalSimulationService

COMPOUND = "boscalid"


def _ctx(
    *,
    sampling_representativeness: float | None,
    extract_true_volume_ml: float = 10.0,
) -> InjectionContext:
    return InjectionContext(
        source_tube_id="tube_1",
        sample_mass_g=10.0,
        sample_true_mass_g=10.0,
        extract_volume_ml=10.0,
        extract_true_volume_ml=extract_true_volume_ml,
        effective_residues_ug_per_kg={COMPOUND: 100.0},
        extraction_result=QuechersExtractionResult(
            extraction_manip_factor=1.0,
            istd_manip_factor=1.0,
            istd_phase="pre_solvent",
            sampling_representativeness=sampling_representativeness,
        ),
        istd_volume_ml=0.05,
        istd_true_volume_ml=0.05,
        istd_reference_conc_ng_per_ml=100.0,
    )


def _ratio(ctx: InjectionContext) -> float:
    random.seed(20260808)
    responses = _compute_sample_responses(None, ctx)
    return responses[COMPOUND] / responses[INTERNAL_STANDARD_COMPOUND_ID]


class TestDrawingTheSamplingError:
    def test_a_perfectly_homogeneous_grind_is_fully_representative(self) -> None:
        assert PhysicalSimulationService.draw_sampling_representativeness(1.0) == 1.0

    def test_an_unscored_lot_is_not_penalised(self) -> None:
        assert PhysicalSimulationService.draw_sampling_representativeness(None) == 1.0

    def test_a_coarse_grind_biases_the_aliquot(self) -> None:
        random.seed(7)
        draws = [
            PhysicalSimulationService.draw_sampling_representativeness(0.0)
            for _ in range(200)
        ]

        assert any(draw != 1.0 for draw in draws)
        # Unbiased on average: a coarse grind is as likely to over- as to
        # under-represent the lot.
        assert sum(draws) / len(draws) == pytest.approx(1.0, abs=0.05)

    def test_a_finer_grind_narrows_the_spread(self) -> None:
        def spread(homogeneity: float) -> float:
            random.seed(11)
            draws = [
                PhysicalSimulationService.draw_sampling_representativeness(homogeneity)
                for _ in range(300)
            ]
            mean = sum(draws) / len(draws)
            return sum((draw - mean) ** 2 for draw in draws) / len(draws)

        assert spread(0.9) < spread(0.5) < spread(0.1)

    def test_the_draw_stays_within_physical_bounds(self) -> None:
        random.seed(3)
        draws = [
            PhysicalSimulationService.draw_sampling_representativeness(0.0)
            for _ in range(500)
        ]

        assert all(
            PhysicalSimulationService.sampling_factor_min
            <= draw
            <= PhysicalSimulationService.sampling_factor_max
            for draw in draws
        )


class TestSamplingErrorReachesTheSignal:
    def test_a_biased_aliquot_scales_the_pesticide_response(self) -> None:
        random.seed(20260808)
        full = _compute_sample_responses(None, _ctx(sampling_representativeness=1.0))
        random.seed(20260808)
        half = _compute_sample_responses(None, _ctx(sampling_representativeness=0.5))

        assert half[COMPOUND] == pytest.approx(full[COMPOUND] * 0.5, rel=0.02)

    def test_the_internal_standard_never_carries_the_sampling_error(self) -> None:
        random.seed(20260808)
        full = _compute_sample_responses(None, _ctx(sampling_representativeness=1.0))
        random.seed(20260808)
        half = _compute_sample_responses(None, _ctx(sampling_representativeness=0.5))

        # The ISTD is pipetted into the tube after the powder was weighed.
        assert half[INTERNAL_STANDARD_COMPOUND_ID] == pytest.approx(
            full[INTERNAL_STANDARD_COMPOUND_ID], rel=0.02
        )

    def test_the_ratio_cannot_correct_a_sampling_error(self) -> None:
        assert _ratio(_ctx(sampling_representativeness=0.5)) == pytest.approx(
            _ratio(_ctx(sampling_representativeness=1.0)) * 0.5, rel=0.02
        )

    def test_the_ratio_still_corrects_a_solvent_volume_error(self) -> None:
        """Contrast: dilution hits both channels, so it cancels. Sampling does not."""
        assert _ratio(
            _ctx(sampling_representativeness=1.0, extract_true_volume_ml=12.0)
        ) == pytest.approx(
            _ratio(_ctx(sampling_representativeness=1.0, extract_true_volume_ml=10.0)),
            rel=0.02,
        )

    def test_an_extract_with_no_recorded_bias_is_unaffected(self) -> None:
        random.seed(20260808)
        unknown = _compute_sample_responses(None, _ctx(sampling_representativeness=None))
        random.seed(20260808)
        neutral = _compute_sample_responses(None, _ctx(sampling_representativeness=1.0))

        assert unknown[COMPOUND] == pytest.approx(neutral[COMPOUND], rel=1e-9)


class TestTheBiasIsPersistedButHidden:
    def test_it_is_kept_out_of_the_api_response(self) -> None:
        schema = QuechersExtractionResultSchema(
            extraction_manip_factor=0.9,
            istd_manip_factor=0.9,
            istd_phase="pre_solvent",
            sampling_representativeness=0.7,
        )

        assert "sampling_representativeness" not in schema.model_dump()

    def test_it_survives_being_reloaded_from_storage(self) -> None:
        """Exclusion only hides it on the way out; validation still reads it back."""
        schema = QuechersExtractionResultSchema.model_validate(
            {
                "extraction_manip_factor": 0.9,
                "istd_manip_factor": 0.9,
                "istd_phase": "pre_solvent",
                "sampling_representativeness": 0.7,
            }
        )

        assert schema.sampling_representativeness == 0.7
