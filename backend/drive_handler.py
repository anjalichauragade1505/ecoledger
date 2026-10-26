# drive_handler.py
# All Google Drive operations — upload, read, list city folders
#
# Uses a Google SERVICE ACCOUNT instead of the old browser-popup OAuth flow.
# Why: OAuth "installed app" flow (InstalledAppFlow.run_local_server) needs a
# real browser + a human to click "Allow" — that only works on your own laptop.
# A deployed server (Render/Railway/etc.) has no browser, so that flow would
# hang forever in production. A service account authenticates silently with
# a JSON key file — works identically on your laptop and on a live server.
#
# Setup (one-time, see DEPLOY.md for full walkthrough):
#   1. Create a service account in Google Cloud Console, enable Drive API.
#   2. Download its JSON key.
#   3. Share your Drive "EcoLedger" root folder with the service account's
#      email address (looks like xxx@xxx.iam.gserviceaccount.com) as Editor.
#   4. Put the JSON key contents into the GDRIVE_SERVICE_ACCOUNT_JSON env var
#      (as a single-line JSON string) — do NOT commit the key file itself.

import os
import io
import json
import pandas as pd
from functools import lru_cache
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload, MediaIoBaseDownload
from google.oauth2.service_account import Credentials
from dotenv import load_dotenv

load_dotenv()

SCOPES         = ['https://www.googleapis.com/auth/drive']
ROOT_FOLDER_ID = os.getenv('GDRIVE_ROOT_FOLDER_ID', '')

# The service account key can be provided two ways:
#  - GDRIVE_SERVICE_ACCOUNT_JSON : the full JSON key as a string (preferred for
#    hosting platforms like Render/Railway — paste it into their env var UI)
#  - GDRIVE_SERVICE_ACCOUNT_FILE : a path to the JSON key file on disk
#    (handy for local development)
SERVICE_ACCOUNT_JSON = os.getenv('GDRIVE_SERVICE_ACCOUNT_JSON')
SERVICE_ACCOUNT_FILE = os.getenv('GDRIVE_SERVICE_ACCOUNT_FILE', 'service_account.json')


@lru_cache(maxsize=1)
def _get_service():
    """Authenticate via service account (no browser, no login prompt) and
    return a cached Drive API client."""
    if SERVICE_ACCOUNT_JSON:
        info  = json.loads(SERVICE_ACCOUNT_JSON)
        creds = Credentials.from_service_account_info(info, scopes=SCOPES)
    elif os.path.exists(SERVICE_ACCOUNT_FILE):
        creds = Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE, scopes=SCOPES)
    else:
        raise RuntimeError(
            "No Google Drive credentials found. Set GDRIVE_SERVICE_ACCOUNT_JSON "
            "(paste the full JSON key as a string) or GDRIVE_SERVICE_ACCOUNT_FILE "
            "(path to the key file) as an environment variable. See DEPLOY.md."
        )
    return build('drive', 'v3', credentials=creds, cache_discovery=False)


def get_or_create_city_folder(city_name: str) -> str:
    """Return folder ID for city. Creates folder if it doesn't exist."""
    service    = _get_service()
    city_upper = city_name.upper()

    query   = (f"name='{city_upper}' and mimeType='application/vnd.google-apps.folder' "
               f"and '{ROOT_FOLDER_ID}' in parents and trashed=false")
    results = service.files().list(q=query, fields='files(id, name)').execute()
    files   = results.get('files', [])

    if files:
        return files[0]['id']

    meta = {
        'name'    : city_upper,
        'mimeType': 'application/vnd.google-apps.folder',
        'parents' : [ROOT_FOLDER_ID],
    }
    folder = service.files().create(body=meta, fields='id').execute()
    return folder['id']


def upload_csv_to_city_folder(city_name: str, file_bytes: bytes, filename: str) -> str:
    """Upload raw CSV to city's folder in Drive. Returns file ID."""
    service   = _get_service()
    folder_id = get_or_create_city_folder(city_name)

    file_meta = {'name': filename, 'parents': [folder_id]}
    media     = MediaIoBaseUpload(io.BytesIO(file_bytes), mimetype='text/csv')
    uploaded  = service.files().create(
        body=file_meta, media_body=media, fields='id'
    ).execute()
    return uploaded['id']


def save_results_to_city_folder(city_name: str, results: dict) -> str:
    """Save computed EDD results JSON to city's folder."""
    service   = _get_service()
    folder_id = get_or_create_city_folder(city_name)

    content   = json.dumps(results, indent=2).encode('utf-8')
    file_meta = {'name': f'{city_name.upper()}_edd_results.json',
                 'parents': [folder_id]}
    media     = MediaIoBaseUpload(io.BytesIO(content), mimetype='application/json')

    query  = (f"name='{city_name.upper()}_edd_results.json' "
              f"and '{folder_id}' in parents and trashed=false")
    exists = service.files().list(q=query, fields='files(id)').execute().get('files', [])

    if exists:
        service.files().update(fileId=exists[0]['id'], media_body=media).execute()
        return exists[0]['id']
    else:
        uploaded = service.files().create(
            body=file_meta, media_body=media, fields='id'
        ).execute()
        return uploaded['id']


def load_city_results(city_name: str) -> dict | None:
    """Load EDD results JSON for a city from Drive."""
    service   = _get_service()
    folder_id = get_or_create_city_folder(city_name)

    query = (f"name='{city_name.upper()}_edd_results.json' "
             f"and '{folder_id}' in parents and trashed=false")
    files = service.files().list(q=query, fields='files(id)').execute().get('files', [])

    if not files:
        return None

    buffer = io.BytesIO()
    dl     = MediaIoBaseDownload(buffer, service.files().get_media(fileId=files[0]['id']))
    done   = False
    while not done:
        _, done = dl.next_chunk()

    buffer.seek(0)
    return json.loads(buffer.read().decode('utf-8'))


def list_all_cities() -> list[str]:
    """List all city folder names in the root EcoLedger Drive folder."""
    service = _get_service()
    query   = (f"'{ROOT_FOLDER_ID}' in parents "
               f"and mimeType='application/vnd.google-apps.folder' "
               f"and trashed=false")
    results = service.files().list(
        q=query, fields='files(id, name)', orderBy='name'
    ).execute()
    return [f['name'] for f in results.get('files', [])]


def load_csv_from_drive(file_id: str) -> pd.DataFrame:
    """Download a CSV file from Drive by file ID and return as DataFrame."""
    service = _get_service()
    buffer  = io.BytesIO()
    dl      = MediaIoBaseDownload(buffer, service.files().get_media(fileId=file_id))
    done    = False
    while not done:
        _, done = dl.next_chunk()
    buffer.seek(0)
    return pd.read_csv(buffer)
