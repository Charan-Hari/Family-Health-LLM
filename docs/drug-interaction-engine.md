# Drug interaction and allergy engine

## Safety principle

The engine is a conservative **screening** service. A positive signal is a reason to pause and consult a pharmacist or clinician; a negative result never establishes that a combination is safe.

## Current implementation

The API accepts a member, proposed medications, and optionally active medications. It retrieves documented allergies and evaluates a small explicit ruleset:

| Trigger | Severity | Action |
|---|---|---|
| Sulfa or sulfonamide allergy with sulfamethoxazole/trimethoprim candidate | Critical | Do not start until a clinician or pharmacist reviews the allergy |
| Documented direct allergy label matching a medication candidate | Critical | Do not start until professional review |
| Ibuprofen or clarithromycin candidate with warfarin active/candidate medication | High | Contact prescriber or pharmacist before combining |

Each alert includes an ID, severity, evidence source, matched medication names, explanation, and recommended action. Rules are deliberately limited to prevent a misleading appearance of comprehensive clinical coverage.

## API contract

`POST /v1/safety/check`

```json
{
  "member_id": "00000000-0000-0000-0000-000000000000",
  "medications": [{"name": "Sulfamethoxazole / trimethoprim", "dose": "800 mg"}],
  "active_medications": [{"name": "Warfarin"}]
}
```

Every response has `requires_clinical_confirmation: true` and a disclaimer. The OpenAPI schema is available from `/docs` while the API is running.

## Production evolution

1. Ingest a licensed, versioned drug vocabulary and interaction knowledge base with India-relevant product mappings.
2. Normalize product, ingredient, salt, and dose-form identifiers to an authoritative identifier; retain source and confidence.
3. Model interactions as deterministic, versioned rules with contraindication, severity, evidence, population, and action metadata.
4. Add patient-specific checks only after clinical governance: age, renal/hepatic status, pregnancy, timing, dose, and duplicate therapy.
5. Require independent clinical review, validation datasets, drift monitoring, alert-rate monitoring, and incident response.
6. Use a safety review queue for uncertain OCR/normalization and never let an LLM be the final safety authority.

DrugBank, RxNorm, SNOMED CT, and CDSCO data each have separate access, licensing, jurisdiction, and update obligations. Confirm them before integration.
