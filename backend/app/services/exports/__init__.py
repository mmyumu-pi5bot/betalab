"""Result files a finished sequence hands to the downstream analysis platform.

Betalab plays the instrument *and* the vendor software that writes its files.
That second role is what lives here: it reshapes recorded traces into the two
documents the platform reads, and nothing more. No peak is integrated, no
calibration curve is fitted and no concentration is computed on the way out —
the boundary stated on :class:`app.domain.models.TransitionTrace` holds all the
way to the archive.
"""
