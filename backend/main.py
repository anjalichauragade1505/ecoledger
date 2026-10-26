# main.py — EcoLedger FastAPI Backend
# No Streamlit. Pure FastAPI. All calculations live.

import os
import io
import jwt
import time
import pandas as pd
from datetime import datetime, timedelta
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from dotenv import load_dotenv
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from fastapi.responses import StreamingResponse

from formulas import (
    check_citizen_input, run_crf_simulator,
    project_with_measures, classify_ehs, SAFE_LIMITS, CRF_NAMES
)
from pipeline import run_full_pipeline, process_multi_city_file
from drive_handler import (
    upload_csv_to_city_folder, save_results_to_city_folder,
    load_city_results, list_all_cities, get_or_create_city_folder
)

load_dotenv()

app = FastAPI(title="EcoLedger API", version="1.0.0")

CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")
allow_origins = ["*"] if CORS_ORIGINS.strip() == "*" else [
    o.strip() for o in CORS_ORIGINS.split(",") if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

ADMIN_EMAIL    = os.getenv("ADMIN_EMAIL", "admin@ecoledger.com")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "EcoLedger@2024")
JWT_SECRET     = os.getenv("JWT_SECRET", "ecoledger_secret")
security       = HTTPBearer()


# ── Auth Helpers ──────────────────────────────────────────────────────────────
def create_token(email: str) -> str:
    payload = {"sub": email, "exp": datetime.utcnow() + timedelta(hours=12)}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


# ══════════════════════════════════════════════════════════════════════════════
# AUTH ROUTES
# ══════════════════════════════════════════════════════════════════════════════

class LoginInput(BaseModel):
    email: str
    password: str

@app.post("/auth/login")
def login(data: LoginInput):
    if data.email == ADMIN_EMAIL and data.password == ADMIN_PASSWORD:
        return {"token": create_token(data.email), "role": "admin"}
    raise HTTPException(status_code=401, detail="Invalid credentials")


# ══════════════════════════════════════════════════════════════════════════════
# LANDING PAGE
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/landing/summary")
def landing_summary():
    """
    Powers the landing page counter and map.
    Loads all city results from Drive, sums total EDD.
    """
    cities = list_all_cities()
    total_edd   = 0.0
    city_points = []

    # City coordinates (hardcoded — expand as cities added)
    # Includes both bare names and "COMBINED" / common suffix variants
    CITY_COORDS = {
        # Delhi
        'DELHI'                 : {'lat': 28.6139, 'lng': 77.2090},
        'DELHI COMBINED'        : {'lat': 28.6139, 'lng': 77.2090},
        'NEW DELHI'             : {'lat': 28.6139, 'lng': 77.2090},
        # Mumbai
        'MUMBAI'                : {'lat': 19.0760, 'lng': 72.8777},
        'MUMBAI COMBINED'       : {'lat': 19.0760, 'lng': 72.8777},
        # Chennai
        'CHENNAI'               : {'lat': 13.0827, 'lng': 80.2707},
        'CHENNAI COMBINED'      : {'lat': 13.0827, 'lng': 80.2707},
        # Hyderabad
        'HYDERABAD'             : {'lat': 17.3850, 'lng': 78.4867},
        'HYDERABAD COMBINED'    : {'lat': 17.3850, 'lng': 78.4867},
        # Bengaluru / Bangalore
        'BENGALURU'             : {'lat': 12.9716, 'lng': 77.5946},
        'BANGALORE'             : {'lat': 12.9716, 'lng': 77.5946},
        'BENGALURU COMBINED'    : {'lat': 12.9716, 'lng': 77.5946},
        'BANGALORE COMBINED'    : {'lat': 12.9716, 'lng': 77.5946},
        # Kolkata
        'KOLKATA'               : {'lat': 22.5726, 'lng': 88.3639},
        'KOLKATA COMBINED'      : {'lat': 22.5726, 'lng': 88.3639},
        # Pune
        'PUNE'                  : {'lat': 18.5204, 'lng': 73.8567},
        'PUNE COMBINED'         : {'lat': 18.5204, 'lng': 73.8567},
        # Ahmedabad
        'AHMEDABAD'             : {'lat': 23.0225, 'lng': 72.5714},
        'AHMEDABAD COMBINED'    : {'lat': 23.0225, 'lng': 72.5714},
        # Jaipur
        'JAIPUR'                : {'lat': 26.9124, 'lng': 75.7873},
        'JAIPUR COMBINED'       : {'lat': 26.9124, 'lng': 75.7873},
        # Visakhapatnam
        'VISAKHAPATNAM'         : {'lat': 17.6868, 'lng': 83.2185},
        'VISAKHAPATNAM COMBINED': {'lat': 17.6868, 'lng': 83.2185},
        'VISHAKHAPATNAM'        : {'lat': 17.6868, 'lng': 83.2185},
        # Aizawl
        'AIZAWL'                : {'lat': 23.7307, 'lng': 92.7173},
        'AIZAWL COMBINED'       : {'lat': 23.7307, 'lng': 92.7173},
        # Shillong
        'SHILLONG'              : {'lat': 25.5788, 'lng': 91.8933},
        'SHILLONG COMBINED'     : {'lat': 25.5788, 'lng': 91.8933},
        # Ooty
        'OOTY'                  : {'lat': 11.4102, 'lng': 76.6950},
        'OOTY COMBINED'         : {'lat': 11.4102, 'lng': 76.6950},
        # Lucknow
        'LUCKNOW'               : {'lat': 26.8467, 'lng': 80.9462},
        'LUCKNOW COMBINED'      : {'lat': 26.8467, 'lng': 80.9462},
        # Patna
        'PATNA'                 : {'lat': 25.5941, 'lng': 85.1376},
        'PATNA COMBINED'        : {'lat': 25.5941, 'lng': 85.1376},
        # Nagpur
        'NAGPUR'                : {'lat': 21.1458, 'lng': 79.0882},
        'NAGPUR COMBINED'       : {'lat': 21.1458, 'lng': 79.0882},
        # Surat
        'SURAT'                 : {'lat': 21.1702, 'lng': 72.8311},
        'SURAT COMBINED'        : {'lat': 21.1702, 'lng': 72.8311},
        # Bhopal
        'BHOPAL'                : {'lat': 23.2599, 'lng': 77.4126},
        'BHOPAL COMBINED'       : {'lat': 23.2599, 'lng': 77.4126},
        # Chandigarh
        'CHANDIGARH'            : {'lat': 30.7333, 'lng': 76.7794},
        'CHANDIGARH COMBINED'   : {'lat': 30.7333, 'lng': 76.7794},
    }

    def _lookup_coords(city_name: str) -> dict:
        """Try exact match, then first-word match, then fallback to India centre."""
        name = city_name.upper().strip()
        if name in CITY_COORDS:
            return CITY_COORDS[name]
        # Try matching on first word only (e.g. "DELHI NORTH" → "DELHI")
        first_word = name.split()[0]
        if first_word in CITY_COORDS:
            return CITY_COORDS[first_word]
        return {'lat': 20.5937, 'lng': 78.9629}   # centre of India fallback

    for city in cities:
        result = load_city_results(city)
        if result:
            total_edd += result.get('net_edd', 0)
            coords     = _lookup_coords(city)
            tier_info  = classify_ehs(result.get('ehs', 0))
            city_points.append({
                'city'      : city,
                'ehs'       : result.get('ehs', 0),
                'net_edd'   : result.get('net_edd', 0),
                'tier'      : tier_info['tier'],
                'tier_color': tier_info['color'],
                'lat'       : coords['lat'],
                'lng'       : coords['lng'],
            })

    return {
        'total_edd'   : round(total_edd, 2),
        'city_count'  : len(cities),
        'city_points' : city_points,
    }


# ══════════════════════════════════════════════════════════════════════════════
# ADMIN ROUTES (protected)
# ══════════════════════════════════════════════════════════════════════════════

def _compute_global_max_edd(df_new: pd.DataFrame, new_city_names: list) -> float:
    """
    Compute global_max_edd across ALL cities — existing ones on Drive
    plus the newly uploaded ones — so every city is scored on the same scale.
    """
    from pipeline import clean_dataframe, compute_di, estimate_crf_components, compute_crf, compute_edd
    net_edds = []

    # 1. Collect net_edd from already-saved cities (skip cities being re-uploaded)
    existing_cities = list_all_cities()
    for city in existing_cities:
        if city.upper() in [c.upper() for c in new_city_names]:
            continue  # will be recalculated below
        r = load_city_results(city)
        if r and r.get('net_edd', 0) > 0:
            net_edds.append(r['net_edd'])

    # 2. Compute net_edd for each new city from the uploaded CSV
    try:
        df_clean = clean_dataframe(df_new.copy())
        for city in new_city_names:
            city_upper = city.upper()
            if 'City' in df_clean.columns:
                city_df = df_clean[df_clean['City'] == city_upper].copy()
            else:
                city_df = df_clean.copy()
            if city_df.empty:
                continue
            city_df   = compute_di(city_df)
            crf_comp  = estimate_crf_components(city_df)
            crf       = compute_crf(crf_comp)
            y_df      = compute_edd(city_df, crf)
            net_edds.append(float(y_df['EDD_net_cumulative'].iloc[-1]))
    except Exception:
        pass  # fallback: use whatever we have

    return max(net_edds) if net_edds else 1.0


@app.post("/admin/upload-city", dependencies=[Depends(verify_token)])
async def upload_city(file: UploadFile = File(...)):
    try:
        raw_bytes = await file.read()
        df_raw    = pd.read_csv(io.BytesIO(raw_bytes))
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not parse CSV: {str(e)}")

    try:
        has_city_col = 'City' in df_raw.columns or 'city' in df_raw.columns
        if has_city_col:
            df_raw.columns = [c.strip() for c in df_raw.columns]
            if 'city' in df_raw.columns:
                df_raw.rename(columns={'city': 'City'}, inplace=True)
            cities_in_file = list(df_raw['City'].str.upper().unique())
        else:
            city_name = file.filename.replace('.csv','').replace('_',' ').upper()
            cities_in_file = [city_name]

        # Compute shared global_max_edd BEFORE running any pipeline
        global_max_edd = _compute_global_max_edd(df_raw, cities_in_file)

        saved = []
        if len(cities_in_file) > 1:
            # Pass global_max_edd into multi-city processor
            all_results = process_multi_city_file(df_raw, global_max_edd=global_max_edd)
            for city, result in all_results.items():
                upload_csv_to_city_folder(city, raw_bytes, file.filename)
                save_results_to_city_folder(city, result)
                saved.append(city)
        else:
            city   = cities_in_file[0]
            result = run_full_pipeline(df_raw, city, global_max_edd=global_max_edd)
            upload_csv_to_city_folder(city, raw_bytes, file.filename)
            save_results_to_city_folder(city, result)
            saved.append(city)

        # Re-score ALL existing cities with the updated global_max_edd so their
        # EHS values stay comparable after every new upload
        _rescore_existing_cities(saved, global_max_edd)

        return {"status": "success", "cities_processed": saved}

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline error: {str(e)}")


def _rescore_existing_cities(just_uploaded: list, global_max_edd: float):
    """
    After a new upload changes global_max_edd, re-derive EHS + tier
    for every previously saved city so the whole scoreboard stays consistent.
    """
    from formulas import compute_ehs, compute_tpayoff, classify_ehs
    existing_cities = list_all_cities()
    for city in existing_cities:
        if city.upper() in [c.upper() for c in just_uploaded]:
            continue  # just processed — already correct
        r = load_city_results(city)
        if not r:
            continue
        new_ehs      = compute_ehs(r['net_edd'], global_max_edd)
        tier_info    = classify_ehs(new_ehs)
        new_t_payoff = compute_tpayoff(r['net_edd'], r['crf_score'], r['avg_edd_yearly'])
        r.update({
            'ehs'              : new_ehs,
            'tier'             : tier_info['tier'],
            'tier_color'       : tier_info['color'],
            'tier_emoji'       : tier_info['emoji'],
            't_payoff_years'   : new_t_payoff,
            'global_max_edd_ref': round(global_max_edd, 4),
        })
        save_results_to_city_folder(city, r)

@app.get("/admin/dashboard", dependencies=[Depends(verify_token)])
def admin_dashboard():
    """All city data for admin scoreboard."""
    cities  = list_all_cities()
    results = []
    for city in cities:
        r = load_city_results(city)
        if r:
            results.append({
                'city'        : r['city'],
                'ehs'         : r['ehs'],
                'net_edd'     : r['net_edd'],
                'tier'        : r['tier'],
                'tier_color'  : r['tier_color'],
                'tier_emoji'  : r['tier_emoji'],
                't_payoff'    : r['t_payoff_years'],
                'crf_score'   : r['crf_score'],
                'trend'       : r['trend'],
                'data_points' : r['data_points'],
                'years'       : r['years_covered'],
            })
    results.sort(key=lambda x: x['ehs'], reverse=True)
    return {'cities': results, 'count': len(results)}


@app.get("/admin/city/{city_name}", dependencies=[Depends(verify_token)])
def admin_city_detail(city_name: str):
    """Full city data for admin — all fields."""
    result = load_city_results(city_name.upper())
    if not result:
        raise HTTPException(status_code=404, detail=f"No data for {city_name}")
    return result


@app.post("/admin/export-pdf/{city_name}", dependencies=[Depends(verify_token)])
def export_city_pdf(city_name: str):
    """Generate and return a PDF report for a city."""
    result = load_city_results(city_name.upper())
    if not result:
        raise HTTPException(status_code=404, detail="City not found")

    buffer = io.BytesIO()
    doc    = SimpleDocTemplate(buffer, pagesize=A4)
    styles = getSampleStyleSheet()
    story  = []

    story.append(Paragraph(f"EcoLedger — {result['city']} Report", styles['Title']))
    story.append(Spacer(1, 12))
    story.append(Paragraph(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}", styles['Normal']))
    story.append(Spacer(1, 20))

    summary_data = [
        ['Metric',             'Value'],
        ['EHS Score',          str(result['ehs'])],
        ['Tier',               result['tier']],
        ['Net EDD',            str(result['net_edd'])],
        ['CRF Score',          str(result['crf_score'])],
        ['Recovery (years)',   str(result['t_payoff_years'])],
        ['Data Points',        str(result['data_points'])],
    ]
    t = Table(summary_data, colWidths=[200, 200])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#2ECC71')),
        ('TEXTCOLOR',  (0,0), (-1,0), colors.white),
        ('GRID',       (0,0), (-1,-1), 0.5, colors.grey),
        ('FONTNAME',   (0,0), (-1,0), 'Helvetica-Bold'),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#F0FFF4')]),
    ]))
    story.append(t)
    story.append(Spacer(1, 20))

    story.append(Paragraph("CRF Components", styles['Heading2']))
    crf_data = [['Component', 'Score']] + [
        [CRF_NAMES[k], str(round(v, 4))]
        for k, v in result['crf_components'].items()
    ]
    t2 = Table(crf_data, colWidths=[200, 200])
    t2.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#00C9A7')),
        ('TEXTCOLOR',  (0,0), (-1,0), colors.white),
        ('GRID',       (0,0), (-1,-1), 0.5, colors.grey),
    ]))
    story.append(t2)

    doc.build(story)
    buffer.seek(0)
    return StreamingResponse(buffer, media_type='application/pdf',
        headers={'Content-Disposition': f'attachment; filename="{city_name}_report.pdf"'})


# ══════════════════════════════════════════════════════════════════════════════
# PUBLIC ROUTES — City Battle Arena + Citizen
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/public/leaderboard")
def leaderboard():
    """Public leaderboard — EHS ranked, tier badges."""
    cities  = list_all_cities()
    results = []
    for city in cities:
        r = load_city_results(city)
        if r:
            results.append({
                'city'      : r['city'],
                'ehs'       : r['ehs'],
                'net_edd'   : r['net_edd'],
                'tier'      : r['tier'],
                'tier_color': r['tier_color'],
                'tier_emoji': r['tier_emoji'],
                't_payoff'  : r['t_payoff_years'],
                'trend'     : r['trend'],
                'crf_score' : r['crf_score'],
            })
    results.sort(key=lambda x: x['ehs'], reverse=True)
    return {'leaderboard': results}


@app.get("/public/city/{city_name}")
def public_city(city_name: str):
    """Public city data — EDD history, forecasts, seasonal."""
    result = load_city_results(city_name.upper())
    if not result:
        raise HTTPException(status_code=404, detail="City not found")
    # Return all fields — public sees everything
    return result


@app.get("/public/cities")
def public_cities():
    """List all available cities (for dropdowns)."""
    return {'cities': list_all_cities()}


@app.get("/public/head-to-head/{city_a}/{city_b}")
def head_to_head(city_a: str, city_b: str):
    """Compare two cities side by side."""
    ra = load_city_results(city_a.upper())
    rb = load_city_results(city_b.upper())
    if not ra: raise HTTPException(404, f"{city_a} not found")
    if not rb: raise HTTPException(404, f"{city_b} not found")

    verdict = (
        f"{ra['city']} has {abs(ra['net_edd'] - rb['net_edd']):.2f} "
        f"{'more' if ra['net_edd'] > rb['net_edd'] else 'less'} "
        f"ecological debt than {rb['city']}. "
        f"{'Neither city' if ra['trend']==rb['trend'] else (ra['city'] if ra['trend']=='improving' else rb['city'])} "
        f"is improving faster."
    )
    return {'city_a': ra, 'city_b': rb, 'verdict': verdict}


# ══════════════════════════════════════════════════════════════════════════════
# CITIZEN TOOL ROUTES
# ══════════════════════════════════════════════════════════════════════════════

class PollutantInput(BaseModel):
    city  : str
    pm25  : float
    pm10  : float
    no2   : float
    so2   : float
    co    : float
    o3    : float

@app.post("/citizen/check")
def citizen_check(data: PollutantInput):
    """
    Citizen enters pollutant values + city.
    Returns: CPCB comparison, debt contribution, health translation,
             30-day projection (no action vs with measures),
             how today's values compare to city's historical average.
    """
    # Run DI check
    check_result = check_citizen_input(
        data.pm25, data.pm10, data.no2, data.so2, data.co, data.o3)

    # Project with measures (1% daily reduction)
    projection = project_with_measures(check_result['daily_debt'], reduction_pct=1.0)

    # Load city baseline from Drive for comparison
    city_data     = load_city_results(data.city.upper())
    city_avg_edd  = city_data['avg_edd_yearly'] if city_data else None
    city_ehs      = city_data['ehs']            if city_data else None
    city_net_edd  = city_data['net_edd']         if city_data else None

    # If this continues 30 days, add to city's existing debt
    if city_net_edd is not None:
        edd_after_30d   = round(city_net_edd + check_result['monthly_debt'], 4)
        new_ehs_30d     = None
        if city_data:
            from formulas import compute_ehs
            new_ehs_30d = compute_ehs(edd_after_30d, city_data['global_max_edd_ref'])
    else:
        edd_after_30d = check_result['monthly_debt']
        new_ehs_30d   = None

    return {
        'check'           : check_result,
        'projection'      : projection,
        'city_context'    : {
            'city'         : data.city.upper(),
            'current_ehs'  : city_ehs,
            'current_edd'  : city_net_edd,
            'avg_yearly'   : city_avg_edd,
            'edd_after_30d': edd_after_30d,
            'ehs_after_30d': new_ehs_30d,
        },
        'safe_limits'     : SAFE_LIMITS,
    }


class PersonalExposureInput(BaseModel):
    city        : str
    years_lived : float

@app.post("/citizen/personal-exposure")
def personal_exposure(data: PersonalExposureInput):
    """Estimate personal cumulative exposure based on city + years lived."""
    city_data = load_city_results(data.city.upper())
    if not city_data:
        raise HTTPException(404, "City not found")

    avg_yearly_edd  = city_data['avg_edd_yearly']
    personal_edd    = round(avg_yearly_edd * data.years_lived, 4)
    cigs_per_day    = round(personal_edd * 0.8, 2)   # proxy
    bad_air_days    = round(personal_edd * 365, 0)    # equivalent days above safe

    return {
        'city'          : data.city.upper(),
        'years_lived'   : data.years_lived,
        'personal_edd'  : personal_edd,
        'cigarette_equiv_total': cigs_per_day,
        'equivalent_bad_air_days': int(bad_air_days),
        'health_message': (
            'Significant long-term exposure. Regular health check-ups recommended.'
            if personal_edd > 2
            else 'Moderate exposure. Stay informed about local air quality.'
            if personal_edd > 0.5
            else 'Low cumulative exposure. City has relatively clean air record.'
        )
    }


# ══════════════════════════════════════════════════════════════════════════════
# SIMULATOR ROUTE (Admin)
# ══════════════════════════════════════════════════════════════════════════════

class SimulatorInput(BaseModel):
    city       : str
    component  : str    # B, V, A, W, S
    improvement: float  # percentage 0–100

@app.post("/admin/simulate", dependencies=[Depends(verify_token)])
def simulate(data: SimulatorInput):
    city_data = load_city_results(data.city.upper())
    if not city_data:
        raise HTTPException(404, "City not found")

    result = run_crf_simulator(
        yearly_data    = city_data['yearly_data'],
        crf_components = city_data['crf_components'],
        component      = data.component,
        pct_improvement= data.improvement,
        max_edd_ref    = city_data['global_max_edd_ref'],
    )
    # Also include original values for comparison
    result['orig_ehs']    = city_data['ehs']
    result['orig_payoff'] = city_data['t_payoff_years']
    result['orig_crf']    = city_data['crf_score']
    return result