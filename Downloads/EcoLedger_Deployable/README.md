# EcoLedger — Deployable Edition

This version keeps the original EcoLedger calculation engine and React UI, but removes the Google Drive/OAuth dependency so the whole project can be deployed as one container.

## What changed

- Removed Google Drive and OAuth credentials.
- Removed bundled Python `venv` and React `node_modules`.
- Added local server-side persistence under `backend/data`.
- Added `/health` endpoint.
- Added a production Dockerfile that builds React and serves it through FastAPI.
- Added `docker-compose.yml` for one-command local deployment.
- Frontend API calls use the same origin in production, so there is no localhost URL to change after deployment.
- Admin CSV upload, dashboard, simulator, PDF export, citizen tool and city comparison APIs remain available.

## Run locally with Docker

1. Copy `.env.example` to `.env` and set a strong `ADMIN_PASSWORD` and `JWT_SECRET`.
2. Run:

```bash
docker compose up --build
```

3. Open `http://localhost:8000`.

Admin login uses the `ADMIN_EMAIL` and `ADMIN_PASSWORD` values from the environment.

## Deploy to Render

1. Create a new Web Service from this repository.
2. Choose Docker.
3. Add environment variables:
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
   - `JWT_SECRET`
   - `ECOLEDGER_DATA_DIR=/app/backend/data`
4. Deploy.

`render.yaml` is included as a starting point.

## Important persistence note

The simplified version stores city results and uploaded CSVs on the server filesystem. This is ideal for a simple demo/single-server deployment. If you later need permanent storage across container replacement/redeployments, replace `storage.py` with PostgreSQL/S3/Supabase storage.

## CSV format

The upload pipeline accepts a `City` column (or a filename as the city name for single-city files), plus a date/timestamp/year column and pollutant columns such as:

`PM2.5, PM10, NO2, SO2, CO, O3`

The existing EcoLedger formulas and dashboard logic are retained.

## Security

Do not commit real production passwords or secrets. Set them in the hosting provider's environment-variable panel.
