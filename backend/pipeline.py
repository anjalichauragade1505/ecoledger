# pipeline.py
# Full city processing pipeline — runs when admin uploads a new city CSV

import pandas as pd
import numpy as np
from formulas import (
    compute_di, compute_crf, compute_edd, compute_ehs,
    compute_tpayoff, estimate_crf_components, run_forecast,
    classify_ehs, POLLUTANTS, SAFE_LIMITS, CRF_NAMES
)


def clean_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Clean and standardise the uploaded CSV."""
    df.columns = [c.strip() for c in df.columns]

    # Handle timestamp / year column
    # NEW — also handles 'From Date', 'To Date', 'Date', 'date' etc.
    ts_col = next(
        (c for c in df.columns if c in ['Timestamp', 'From Date', 'Date', 'date', 'DateTime']),
        None
    )
    if ts_col:
        df['Timestamp'] = pd.to_datetime(df[ts_col], errors='coerce', dayfirst=True)
        df['Year']      = df['Timestamp'].dt.year
        df['Month']     = df['Timestamp'].dt.month
    elif 'Year' not in df.columns:
        raise ValueError(
            f"No timestamp column found. Expected one of: Timestamp, From Date, Date, Year. "
            f"Got: {list(df.columns)}"
        )

    # Normalise city column
    if 'City' not in df.columns and 'Location' in df.columns:
        pass
    elif 'City' in df.columns:
        df['City'] = df['City'].str.strip().str.upper()

    # Clip extreme outliers (same as your Colab)
    if 'PM2.5' in df.columns: df['PM2.5'] = df['PM2.5'].clip(upper=500)
    if 'PM10'  in df.columns: df['PM10']  = df['PM10'].clip(upper=600)

    # Fill missing pollutant columns with 0
    for p in POLLUTANTS:
        if p not in df.columns:
            df[p] = 0.0
        else:
            df[p] = pd.to_numeric(df[p], errors='coerce').fillna(0.0)

    df = df.dropna(subset=['Year'])
    df['Year'] = df['Year'].astype(int)
    return df


def run_full_pipeline(df_raw: pd.DataFrame, city_name: str,
                      global_max_edd: float = None) -> dict:
    """
    Run the complete EDD pipeline for one city.
    Returns a dict ready to be saved to Google Drive and served to React.
    """
    # 1. Clean
    df = clean_dataframe(df_raw)

    # Filter to this city if multiple cities in file
    if 'City' in df.columns:
        cities_in_file = df['City'].unique()
        if city_name.upper() in cities_in_file:
            df = df[df['City'] == city_name.upper()].copy()

    if df.empty:
        raise ValueError(f"No data found for city: {city_name}")

    # 2. DI Calculation
    df = compute_di(df)

    # 3. CRF Components + CRF Score
    crf_components = estimate_crf_components(df)
    crf_score      = compute_crf(crf_components)

    # 4. Yearly EDD
    yearly_df = compute_edd(df, crf_score)

    # 5. Net EDD (latest cumulative)
    net_edd = float(yearly_df['EDD_net_cumulative'].iloc[-1])

    # 6. Max EDD reference (use provided global max or this city's raw max)
    if global_max_edd is None or global_max_edd <= 0:
        global_max_edd = net_edd * 1.5   # fallback

    # 7. EHS Score
    ehs = compute_ehs(net_edd, global_max_edd)

    # 8. T_payoff
    avg_yearly = float(yearly_df['EDD_yearly'].mean())
    t_payoff   = compute_tpayoff(net_edd, crf_score, avg_yearly)

    # 9. Forecast
    forecasts = run_forecast(yearly_df, n_years=5)

    # 10. Seasonal breakdown
    if 'Month' in df.columns:
        seasonal = _seasonal_breakdown(df)
    else:
        seasonal = {}

    # 11. Pollutant contribution breakdown
    pollutant_contrib = _pollutant_contributions(df)

    # 12. Year-over-year trend
    trend = _compute_trend(yearly_df)

    tier_info = classify_ehs(ehs)

    return {
        'city'              : city_name.upper(),
        'ehs'               : ehs,
        'tier'              : tier_info['tier'],
        'tier_color'        : tier_info['color'],
        'tier_emoji'        : tier_info['emoji'],
        'net_edd'           : round(net_edd, 4),
        'crf_score'         : crf_score,
        'crf_components'    : crf_components,
        'crf_names'         : CRF_NAMES,
        't_payoff_years'    : t_payoff,
        'avg_edd_yearly'    : round(avg_yearly, 4),
        'global_max_edd_ref': round(global_max_edd, 4),
        'yearly_data'       : yearly_df.to_dict('records'),
        'forecasts'         : forecasts,
        'seasonal'          : seasonal,
        'pollutant_contrib' : pollutant_contrib,
        'trend'             : trend,
        'years_covered'     : [int(y) for y in yearly_df['Year'].tolist()],
        'data_points'       : len(df),
    }


def _seasonal_breakdown(df: pd.DataFrame) -> dict:
    """Winter/Summer/Monsoon/Post-Monsoon breakdown."""
    def season(m):
        if m in [12, 1, 2]:   return 'Winter'
        elif m in [3, 4, 5]:  return 'Summer'
        elif m in [6, 7, 8, 9]: return 'Monsoon'
        else:                  return 'Post-Monsoon'

    df = df.copy()
    df['Season'] = df['Month'].apply(season)
    result = {}
    for s, grp in df.groupby('Season'):
        result[s] = {
            p: round(float(grp[p].mean()), 2)
            for p in POLLUTANTS if p in grp.columns
        }
    return result


def _pollutant_contributions(df: pd.DataFrame) -> list:
    """Percentage contribution of each pollutant to total DI."""
    contribs = []
    total = 0
    vals  = {}
    for p in POLLUTANTS:
        di_col = f'DI_{p}'
        if di_col in df.columns:
            v = float(df[di_col].mean())
            vals[p] = v
            total  += v

    for p, v in vals.items():
        contribs.append({
            'pollutant'  : p,
            'mean_di'    : round(v, 4),
            'contribution_pct': round((v / total * 100) if total > 0 else 0, 1),
        })
    contribs.sort(key=lambda x: x['contribution_pct'], reverse=True)
    return contribs


def _compute_trend(yearly_df: pd.DataFrame) -> str:
    """Simple trend: improving, worsening, or stable."""
    if len(yearly_df) < 2:
        return 'stable'
    last_two = yearly_df['EDD_net_annual'].iloc[-2:]
    if last_two.iloc[-1] < last_two.iloc[-2] * 0.97:
        return 'improving'
    elif last_two.iloc[-1] > last_two.iloc[-2] * 1.03:
        return 'worsening'
    return 'stable'


def process_multi_city_file(df_raw: pd.DataFrame) -> dict:
    """
    If uploaded CSV has multiple cities, process each separately.
    Returns dict keyed by city name.
    """
    df = clean_dataframe(df_raw)
    cities = df['City'].unique() if 'City' in df.columns else []
    if len(cities) == 0:
        raise ValueError("No city column found in dataset.")

    # First pass: get all net_EDD values to compute global max
    results_raw = {}
    for city in cities:
        city_df = df[df['City'] == city].copy()
        city_df = compute_di(city_df)
        crf_comp = estimate_crf_components(city_df)
        crf      = compute_crf(crf_comp)
        y_df     = compute_edd(city_df, crf)
        results_raw[city] = float(y_df['EDD_net_cumulative'].iloc[-1])

    global_max = max(results_raw.values()) if results_raw else 1.0

    # Second pass: full pipeline with correct global max
    all_results = {}
    for city in cities:
        city_df = df[df['City'] == city].copy()
        all_results[city] = run_full_pipeline(city_df, city, global_max)

    return all_results
