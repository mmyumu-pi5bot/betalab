import os
from dataclasses import dataclass, field


def _parse_csv_env(name: str, default: str) -> list[str]:
    raw_value = os.getenv(name, default)
    return [value.strip() for value in raw_value.split(",") if value.strip()]


@dataclass(frozen=True)
class Settings:
    app_name: str = "Betalab Simulation API"
    app_version: str = "0.1.0"
    environment: str = field(
        default_factory=lambda: os.getenv("BETALAB_ENV", "development").strip().lower()
    )
    experiments_db_path: str = field(
        default_factory=lambda: os.getenv(
            "BETALAB_EXPERIMENTS_DB_PATH",
            "./data/experiments.sqlite3",
        )
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
