# Mobile release path

## Before building

1. Create an Expo account and configure the project with `npx eas-cli@latest init`. This generates the Expo project association; do not commit account access tokens.
2. Verify `ios.bundleIdentifier` and `android.package` in [`app.json`](../apps/mobile/app.json) are available for your organization. Change them before any store release if needed.
3. Deploy the API to a public HTTPS origin and set `EXPO_PUBLIC_API_URL` for the build. This is public configuration, never an LLM credential.
4. Configure full authentication, household authorization, encryption, consent, audit, deletion/export, abuse controls, clinical validation, and compliance review before accepting real health data. The current unauthenticated local-storage MVP is suitable only for development and synthetic demos.

## Local preview APK

```powershell
cd C:\path\to\Family-Health-LLM\apps\mobile
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile preview
```

The `preview` profile produces an installable Android APK for internal testing. EAS account use may have plan limits; review current Expo terms. iOS device builds and public App Store distribution require Apple Developer Program credentials. Google Play production distribution requires a Google Play Developer account. These third-party fees are outside this repository.

## GitHub Actions build

The manual [`Build mobile preview`](../.github/workflows/build-mobile.yml) workflow requires:

- GitHub Actions secret `EXPO_TOKEN` (create it in Expo; never place it in code or a variable).
- GitHub Actions variable `PUBLIC_API_URL`, set to the HTTPS API origin.

It runs a managed EAS Android preview build. The generated download/install link appears in EAS build output, not in the repository.

## GitHub publishing

Push the repository using your authenticated GitHub tooling after review:

```powershell
cd C:\path\to\Family-Health-LLM
git add .
git commit -m "feat: add real-time local AI assistant"
git remote add origin https://github.com/Charan-Hari/Family-Health-LLM.git
git push -u origin main
```

Do not put a token in the remote URL. Use GitHub CLI authentication, Git Credential Manager, or SSH configured on your machine. Then set repository Actions secrets/variables through GitHub’s UI.
