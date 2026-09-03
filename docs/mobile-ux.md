# Mobile UX: snap to safety

## Flow

1. **Home** — user selects the intended family member or creates a minimal private label.
2. **Capture** — user photographs or selects the prescription. Permission language explains the purpose.
3. **Review** — the original image remains visible and the caregiver confirms the medication name. This prevents the app from hiding OCR uncertainty.
4. **Safety result** — a clearly differentiated result says either `PAUSE AND VERIFY` or `NO CURATED ALERT FOUND`, never "safe". A positive result provides the reason and next action.
5. **Next task** — user checks another prescription without losing the selected profile.

## Visual and accessibility rules

- Use a single high-contrast primary action per state.
- Keep touch targets at least 44 points high.
- Use text labels instead of color alone for severity.
- Prefer short plain-language explanations; avoid medical jargon when it does not improve accuracy.
- Do not use an alert tone, confetti, or success language for negative screens.
- Keep emergency and clinical instructions direct: tell the user to contact a clinician or pharmacist.

## Privacy UX

The UI requests photo permission at the point of use, identifies why it is needed, does not show actual patient names in demo media, and tells users that a production account/consent model is required before real data storage.
