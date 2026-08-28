"""How preparation quality reaches the chromatogram: sampling, matrix, dirt."""

from __future__ import annotations

import random

import pytest

from app.domain.models import InjectionContext, QuechersExtractionResult
from app.domain.mrm_reference import INTERNAL_STANDARD_COMPOUND_ID
from app.schemas.experiment import QuechersExtractionResultSchema
from app.services.domain_services.lcmsms import _compute_sample_responses
from app.services.domain_services.mrm_signal import generate_transition_traces
from app.services.physical_simulation_service import PhysicalSimulationService


def _boscalid_quantifier():
    from app.domain.acquisition_methods import APPLE_PESTICIDES_MRM_V1

    return next(t for t in APPLE_PESTICIDES_MRM_V1.transitions if t.compound_id == COMPOUND and t.role == "quantifier")


def _method_with(*transitions):
    from dataclasses import replace

    from app.domain.acquisition_methods import APPLE_PESTICIDES_MRM_V1

    return replace(APPLE_PESTICIDES_MRM_V1, transitions=tuple(transitions))


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
    responses = _compute_sample_responses(ctx)
    return responses[COMPOUND] / responses[INTERNAL_STANDARD_COMPOUND_ID]


class TestDrawingTheSamplingError:
    def test_a_perfectly_homogeneous_grind_is_fully_representative(self) -> None:
        assert PhysicalSimulationService.draw_sampling_representativeness(1.0) == 1.0

    def test_an_unscored_lot_is_not_penalised(self) -> None:
        assert PhysicalSimulationService.draw_sampling_representativeness(None) == 1.0

    def test_a_coarse_grind_biases_the_aliquot(self) -> None:
        random.seed(7)
        draws = [PhysicalSimulationService.draw_sampling_representativeness(0.0) for _ in range(200)]

        assert any(draw != 1.0 for draw in draws)
        # Unbiased on average: a coarse grind is as likely to over- as to
        # under-represent the lot.
        assert sum(draws) / len(draws) == pytest.approx(1.0, abs=0.05)

    def test_a_finer_grind_narrows_the_spread(self) -> None:
        def spread(homogeneity: float) -> float:
            random.seed(11)
            draws = [PhysicalSimulationService.draw_sampling_representativeness(homogeneity) for _ in range(300)]
            mean = sum(draws) / len(draws)
            return sum((draw - mean) ** 2 for draw in draws) / len(draws)

        assert spread(0.9) < spread(0.5) < spread(0.1)

    def test_the_draw_stays_within_physical_bounds(self) -> None:
        random.seed(3)
        draws = [PhysicalSimulationService.draw_sampling_representativeness(0.0) for _ in range(500)]

        assert all(PhysicalSimulationService.sampling_factor_min <= draw <= PhysicalSimulationService.sampling_factor_max for draw in draws)


class TestSamplingErrorReachesTheSignal:
    def test_a_biased_aliquot_scales_the_pesticide_response(self) -> None:
        random.seed(20260808)
        full = _compute_sample_responses(_ctx(sampling_representativeness=1.0))
        random.seed(20260808)
        half = _compute_sample_responses(_ctx(sampling_representativeness=0.5))

        assert half[COMPOUND] == pytest.approx(full[COMPOUND] * 0.5, rel=0.02)

    def test_the_internal_standard_never_carries_the_sampling_error(self) -> None:
        random.seed(20260808)
        full = _compute_sample_responses(_ctx(sampling_representativeness=1.0))
        random.seed(20260808)
        half = _compute_sample_responses(_ctx(sampling_representativeness=0.5))

        # The ISTD is pipetted into the tube after the powder was weighed.
        assert half[INTERNAL_STANDARD_COMPOUND_ID] == pytest.approx(full[INTERNAL_STANDARD_COMPOUND_ID], rel=0.02)

    def test_the_ratio_cannot_correct_a_sampling_error(self) -> None:
        assert _ratio(_ctx(sampling_representativeness=0.5)) == pytest.approx(_ratio(_ctx(sampling_representativeness=1.0)) * 0.5, rel=0.02)

    def test_the_ratio_still_corrects_a_solvent_volume_error(self) -> None:
        """Contrast: dilution hits both channels, so it cancels. Sampling does not."""
        assert _ratio(_ctx(sampling_representativeness=1.0, extract_true_volume_ml=12.0)) == pytest.approx(
            _ratio(_ctx(sampling_representativeness=1.0, extract_true_volume_ml=10.0)),
            rel=0.02,
        )

    def test_an_extract_with_no_recorded_bias_is_unaffected(self) -> None:
        random.seed(20260808)
        unknown = _compute_sample_responses(_ctx(sampling_representativeness=None))
        random.seed(20260808)
        neutral = _compute_sample_responses(_ctx(sampling_representativeness=1.0))

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


class TestMatrixSuppression:
    """Co-eluting matrix competes for charge, so an extract sees less than a standard."""

    def test_a_standard_in_pure_solvent_is_never_suppressed(self) -> None:
        assert PhysicalSimulationService.matrix_suppression_factor(0.0, 402.0) == 1.0

    def test_a_loaded_extract_loses_signal(self) -> None:
        assert PhysicalSimulationService.matrix_suppression_factor(1.0, 402.0) < 0.8

    def test_diluting_the_extract_recovers_response(self) -> None:
        """The trade-off behind dilute-and-shoot: less matrix, more of the signal."""
        loaded = PhysicalSimulationService.matrix_suppression_factor(1.0, 402.0)
        diluted = PhysicalSimulationService.matrix_suppression_factor(0.1, 402.0)

        assert diluted > loaded
        assert diluted == pytest.approx(1.0, abs=0.05)

    def test_compounds_eluting_among_the_waxes_are_hit_hardest(self) -> None:
        clean_middle = PhysicalSimulationService.matrix_suppression_factor(1.0, 402.0)
        late = PhysicalSimulationService.matrix_suppression_factor(1.0, 612.0)

        assert late < clean_middle

    def test_an_unknown_elution_moment_gets_the_average_matrix(self) -> None:
        """Never assume the void, where suppression is worst."""
        unknown = PhysicalSimulationService.matrix_suppression_factor(1.0, None)
        void = PhysicalSimulationService.matrix_suppression_factor(1.0, 0.0)

        assert unknown > void
        assert unknown == pytest.approx(1.0 / 1.33, rel=1e-3)

    def test_matrix_load_is_sample_per_millilitre_injected(self) -> None:
        assert PhysicalSimulationService.matrix_load_g_per_ml(10.0, 10.0) == 1.0
        assert PhysicalSimulationService.matrix_load_g_per_ml(10.0, 20.0) == 0.5
        assert PhysicalSimulationService.matrix_load_g_per_ml(10.0, 0.0) == 0.0


class TestTheStandardOnlyCorrectsWhatCoElutesWithIt:
    """The reason a non-co-eluting internal standard is a weak correction."""

    def _corrected_ratio(self, retention_time_s: float, matrix_load: float) -> float:
        istd = PhysicalSimulationService.matrix_suppression_factor(matrix_load, 396.0)
        analyte = PhysicalSimulationService.matrix_suppression_factor(matrix_load, retention_time_s)
        return analyte / istd

    def test_a_co_eluting_compound_is_corrected_almost_perfectly(self) -> None:
        # Boscalid elutes six seconds from the standard.
        assert self._corrected_ratio(402.0, 1.0) == pytest.approx(1.0, abs=0.01)

    def test_a_late_eluting_compound_keeps_a_visible_bias(self) -> None:
        # Deltamethrin comes off among the waxes, far from the standard.
        assert self._corrected_ratio(612.0, 1.0) < 0.85

    def test_diluting_shrinks_the_bias_the_standard_cannot_absorb(self) -> None:
        assert self._corrected_ratio(612.0, 0.25) > self._corrected_ratio(612.0, 1.0)


class TestDirtRaisesTheBackground:
    """Grime is diverse junk in tiny mass: it costs signal-to-noise, not response."""

    def test_a_clean_preparation_leaves_the_background_alone(self) -> None:
        assert PhysicalSimulationService.background_scale(0.0, 402.0) == 1.0

    def test_normal_container_contact_stays_invisible(self) -> None:
        # A 10 g lot picks up ~0.1 mg, and the poured aliquot a tenth of that.
        assert PhysicalSimulationService.background_scale(0.01, 402.0) < 1.1

    def test_a_contaminated_fraction_lifts_the_background_visibly(self) -> None:
        contaminated = PhysicalSimulationService.contaminated_fraction_impurity_mg * 0.1

        assert PhysicalSimulationService.background_scale(contaminated, 402.0) > 1.2

    def test_the_background_rises_where_the_matrix_elutes(self) -> None:
        void = PhysicalSimulationService.background_scale(0.11, 30.0)
        middle = PhysicalSimulationService.background_scale(0.11, 402.0)
        waxes = PhysicalSimulationService.background_scale(0.11, 612.0)

        assert middle < waxes < void


class TestDirtInTheTrace:
    def _traces(self, foreign_mg: float):
        random.seed(4242)
        return generate_transition_traces(
            "inj_1",
            _method_with(_boscalid_quantifier()),
            {COMPOUND: 2.0},
            random.Random(4242),
            foreign_mg,
        )

    def test_a_dirty_extract_records_a_higher_baseline(self) -> None:
        clean = self._traces(0.0)[0]
        dirty = self._traces(0.3)[0]

        assert min(dirty.intensities) > min(clean.intensities)

    def test_the_peak_itself_is_not_shrunk_by_dirt(self) -> None:
        """Contamination hurts signal-to-noise; it does not compete for charge."""
        clean = self._traces(0.0)[0]
        dirty = self._traces(0.3)[0]

        clean_height = max(clean.intensities) - min(clean.intensities)
        dirty_height = max(dirty.intensities) - min(dirty.intensities)
        assert dirty_height == pytest.approx(clean_height, rel=0.1)
