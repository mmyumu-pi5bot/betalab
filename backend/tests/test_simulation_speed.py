"""The simulation clock can be run faster than wall time, for tests that wait."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from app.core.config import Settings
from app.services import experiment_service as experiment_service_module
from app.services.experiment_service import ExperimentRuntimeService

START = datetime(2026, 8, 8, 9, 0, 0, tzinfo=UTC)


class TestSimulationSpeedSetting:
    def test_defaults_to_real_time(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("BETALAB_SIMULATION_SPEED", raising=False)

        assert Settings().simulation_speed == 1.0

    def test_reads_the_environment(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("BETALAB_SIMULATION_SPEED", "10")

        assert Settings().simulation_speed == 10.0

    @pytest.mark.parametrize("raw", ["0", "-4", "fast", ""])
    def test_falls_back_to_real_time_on_a_useless_value(
        self,
        monkeypatch: pytest.MonkeyPatch,
        raw: str,
    ) -> None:
        monkeypatch.setenv("BETALAB_SIMULATION_SPEED", raw)

        assert Settings().simulation_speed == 1.0


class TestAcceleratedClock:
    def test_spends_the_multiplied_wall_time_on_the_simulation(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        service = ExperimentRuntimeService(simulation_speed=10.0)
        service._now_fn = lambda: START
        experiment_id = service.create_experiment().id

        steps: list[float] = []
        monkeypatch.setattr(
            experiment_service_module,
            "advance_workspace_cryogenics_state",
            lambda experiment, elapsed_ms: steps.append(elapsed_ms),
        )
        monkeypatch.setattr(
            experiment_service_module,
            "advance_sequence_runs",
            lambda experiment, elapsed_ms: None,
        )

        service._now_fn = lambda: START + timedelta(seconds=2)
        service.get_experiment(experiment_id)

        assert sum(steps) == pytest.approx(20_000.0)

    def test_leaves_the_clock_on_real_time_so_speed_cannot_compound(self) -> None:
        service = ExperimentRuntimeService(simulation_speed=10.0)
        service._now_fn = lambda: START
        experiment_id = service.create_experiment().id

        service._now_fn = lambda: START + timedelta(seconds=2)
        service.get_experiment(experiment_id)

        experiment = service._require_experiment(experiment_id)
        assert experiment.last_simulation_at == START + timedelta(seconds=2)

    def test_real_time_is_the_default(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("BETALAB_SIMULATION_SPEED", raising=False)

        assert ExperimentRuntimeService()._simulation_speed == 1.0
