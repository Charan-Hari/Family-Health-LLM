# Safe demo media capture

Use only synthetic names and synthetic prescriptions. Never record a real medical document, real patient identifier, local API response containing real health data, terminal environment, `.env`, QR code, or browser address bar.

## Automated capture

With the Expo web preview running, run `npm run capture:demo` from `apps/mobile`. It produces four PNG screenshots, a WebM video, and GIF in [`screenshots/`](../screenshots) using only the bundled synthetic icon, `Demo Parent`, and `sulfa`. Its API calls are intercepted with synthetic responses, so it does not create, read, or modify records in the local API. The script uses a locally installed Chrome browser and free tooling.

## Screenshots

1. Run the API and Expo web app locally.
2. Create a synthetic family profile such as `Demo Parent`.
3. Use a synthetic prescription image and manually enter `Bactrim`.
4. Capture the home, review, and `PAUSE AND VERIFY` result states at a 390 px mobile viewport.
5. Store approved assets under [`screenshots/`](../screenshots) and review metadata before publishing.

## GIF/video storyboard

Record a 12–15 second silent loop:

1. Select `Demo Parent` (0–2s).
2. Tap `Use camera` or `Choose from photos` (2–5s).
3. Enter `Bactrim` in the review field (5–8s).
4. Tap `Check safety` and hold the advisory result (8–15s).

Add an on-screen caption: `Demo data only — confirm medication decisions with a clinician or pharmacist.` Export a compressed GIF for README use and an MP4/WebM for social media; inspect all frames before publication.
