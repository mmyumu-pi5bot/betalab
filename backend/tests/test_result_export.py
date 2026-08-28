"""Tests for the result files a finished sequence hands to the analysis platform.

Two documents leave Betalab, and they are a matched pair. The method file
(``.cod.xlsx``) declares the events and the channels; each injection file
(``.mzML.json``) references them back by ``event`` and ``seg_id``. Nothing here
integrates a peak or reads a concentration — the boundary drawn in
:class:`app.domain.models.TransitionTrace` still holds on the way out.
"""

from __future__ import annotations

import io
import json
import zipfile
from dataclasses import replace

import openpyxl
import pytest

from app.domain.acquisition_methods import APPLE_PESTICIDES_MRM_V1
from app.domain.models import (
    InjectionMeasurement,
    SampleWeighing,
    TraceAcquisitionMetadata,
    TransitionTrace,
)
from app.domain.mrm_reference import INTERNAL_STANDARD_COMPOUND_ID
from app.services.exports.batch_infos import NOMINAL_EXTRACT_VOLUME_ML, build_batch_infos_document
from app.services.exports.injection_json import build_injection_document
from app.services.exports.method_cod import COD_BASE_COLUMNS, build_method_cod_rows, build_method_cod_workbook
from app.services.exports.run_bundle import build_run_bundle


def _method(compound_ids: tuple[str, ...] = ("boscalid", "imidacloprid")):
    """The built-in method narrowed to a couple of compounds, order preserved."""
    transitions = tuple(
        transition for compound_id in compound_ids for transition in APPLE_PESTICIDES_MRM_V1.transitions if transition.compound_id == compound_id
    )
    return replace(APPLE_PESTICIDES_MRM_V1, transitions=transitions)


def _trace(transition, times_s, intensities):
    return TransitionTrace(
        injection_id="inj_1",
        transition=transition,
        times_s=list(times_s),
        intensities=list(intensities),
        acquisition=TraceAcquisitionMetadata(
            run_duration_s=720.0,
            point_count=len(times_s),
            sampling_interval_s=0.5,
            dwell_time_ms=transition.dwell_time_ms,
            polarity=transition.polarity,
            matched_reference_transition=True,
            acquired_in_retention_window=True,
        ),
    )


def _injection(method, output_filename="cal_1.00 ng_mL.mzML"):
    traces = [_trace(transition, [60.0, 60.5, 61.0], [0.0, 100.0, 20.0]) for transition in method.transitions]
    return InjectionMeasurement(
        id="inj_1",
        vial_id="vial_1",
        vial_label="V1",
        rack_slot_id="rack_slot_1",
        status="ok",
        traces=traces,
        sample_name="Cal 1",
        output_filename=output_filename,
        start_offset_s=0.0,
    )


def _weighed(injection, sample_mass_g=5.2, extract_volume_ml=10.4):
    injection.weighing = SampleWeighing(sample_mass_g=sample_mass_g, extract_volume_ml=extract_volume_ml)
    return injection


class TestBatchInfos:
    """The sample data that turns a concentration in a vial into a residue.

    The platform divides by ``weight`` and multiplies by its own configured
    ``vol_sol_ext``; ``dilution_factor`` is the dimensionless multiplier that
    reconciles that constant with the volume actually poured in the tube.
    """

    def test_an_analysis_is_keyed_and_named_as_the_injection_file_is(self) -> None:
        method = _method()
        injection = _weighed(_injection(method, "01_Apple.mzML"))

        document = build_batch_infos_document([injection])

        analyses = document["batch_infos"]["analyses_infos"]
        assert list(analyses) == ["01_apple"]
        assert analyses["01_apple"]["name"] == "01_apple"

    def test_the_weight_is_the_mass_the_operator_declared(self) -> None:
        method = _method()
        injection = _weighed(_injection(method, "01_apple.mzML"), sample_mass_g=5.2)

        document = build_batch_infos_document([injection])

        assert document["batch_infos"]["analyses_infos"]["01_apple"]["weight"] == 5.2

    def test_the_dilution_factor_expresses_the_poured_volume_in_nominal_units(self) -> None:
        method = _method()
        nominal = _weighed(_injection(method, "01_nominal.mzML"), extract_volume_ml=NOMINAL_EXTRACT_VOLUME_ML)
        doubled = _weighed(_injection(method, "02_doubled.mzML"), extract_volume_ml=NOMINAL_EXTRACT_VOLUME_ML * 2)

        analyses = build_batch_infos_document([nominal, doubled])["batch_infos"]["analyses_infos"]

        assert analyses["01_nominal"]["dilution_factor"] == 1.0
        assert analyses["02_doubled"]["dilution_factor"] == 2.0

    def test_the_final_factor_is_neutral_because_the_default_formula_ignores_it(self) -> None:
        method = _method()

        analyses = build_batch_infos_document([_weighed(_injection(method, "01_apple.mzML"))])["batch_infos"]["analyses_infos"]

        assert analyses["01_apple"]["final_factor"] == 1.0

    def test_an_injection_with_nothing_on_a_balance_behind_it_is_left_out(self) -> None:
        """A calibration standard was never weighed, so it has no entry at all —
        neutral figures would be a weighing the platform never performed."""
        method = _method()
        standard = _injection(method, "01_cal.mzML")
        sample = _weighed(_injection(method, "02_apple.mzML"))

        analyses = build_batch_infos_document([standard, sample])["batch_infos"]["analyses_infos"]

        assert list(analyses) == ["02_apple"]

    def test_a_batch_of_standards_alone_still_yields_the_document(self) -> None:
        document = build_batch_infos_document([_injection(_method(), "01_cal.mzML")])

        assert document == {"batch_infos": {"analyses_infos": {}}}


class TestInjectionDocument:
    def test_names_the_analysis_after_the_output_file_in_lower_case(self) -> None:
        method = _method()
        document = build_injection_document(_injection(method), method)

        assert document["analysis_infos"] == {"name": "cal_1.00 ng_ml"}

    def test_one_measure_per_compound_numbered_from_one(self) -> None:
        method = _method()
        document = build_injection_document(_injection(method), method)

        assert [measure["event"] for measure in document["measures"]] == [1, 2]
        assert len(document["measures"]) == 2

    def test_both_channels_of_a_compound_share_one_time_axis_in_minutes(self) -> None:
        method = _method()
        document = build_injection_document(_injection(method), method)

        measure = document["measures"][0]
        assert measure["time"] == [1.0, 1.008333, 1.016667]
        assert set(measure["channels"]) == {"1", "2"}
        assert measure["main_channel"] == 1
        assert len(measure["channels"]["2"]["raw_ampl"]) == len(measure["time"])

    def test_the_time_step_is_the_mean_interval_in_minutes(self) -> None:
        method = _method()
        document = build_injection_document(_injection(method), method)

        assert document["measures"][0]["time_step"] == pytest.approx(0.5 / 60.0, rel=1e-6)

    def test_channel_one_is_the_quantifier_and_carries_the_declared_numbers(self) -> None:
        method = _method(("boscalid",))
        quantifier = next(t for t in method.transitions if t.role == "quantifier")
        document = build_injection_document(_injection(method), method)

        channel = document["measures"][0]["channels"]["1"]
        assert channel["q1"] == quantifier.q1_mz
        assert channel["q3"] == quantifier.q3_mz
        assert channel["ce"] == quantifier.collision_energy_v

    def test_segment_ids_run_from_zero_across_every_channel(self) -> None:
        method = _method()
        document = build_injection_document(_injection(method), method)

        seg_ids = [channel["seg_id"] for measure in document["measures"] for channel in measure["channels"].values()]
        assert seg_ids == [0, 1, 2, 3]
        first = document["measures"][0]["channels"]["1"]
        assert first["segment"] == first["seg_id"]

    def test_writes_the_raw_trace_and_no_smoothed_copy_of_it(self) -> None:
        """Smoothing is a processing choice and belongs to the analysis app."""
        method = _method(("boscalid",))
        document = build_injection_document(_injection(method), method)

        channel = document["measures"][0]["channels"]["1"]
        assert channel["raw_ampl"] == [0.0, 100.0, 20.0]
        assert "ampl" not in channel
        assert channel["ampl_min"] == 0.0
        assert channel["ampl_max"] == 100.0

    def test_carries_no_peak_picking_verdict(self) -> None:
        """The platform names its own strategy from its own configuration."""
        method = _method(("boscalid",))
        document = build_injection_document(_injection(method), method)

        channel = document["measures"][0]["channels"]["1"]
        assert "candidates" not in channel
        assert "selected_policy" not in channel
        assert "initial_selected_policy" not in channel

    def test_a_qualifier_on_its_own_schedule_is_aligned_onto_the_event_axis(self) -> None:
        """The instrument samples the two channels a dwell apart; the file folds
        them onto the event's cycle axis, exactly as vendor software does."""
        method = _method(("boscalid",))
        quantifier = next(t for t in method.transitions if t.role == "quantifier")
        qualifier = next(t for t in method.transitions if t.role == "qualifier")
        injection = _injection(method)
        injection.traces = [
            _trace(quantifier, [60.0, 61.0, 62.0], [0.0, 100.0, 0.0]),
            _trace(qualifier, [60.5, 61.5], [40.0, 20.0]),
        ]

        document = build_injection_document(injection, method)

        measure = document["measures"][0]
        assert measure["time"] == [1.0, 1.016667, 1.033333]
        # Interpolated onto the axis, and zero where the qualifier was not watching.
        assert measure["channels"]["2"]["raw_ampl"] == [0.0, 30.0, 0.0]

    def test_an_empty_channel_yields_an_empty_measure_rather_than_a_gap(self) -> None:
        method = _method(("boscalid",))
        injection = _injection(method)
        for trace in injection.traces:
            trace.times_s = []
            trace.intensities = []

        document = build_injection_document(injection, method)

        measure = document["measures"][0]
        assert measure["time"] == []
        assert measure["time_step"] == 0.0
        assert measure["channels"]["1"]["raw_ampl"] == []
        assert measure["channels"]["1"]["ampl_max"] == 0.0


class TestMethodCodFile:
    def test_the_header_matches_the_platform_layout(self) -> None:
        header, _ = build_method_cod_rows(_method())

        assert header[0] == ""
        assert header[1:] == list(COD_BASE_COLUMNS)

    def test_one_row_per_compound_indexed_from_zero_and_evented_from_one(self) -> None:
        header, rows = build_method_cod_rows(_method())

        assert len(rows) == 2
        assert [row[0] for row in rows] == [0, 1]
        assert [row[header.index("event")] for row in rows] == [1, 2]
        assert rows[0][header.index("name")] == "Boscalid"

    def test_retention_columns_are_expressed_in_minutes(self) -> None:
        method = _method(("boscalid",))
        transition = method.transitions[0]
        header, rows = build_method_cod_rows(method)

        expected_rt = transition.expected_retention_time_s / 60.0
        half_window = transition.retention_window_s / 2.0 / 60.0
        assert rows[0][header.index("ret_time")] == pytest.approx(expected_rt)
        assert rows[0][header.index("min_time")] == pytest.approx(expected_rt - half_window)
        assert rows[0][header.index("max_time")] == pytest.approx(expected_rt + half_window)

    def test_segment_ids_match_the_ones_written_in_the_injection_file(self) -> None:
        method = _method()
        header, rows = build_method_cod_rows(method)
        document = build_injection_document(_injection(method), method)

        from_cod = [row[header.index(f"Ch.({channel}) seg_id")] for row in rows for channel in (1, 2)]
        from_json = [channel["seg_id"] for measure in document["measures"] for channel in measure["channels"].values()]
        assert from_cod == from_json

    def test_the_internal_standard_is_flagged_and_named_on_its_analytes(self) -> None:
        method = _method(("boscalid", INTERNAL_STANDARD_COMPOUND_ID))
        header, rows = build_method_cod_rows(method)

        analyte = rows[0]
        standard = rows[1]
        assert analyte[header.index("is_istd")] == 0
        assert analyte[header.index("istd_name")] == "Triphenyl phosphate-d15"
        assert standard[header.index("is_istd")] == 1
        assert standard[header.index("istd_name")] == ""

    def test_columns_betalab_does_not_model_are_left_empty(self) -> None:
        """Their own reference file leaves these blank; inventing a CAS number
        would be inventing a real-world identifier, not a placeholder."""
        header, rows = build_method_cod_rows(_method())

        for column in ("num_cas", "formula", "loq", "loq_unit", "nb_peaks", "group"):
            assert rows[0][header.index(column)] == ""

    def test_one_concentration_column_per_declared_level_in_the_typed_order(self) -> None:
        method = replace(_method(), calibration_levels_ng_per_ml=(10.0, 1.0, 5.0))
        header, rows = build_method_cod_rows(method)

        assert header[-3:] == ["Conc.(0)", "Conc.(1)", "Conc.(2)"]
        assert rows[0][-3:] == [10.0, 1.0, 5.0]
        assert rows[1][-3:] == [10.0, 1.0, 5.0]

    def test_a_single_declared_level_yields_a_single_column(self) -> None:
        method = replace(_method(), calibration_levels_ng_per_ml=(2.5,))
        header, rows = build_method_cod_rows(method)

        assert header[-1] == "Conc.(0)"
        assert "Conc.(1)" not in header
        assert rows[0][-1] == 2.5

    def test_an_undeclared_ladder_yields_no_concentration_column_at_all(self) -> None:
        header, _rows = build_method_cod_rows(_method())

        assert not any(column.startswith("Conc.") for column in header)
        assert header[-1] == "Ch.(2) ev"

    def test_the_workbook_is_a_readable_xlsx_carrying_those_rows(self) -> None:
        method = replace(_method(), calibration_levels_ng_per_ml=(1.0, 2.0))
        header, _rows = build_method_cod_rows(method)

        workbook = openpyxl.load_workbook(io.BytesIO(build_method_cod_workbook(method)))
        sheet = workbook.active

        assert [cell.value for cell in sheet[1]] == [value if value != "" else None for value in header]
        assert sheet.cell(row=2, column=header.index("name") + 1).value == "Boscalid"
        assert sheet.cell(row=2, column=len(header)).value == 2.0


class TestRunBundle:
    def _run(self, method, injections):
        from app.domain.models import SequenceRun

        return SequenceRun(
            id="run_1",
            injections=injections,
            method_id=method.id,
            method_snapshot=method,
            total_duration_s=720.0 * len(injections),
            elapsed_s=720.0 * len(injections),
        )

    def test_bundles_the_method_file_and_one_file_per_injection(self) -> None:
        method = _method()
        first = _injection(method, "01_apple.mzML")
        second = _injection(method, "02_cal.mzML")
        second.start_offset_s = 720.0

        archive = zipfile.ZipFile(io.BytesIO(build_run_bundle(self._run(method, [first, second]))))

        assert sorted(archive.namelist()) == [
            "01_apple.mzML.json",
            "02_cal.mzML.json",
            f"{method.id}.cod.xlsx",
            "batch_infos.json",
        ]

    def test_the_bundled_json_is_the_injection_document(self) -> None:
        method = _method()
        injection = _injection(method, "01_apple.mzML")

        archive = zipfile.ZipFile(io.BytesIO(build_run_bundle(self._run(method, [injection]))))
        document = json.loads(archive.read("01_apple.mzML.json"))

        assert document == build_injection_document(injection, method)

    def test_an_injection_the_instrument_has_not_finished_is_not_written_yet(self) -> None:
        """A file lands as its own injection completes, not when the run does."""
        method = _method()
        first = _injection(method, "01_apple.mzML")
        second = _injection(method, "02_cal.mzML")
        second.start_offset_s = 720.0
        run = self._run(method, [first, second])
        run.elapsed_s = 900.0

        archive = zipfile.ZipFile(io.BytesIO(build_run_bundle(run)))

        assert sorted(archive.namelist()) == ["01_apple.mzML.json", f"{method.id}.cod.xlsx", "batch_infos.json"]

    def test_the_batch_file_describes_the_injections_already_written(self) -> None:
        method = _method()
        first = _weighed(_injection(method, "01_apple.mzML"))
        second = _weighed(_injection(method, "02_apple.mzML"))
        second.start_offset_s = 720.0
        run = self._run(method, [first, second])
        run.elapsed_s = 900.0

        archive = zipfile.ZipFile(io.BytesIO(build_run_bundle(run)))
        document = json.loads(archive.read("batch_infos.json"))

        assert list(document["batch_infos"]["analyses_infos"]) == ["01_apple"]

    def test_the_method_file_travels_even_before_any_injection_finished(self) -> None:
        method = _method()
        run = self._run(method, [_injection(method, "01_apple.mzML")])
        run.elapsed_s = 0.0

        archive = zipfile.ZipFile(io.BytesIO(build_run_bundle(run)))

        assert sorted(archive.namelist()) == [f"{method.id}.cod.xlsx", "batch_infos.json"]


class TestResultDownloadRoute:
    """The archive is fetched, never generated as a side effect of a read."""

    def _experiment_with_run(self, elapsed_s: float = 720.0) -> tuple[str, str]:
        from app.api.experiment_routes.common import experiment_service
        from app.domain.models import SequenceRun

        method = _method()
        experiment_id = experiment_service.create_experiment().id
        experiment = experiment_service._require_experiment(experiment_id)
        instrument = next(widget for widget in experiment.workspace.widgets if widget.id == "instrument")
        instrument.sequence_runs.append(
            SequenceRun(
                id="run_1",
                injections=[_injection(method, "01_apple.mzML")],
                method_id=method.id,
                method_snapshot=method,
                total_duration_s=720.0,
                elapsed_s=elapsed_s,
            )
        )
        return experiment_id, "run_1"

    def test_serves_the_archive_as_a_zip_attachment(self) -> None:
        from fastapi.testclient import TestClient

        from app.main import app

        experiment_id, run_id = self._experiment_with_run()

        response = TestClient(app).get(f"/experiments/{experiment_id}/lcmsms/runs/{run_id}/results")

        assert response.status_code == 200
        assert response.headers["content-type"] == "application/zip"
        assert ".zip" in response.headers["content-disposition"]
        archive = zipfile.ZipFile(io.BytesIO(response.content))
        assert "01_apple.mzML.json" in archive.namelist()

    def test_an_unknown_run_is_a_404(self) -> None:
        from fastapi.testclient import TestClient

        from app.main import app

        experiment_id, _ = self._experiment_with_run()

        response = TestClient(app).get(f"/experiments/{experiment_id}/lcmsms/runs/nope/results")

        assert response.status_code == 404

    def test_an_unknown_experiment_is_a_404(self) -> None:
        from fastapi.testclient import TestClient

        from app.main import app

        response = TestClient(app).get("/experiments/nope/lcmsms/runs/run_1/results")

        assert response.status_code == 404

    def test_downloading_does_not_advance_or_persist_the_simulation(self) -> None:
        """A read stays a read: the archive shows what is recorded, no more."""
        from fastapi.testclient import TestClient

        from app.api.experiment_routes.common import experiment_service
        from app.main import app

        experiment_id, run_id = self._experiment_with_run(elapsed_s=0.0)
        before = experiment_service._require_experiment(experiment_id).last_simulation_at

        TestClient(app).get(f"/experiments/{experiment_id}/lcmsms/runs/{run_id}/results")

        experiment = experiment_service._require_experiment(experiment_id)
        assert experiment.last_simulation_at == before
        assert experiment.workspace.widgets is not None
        instrument = next(w for w in experiment.workspace.widgets if w.id == "instrument")
        assert instrument.sequence_runs[0].elapsed_s == 0.0
