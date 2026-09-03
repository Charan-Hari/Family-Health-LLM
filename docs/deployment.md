# Deployment and operations

## Local development

1. Copy `.env.example` to `.env` only if you want optional local infrastructure. Replace all example values locally; never commit the file.
2. Start the API with the commands in the root README.
3. Optionally start PostgreSQL, Neo4j, and Qdrant with `docker compose up -d`. Docker is not required for the SQLite-backed MVP API.
4. Start Expo and set `EXPO_PUBLIC_API_URL` to the API URL. A physical device cannot resolve the computer's `localhost`; use a LAN-reachable HTTPS endpoint.

## GitHub deployment route

The included CI workflow tests the API and type-checks the mobile app. To publish the web client:

1. Create a GitHub repository from this folder and push only reviewed source files.
2. Configure a protected deployment environment and GitHub Pages.
3. Set the repository Actions variable `PUBLIC_API_URL` to the public HTTPS API origin. Run the `Deploy web client` workflow to publish the Expo web export to GitHub Pages. This value is public configuration, not a secret.
4. Deploy the API container to a managed runtime in the required data-residency region. Supply its database URL, authentication configuration, key references, and allowed origins through the runtime's secret manager.
5. Set the API's `CORS_ALLOWED_ORIGINS` to the exact web origin. Do not use a wildcard with credentials.

## Public-launch blockers

Do not deploy real PHI until authentication, authorization, authenticated audit trails, encryption/key management, backups, consent/deletion/export, incident response, DPIA/legal review, vulnerability management, and clinical validation have been completed and independently reviewed.

## Rollback

Keep immutable container image tags and database migrations. On an incident, disable write endpoints at the gateway, roll back to the previous verified image, rotate exposed credentials in the secret manager, preserve audit evidence, and notify affected parties according to the incident plan.
