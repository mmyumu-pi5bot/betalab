import os
from dataclasses import dataclass, field


def _parse_csv_env(name: str, default: str) -> list[str]:
    raw_value = os.getenv(name, default)
    return [value.strip() for value in raw_value.split(",") if value.strip()]


def _parse_positive_float_env(name: str, default: float) -> float:
    """A speed of zero, backwards or gibberish is a typo, not an instruction."""
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    try:
        value = float(raw_value)
    except ValueError:
        return default
    return value if value > 0 else default


@dataclass(frozen=True)
class Settings:
    app_name: str = "Betalab Simulation API"
    app_version: str = "0.1.0"
    environment: str = field(default_factory=lambda: os.getenv("BETALAB_ENV", "development").strip().lower())
    experiments_db_path: str = field(
        default_factory=lambda: os.getenv(
            "BETALAB_EXPERIMENTS_DB_PATH",
            "./data/experiments.sqlite3",
        )
    )
    #: Simulated seconds per wall-clock second. Left at 1.0 the laboratory runs
    #: in real time, which is the point of waiting for a grind or for a tube to
    #: chill. Raised — ``BETALAB_SIMULATION_SPEED=10`` — every time-based
    #: phenomenon advances that much faster, which is how the end-to-end suite
    #: stops paying half a minute per cryogenic cycle.
    simulation_speed: float = field(
        default_factory=lambda: _parse_positive_float_env("BETALAB_SIMULATION_SPEED", 1.0)
    )
    cors_allowed_origins: list[str] = field(
        default_factory=lambda: _parse_csv_env(
            "BETALAB_CORS_ALLOWED_ORIGINS",
            "http://localhost:3000,http://127.0.0.1:3000",
        )
    )

    @property
    def debug_inspector_enabled(self) -> bool:
        return self.environment == "development"


settings = Settings()
