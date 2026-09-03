from uuid import uuid4

from family_health_llm.models import AlertSeverity, AllergyInput, MedicationInput
from family_health_llm.safety import ClinicalSafetyEngine, normalize_medication_name


def test_normalize_medication_name() -> None:
    assert (
        normalize_medication_name(" Sulfamethoxazole / Trimethoprim ")
        == "sulfamethoxazole trimethoprim"
    )


def test_sulfa_allergy_blocks_bactrim() -> None:
    result = ClinicalSafetyEngine().screen(
        str(uuid4()),
        [MedicationInput(name="Sulfamethoxazole / trimethoprim")],
        [AllergyInput(substance="Sulfa", reaction="Hospitalization")],
        [],
    )

    assert len(result.alerts) == 1
    assert result.alerts[0].severity == AlertSeverity.CRITICAL
    assert result.requires_clinical_confirmation is True


def test_warfarin_and_ibuprofen_are_flagged() -> None:
    result = ClinicalSafetyEngine().screen(
        str(uuid4()),
        [MedicationInput(name="Ibuprofen")],
        [],
        [MedicationInput(name="Warfarin")],
    )

    assert len(result.alerts) == 1
    assert result.alerts[0].severity == AlertSeverity.HIGH


def test_unmatched_medication_has_no_alert() -> None:
    result = ClinicalSafetyEngine().screen(
        str(uuid4()),
        [MedicationInput(name="Paracetamol")],
        [AllergyInput(substance="Penicillin", reaction="Rash")],
        [],
    )

    assert result.alerts == []
