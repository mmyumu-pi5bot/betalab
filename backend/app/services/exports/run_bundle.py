"""One sequence run, packed as the archive the platform ingests.

The archive holds the method file once and one chromatogram file per injection
— the same pairing the platform expects, and the same shape as the sample
exports it produces itself.

An injection appears once *it* has finished, not once the run has. That is how
a real instrument behaves: each file lands as its own acquisition ends, so a
sequence interrupted halfway still yields the files it managed to record.
"""

from __future__ import annotations

import io
import json
import zipfile

from app.domain.models import InjectionMeasurement, SequenceRun
from app.services.exports.injection_json import build_injection_document
from app.services.exports.method_cod import build_method_cod_workbook


def is_injection_recorded(run: SequenceRun, injection: InjectionMeasurement) -> bool:
    """True once the instrument has finished acquiring ``injection``."""
    return run.elapsed_s >= injection.start_offset_s + run.method_snapshot.runtime_s


def run_bundle_filename(run: SequenceRun) -> str:
    return f"{run.method_snapshot.id}_{run.id}.zip"


def build_run_bundle(run: SequenceRun) -> bytes:
    """Pack the method file and every finished injection into a zip archive."""
    method = run.method_snapshot
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(f"{method.id}.cod.xlsx", build_method_cod_workbook(method))
        for injection in run.injections:
            if not is_injection_recorded(run, injection):
                continue
            document = build_injection_document(injection, method)
            archive.writestr(
                f"{injection.output_filename}.json",
                json.dumps(document, ensure_ascii=False),
            )
    return buffer.getvalue()
