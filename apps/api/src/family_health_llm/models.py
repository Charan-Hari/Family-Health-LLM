"""Typed API contracts for the Family Health LLM MVP."""

from datetime import UTC, date, datetime
from enum import StrEnum
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class AlertSeverity(StrEnum):
    """Severity levels ranked from informational to urgent."""

    CRITICAL = "critical"
    HIGH = "high"
    MODERATE = "moderate"
    INFORMATIONAL = "informational"


class MedicationInput(BaseModel):
    """A medication candidate supplied by extraction or a user."""

    name: str = Field(min_length=1, max_length=160)
    dose: str | None = Field(default=None, max_length=80)
    frequency: str | None = Field(default=None, max_length=80)
    last_taken_at: datetime | None = None


class AllergyInput(BaseModel):
    """A documented or reported medication allergy."""

    substance: str = Field(min_length=1, max_length=160)
    reaction: str = Field(min_length=1, max_length=300)
    documented_on: date | None = None


class FamilyMemberCreate(BaseModel):
    """A minimum-data family member profile."""

    display_name: str = Field(min_length=1, max_length=80)
    birth_date: date | None = None
    relationship: str = Field(min_length=1, max_length=50)


class FamilyMember(BaseModel):
    """A persisted family member profile."""

    id: UUID
    display_name: str
    birth_date: date | None
    relationship: str
    created_at: datetime


class SafetyAlert(BaseModel):
    """An explainable non-diagnostic medication-safety signal."""

    id: str
    severity: AlertSeverity
    title: str
    explanation: str
    evidence_source: str
    recommended_action: str
    medication_names: list[str]


class SafetyCheckRequest(BaseModel):
    """Medication list to compare with a member's documented history."""

    member_id: UUID
    medications: list[MedicationInput] = Field(min_length=1, max_length=20)
    active_medications: list[MedicationInput] = Field(default_factory=list, max_length=50)


class SafetyCheckResponse(BaseModel):
    """Safety result with always-present clinical confirmation guidance."""

    member_id: UUID
    alerts: list[SafetyAlert]
    reviewed_medications: list[MedicationInput]
    requires_clinical_confirmation: bool = True
    disclaimer: str = (
        "This is an advisory screening result, not medical advice. Confirm every alert and "
        "medication decision with a qualified clinician or pharmacist before use."
    )


class PrescriptionExtraction(BaseModel):
    """Structured extraction candidate retained for human review."""

    id: UUID = Field(default_factory=uuid4)
    member_id: UUID
    source_filename: str
    extracted_medications: list[MedicationInput]
    review_required: bool = True
    extraction_notes: list[str]
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class PrescriptionAnalysisResponse(BaseModel):
    """Combined extraction and safety check for the upload workflow."""

    extraction: PrescriptionExtraction
    safety: SafetyCheckResponse


class AssistantChatRequest(BaseModel):
    """A bounded plain-language request for an advisory health-record explanation."""

    member_id: UUID
    question: str = Field(min_length=1, max_length=600)
