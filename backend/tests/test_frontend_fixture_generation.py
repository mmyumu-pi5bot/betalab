from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def test_frontend_tool_specs_fixture_matches_backend_contract() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    result = subprocess.run(
        [sys.executable, "scripts/gen_frontend_fixtures.py", "--check"],
        cwd=repo_root,
        capture_output=True,
        check=False,
        text=True,
    )

    assert result.returncode == 0, result.stderr
