"""Explainable, conservative clinical-safety screening rules for the MVP."""

from collections.abc import Iterable

from .models import (
    AlertSeverity,
    AllergyInput,
    MedicationInput,
    SafetyAlert,
    SafetyCheckResponse,
)


def normalize_medication_name(name: str) -> str:
    """Normalize a medication or allergy label for conservative rule matching."""
    return " ".join(name.lower().replace("/", " ").replace("-", " ").split())


def _contains_any(value: str, terms: Iterable[str]) -> bool:
    return any(term in value for term in terms)


class ClinicalSafetyEngine:
    """Returns specific alerts only for a deliberately small, curated MVP ruleset."""

    def screen(
        self,
        member_id: str,
        medications: list[MedicationInput],
        allergies: list[AllergyInput],
        active_medications: list[MedicationInput],
    ) -> SafetyCheckResponse:
        """Screen new medication candidates against provided allergies and current medications."""
        alerts: list[SafetyAlert] = []
        normalized_allergies = [
            (normalize_medication_name(allergy.substance), allergy) for allergy in allergies
        ]

        for medication in medications:
            normalized_medication = normalize_medication_name(medication.name)
            for normalized_allergy, allergy in normalized_allergies:
                sulfa_match = _contains_any(
                    normalized_allergy, ("sulfa", "sulfonamide")
                ) and _contains_any(normalized_medication, ("sulfamethoxazole", "bactrim"))
                direct_match = normalized_allergy in normalized_medication
                if sulfa_match or direct_match:
                    alerts.append(
                        SafetyAlert(
                            id=f"allergy-{normalized_medication.replace(' ', '-')}",
                            severity=AlertSeverity.CRITICAL,
                            title="Potential documented allergy match",
                            explanation=(
                                f"The record lists {allergy.substance} with reaction "
                                f"'{allergy.reaction}', and the candidate is {medication.name}."
                            ),
                            evidence_source="Documented family allergy record; clinician verification required",
                            recommended_action=(
                                "Do not start this medication until the prescribing clinician or pharmacist "
                                "reviews the allergy history."
                            ),
                            medication_names=[medication.name],
                        )
                    )

        all_medications = medications + active_medications
        normalized_names = {
            normalize_medication_name(item.name): item.name for item in all_medications
        }
        has_warfarin = any("warfarin" in name for name in normalized_names)
        for medication in medications:
            name = normalize_medication_name(medication.name)
            if has_warfarin and _contains_any(name, ("ibuprofen", "clarithromycin")):
                alerts.append(
                    SafetyAlert(
                        id=f"interaction-warfarin-{name.replace(' ', '-')}",
                        severity=AlertSeverity.HIGH,
                        title="Potential interaction with warfarin",
                        explanation=(
                            f"{medication.name} may alter bleeding risk or anticoagulant effect when used "
                            "with warfarin."
                        ),
                        evidence_source="Curated MVP interaction rule; expand with licensed clinical terminology",
                        recommended_action=(
                            "Contact the prescribing clinician or pharmacist before combining these medicines."
                        ),
                        medication_names=[
                            medication.name,
                            normalized_names[
                                next(key for key in normalized_names if "warfarin" in key)
                            ],
                        ],
                    )
                )

        return SafetyCheckResponse(
            member_id=member_id,
            alerts=alerts,
            reviewed_medications=medications,
        )
