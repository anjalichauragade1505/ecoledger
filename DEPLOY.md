# EcoLedger — Deploy Guide (Backend + Frontend + Google Drive)

This turns your project live for free using:
- **Render** → hosts your FastAPI backend
- **Vercel** → hosts your React frontend
- **Google Service Account** → lets your live backend read/write Google Drive
  with no browser login (the old method used a browser popup, which cannot
  work on a real server — this has been fixed for you already in
  `backend/drive_handler.py`)

Total time: ~20–25 minutes. Follow the steps in order.

---

## ⚠️ First: rotate your old Google credentials

Your uploaded project contained `oauth_credentials.json` with a real Google
OAuth client secret inside it. That file has been **removed** from this
deployable copy, and the new setup below doesn't need it at all — but since
that secret was in a file you shared, it's good practice to delete/regenerate
that OAuth client in Google Cloud Console (APIs & Services → Credentials) so
the old one can't be used by anyone else. This doesn't block deployment —
just do it whenever convenient.

---

## STEP 1 — Create a Google Service Account (10 min)

This replaces the old "sign in with your Gmail" popup with a robot account
that can access Drive silently, 24/7, from any server.

1. Go to https://console.cloud.google.com/
2. Create a new project (or use your existing `ecoledger-496213` project).
3. In the search bar, type **"Google Drive API"** → open it → click **Enable**.
4. Go to **APIs & Services → Credentials** → **Create Credentials** →
   **Service account**.
5. Give it any name, e.g. `ecoledger-drive-bot` → **Create and Continue** →
   skip the optional role/access steps → **Done**.
6. Click on the service account you just created → go to the **Keys** tab →
   **Add Key → Create new key → JSON** → it downloads a `.json` file.
   **Keep this file safe — treat it like a password.**
7. Open that JSON file in a text editor, note the `client_email` field — it
   looks like `ecoledger-drive-bot@ecoledger-496213.iam.gserviceaccount.com`.

## STEP 2 — Share your Drive folder with the robot account (2 min)

1. In Google Drive, open (or create) the folder where EcoLedger stores city
   data — you already have one, its ID is in your old `.env` as
   `GDRIVE_ROOT_FOLDER_ID`.
2. Right-click the folder → **Share** → paste the `client_email` from Step 1
   → give it **Editor** access → Send.

That's it — the robot account can now create city subfolders and read/write
files in that folder, from anywhere, with no login screen.

## STEP 3 — Deploy the backend on Render (5 min)

1. Push this `backend/` folder to a GitHub repo (or upload the whole project
   — Render can deploy from a repo, or you can use their manual "Deploy from
   a folder" option if offered).
2. Go to https://render.com → New → **Web Service** → connect your repo,
   with **Root Directory** set to `backend`.
3. Render will detect `render.yaml` automatically. If not, set manually:
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Under **Environment**, add these variables:

   | Key | Value |
   |---|---|
   | `ADMIN_EMAIL` | your admin login email |
   | `ADMIN_PASSWORD` | a strong password you choose |
   | `JWT_SECRET` | any long random string |
   | `GDRIVE_ROOT_FOLDER_ID` | the Drive folder ID from Step 2 |
   | `GDRIVE_SERVICE_ACCOUNT_JSON` | open the JSON key file from Step 1, copy its **entire contents**, paste as one value here |
   | `CORS_ORIGINS` | `*` for now (tighten later, see Step 5) |

5. Click **Create Web Service**. Wait for the build to finish. You'll get a
   URL like `https://ecoledger-backend.onrender.com`.
6. Visit `https://ecoledger-backend.onrender.com/public/cities` in your
   browser — you should see `{"cities": []}`. That confirms the backend is
   live and can talk to Drive.

   > Free Render web services sleep after 15 min of no traffic and take
   > ~30–50 seconds to wake up on the next request. That's normal on the
   > free tier — upgrading to a paid instance removes the sleep delay.

## STEP 4 — Deploy the frontend on Vercel (5 min)

1. Push `frontend/` to GitHub (or the same repo, different root directory).
2. Go to https://vercel.com → **Add New → Project** → import the repo, set
   **Root Directory** to `frontend`.
3. Framework preset: **Create React App** (Vercel usually auto-detects it).
4. Under **Environment Variables**, add:

   | Key | Value |
   |---|---|
   | `REACT_APP_API_URL` | your Render backend URL from Step 3, e.g. `https://ecoledger-backend.onrender.com` |

5. Click **Deploy**. You'll get a URL like `https://ecoledger.vercel.app`.

## STEP 5 — Lock CORS down (1 min, optional but recommended)

Right now the backend accepts requests from any website (`CORS_ORIGINS=*`).
Once you know your Vercel URL, go back to Render → your service →
Environment → set:

```
CORS_ORIGINS=https://ecoledger.vercel.app
```

Save — Render redeploys automatically. Now only your frontend can call your
API.

## STEP 6 — Test it end to end

1. Open your Vercel URL.
2. Go to the admin login page, sign in with the `ADMIN_EMAIL` /
   `ADMIN_PASSWORD` you set in Step 3.
3. Upload a sample city CSV.
4. Check the Drive folder from Step 2 — you should see a new city subfolder
   with the CSV and a `_edd_results.json` file appear.
5. Check the public leaderboard / landing page — the new city should show up.

If any step fails, the error message from the backend (visible in the
Render logs, or in the browser's network tab) will tell you exactly which
of the 6 environment variables is missing or wrong — that covers 90% of
first-deploy issues.

---

## Local development (optional)

Backend:
```
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
copy .env.example .env       # then fill in the values
# Option A: put your service account JSON path in GDRIVE_SERVICE_ACCOUNT_FILE
# Option B: paste the whole JSON into GDRIVE_SERVICE_ACCOUNT_JSON
uvicorn main:app --reload
```

Frontend:
```
cd frontend
npm install
copy .env.example .env       # REACT_APP_API_URL=http://localhost:8000
npm start
```

---

## What changed from your original project

- `backend/drive_handler.py` — rewritten to use a Google **service account**
  instead of the browser-popup OAuth flow, so it works on a real server.
- `backend/main.py` — CORS origins now come from a `CORS_ORIGINS` env
  variable instead of being hardcoded to `*`.
- Added `backend/render.yaml`, `backend/Procfile`, `backend/.env.example`.
- Added `frontend/vercel.json`, `frontend/.env.example`.
- Removed `oauth_credentials.json` and `token.json` — no longer used, and
  the old file contained a real secret that shouldn't be committed anywhere.
