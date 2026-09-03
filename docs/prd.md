# Family Health LLM product requirements

## Purpose

Family Health LLM helps a household collect health records, reconstruct a member's medication and allergy context, and flag **possible** medication-safety conflicts for clinician review. It is advisory software only and must not diagnose, prescribe, triage emergencies, or replace a licensed professional.

## Primary users

1. An adult coordinating records for parents and children.
2. A remote caregiver who needs an accurate, consented history.
3. A chronic-care patient maintaining a longitudinal personal record.

## MVP outcome

In under two minutes, a caregiver can create a minimal family profile, capture a prescription image, confirm extracted medication details, and see an explainable allergy or curated interaction alert. The result names the evidence, action, uncertainty, and clinical-confirmation requirement.

## Functional requirements

| ID | Requirement | MVP status |
|---|---|---|
| FR-01 | Create and list minimal family-member profiles. | Implemented |
| FR-02 | Record member allergy entries with a reaction. | Implemented API |
| FR-03 | Accept JPEG, PNG, PDF, and text prescription uploads up to 10 MB. | Implemented API |
| FR-04 | Produce a structured medication candidate list and preserve the review requirement. | Implemented with deterministic demo extraction |
| FR-05 | Screen candidates against documented allergies and curated interactions. | Implemented |
| FR-06 | Show a mobile capture, review, and result experience. | Implemented |
| FR-07 | Maintain an auditable record-access/change trail. | Local hash-chain proof of concept |
| FR-08 | Generate a clinician visit brief and FHIR R4 export. | Planned |
| FR-09 | Support consented shared caregiver access, voice, reminders, and emergency mode. | Planned |

## Non-functional requirements

- Never commit secrets, protected health information (PHI), sample patient records, or personal contact details.
- Require authentication and household-level authorization before storing real user records.
- Encrypt production PHI in transit and at rest using managed keys; do not treat the local SQLite database as encrypted production storage.
- Provide immutable, access-controlled audit events in production and monitor access anomalies.
- Enforce consent, revocation, export, and deletion workflows before public launch.
- Keep all clinical logic versioned, source-attributed, testable, reviewable, and bounded by licensed data rights.
- Meet accessibility goals: large targets, high contrast, readable language, and a no-typing-first capture path.

## Success measures

- At least 90% completion of the capture-to-review workflow in usability testing.
- Every displayed alert includes an evidence source, action, and clinician-confirmation statement.
- Zero PHI in source control, CI logs, screenshots, or demo video.
- Clinical validation establishes sensitivity, specificity, and false-alert burden before any health claim.

## Explicit exclusions

The MVP does not claim handwriting OCR accuracy, comprehensive drug interaction coverage, dose calculation, emergency response, diagnosis, treatment recommendations, ABHA integration, or regulatory certification.
