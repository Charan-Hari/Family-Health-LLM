"""Deterministic MVP extraction; replace behind this interface with reviewed OCR providers."""

import re
from pathlib import Path
from uuid import UUID

from .models import MedicationInput, PrescriptionExtraction

_MEDICATION_PATTERNS: dict[str, tuple[str, str | None]] = {
    "bactrim": ("Sulfamethoxazole / trimethoprim", None),
    "sulfamethoxazole": ("Sulfamethoxazole / trimethoprim", None),
    "telma": ("Telmisartan", None),
    "telmisartan": ("Telmisartan", None),
    "warfarin": ("Warfarin", None),
    "ibuprofen": ("Ibuprofen", None),
    "clarithromycin": ("Clarithromycin", None),
    "amoxicillin": ("Amoxicillin", None),
    "paracetamol": ("Paracetamol", None),
    "crocin": ("Paracetamol", None),
}


def extract_prescription(member_id: UUID, filename: str, content: bytes) -> PrescriptionExtraction:
    """Extract known medication candidates from UTF-8 text for a safely demonstrable MVP."""
    text = content.decode("utf-8", errors="ignore").lower()
    filename_stem = Path(filename).stem.lower()
    source = f"{text} {filename_stem}"
    medications: list[MedicationInput] = []
    for search_term, (name, default_dose) in _MEDICATION_PATTERNS.items():
        if search_term in source and not any(item.name == name for item in medications):
            dose_match = re.search(
                rf"{re.escape(search_term)}\s*(\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml))",
                source,
            )
            medications.append(
                MedicationInput(name=name, dose=dose_match.group(1) if dose_match else default_dose)
            )

    notes = [
        "Automated extraction is an MVP candidate list and must be reviewed before it is saved as a medication.",
        "No uploaded document bytes are retained by this development implementation.",
    ]
    if not medications:
        notes.append(
            "No supported medication candidate was recognized. Enter medication details manually."
        )

    return PrescriptionExtraction(
        member_id=member_id,
        source_filename=Path(filename).name,
        extracted_medications=medications,
        extraction_notes=notes,
    )
