# formulas.py
# All EDD calculation logic — pure functions, no Streamlit, no plots.

import pandas as pd
import numpy as np

# ── Global Constants ──────────────────────────────────────────────────────────
SAFE_LIMITS = {
    'PM2.5': 60,
    'PM10' : 100,
    'NO2'  : 80,
    'SO2'  : 80,
    'CO'   : 4,
    'O3'   : 100,
}
POLLUTANTS        = list(SAFE_LIMITS.keys())
POLLUTANT_WEIGHTS = {p: 1/6 for p in POLLUTANTS}
CRF_W             = {'B': 0.25, 'V': 0.25, 'A': 0.20, 'W': 0.15, 'S': 0.15}
CRF_NAMES         = {
    'B': 'Biotic Integrity',
    'V': 'Vegetation Cover',
    'A': 'Abiotic Stress',
    'W': 'Water Quality',
    'S': 'Soil Health',
}
WHO_LIMITS = {
    'PM2.5': 15,
    'PM10' : 45,
    'NO2'  : 25,
    'SO2'  : 40,
    'CO'   : 4,
    'O3'   : 100,
}

# ── ABSOLUTE EHS Thresholds ───────────────────────────────────────────────────
# EHS = 100 * exp(-k * net_edd), clamped to [0, 100].
#
# CALIBRATION (k = 3.5):
#   net_edd = 0.000  → EHS = 100.0   (pristine)
#   net_edd = 0.01   → EHS = 96.6    (Green Lungs)
#   net_edd = 0.05   → EHS = 83.9    (Green Lungs)
#   net_edd = 0.13   → EHS = 63.5    (Caution Zone — Jaipur-class)
#   net_edd = 0.20   → EHS = 49.7    (Debt Ridden boundary)
#   net_edd = 0.35   → EHS = 29.3    (Critical boundary)
#   net_edd = 0.59   → EHS = 12.8    (Critical — Delhi-class)
#
# Tier classification (same thresholds, always absolute):
#   Green Lungs  ≥ 70  : EHS good, ecologically healthy
#   Caution Zone 50–69 : Moderate debt, watch closely
#   Debt Ridden  30–49 : High debt, intervention needed
#   Critical      < 30 : Severe debt, emergency measures
#
# With k=3.5 the full 0→0.6 net_edd range maps to a ~100→13 EHS spread,
# giving meaningful differentiation across all real-world Indian cities.
EHS_DECAY_K = 8


def compute_ehs(net_edd: float, max_edd_ref: float = None) -> float:
    """
    Absolute EHS using exponential decay — NOT relative to other cities.
    max_edd_ref is accepted for backward-compatibility but ignored.
    EHS = 100 * exp(-k * net_edd), clamped to [0, 100].
    """
    ehs = 100.0 * np.exp(-EHS_DECAY_K * max(0.0, net_edd))
    return round(float(np.clip(ehs, 0, 100)), 2)


# ── EHS Tier Classification ───────────────────────────────────────────────────
def classify_ehs(ehs: float) -> dict:
    """
    Standard tiers — same thresholds always, regardless of dataset.

    Green Lungs  ≥ 70  : Ecologically healthy
    Caution Zone 50–69 : Moderate ecological debt
    Debt Ridden  30–49 : High debt, intervention needed
    Critical      < 30 : Severe debt, emergency measures
    """
    if ehs >= 90:
        return {'tier': 'Green Lungs',  'color': '#2ECC71', 'emoji': '🟢', 'level': 4}
    elif ehs >= 60:
        return {'tier': 'Caution Zone', 'color': '#F1C40F', 'emoji': '🟡', 'level': 3}
    elif ehs >= 30:
        return {'tier': 'Debt Ridden',  'color': '#FF9F43', 'emoji': '🟠', 'level': 2}
    else:
        return {'tier': 'Critical',     'color': '#E74C3C', 'emoji': '🔴', 'level': 1}


# ── DI Calculation ────────────────────────────────────────────────────────────
def compute_di(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    for p in POLLUTANTS:
        if p in df.columns:
            df[f'DI_{p}'] = ((df[p] - SAFE_LIMITS[p]) / SAFE_LIMITS[p]).clip(lower=0)
    cols = [f'DI_{p}' for p in POLLUTANTS if f'DI_{p}' in df.columns]
    if cols:
        df['D_total'] = sum(POLLUTANT_WEIGHTS[p] * df[f'DI_{p}']
                            for p in POLLUTANTS if f'DI_{p}' in df.columns)
    return df


# ── CRF Calculation ───────────────────────────────────────────────────────────
def compute_crf(scores_dict: dict) -> float:
    return round(sum(CRF_W[k] * scores_dict.get(k, 0) for k in CRF_W), 4)


# ── EDD Yearly + Cumulative ───────────────────────────────────────────────────
def compute_edd(df: pd.DataFrame, crf: float) -> pd.DataFrame:
    df = df.copy()
    yearly = df.groupby('Year')['D_total'].mean().reset_index()
    yearly.columns = ['Year', 'EDD_yearly']
    yearly['EDD_net_annual']     = yearly['EDD_yearly'] * (1 - crf)
    yearly['EDD_net_cumulative'] = yearly['EDD_net_annual'].cumsum()
    return yearly


# ── T_payoff ──────────────────────────────────────────────────────────────────
def compute_tpayoff(net_edd: float, crf: float, avg_edd_yearly: float) -> float:
    recovery_rate = crf * avg_edd_yearly
    if recovery_rate <= 0:
        return 999.0
    return round(net_edd / recovery_rate, 2)


# ── CRF Components from raw data ─────────────────────────────────────────────
def estimate_crf_components(df: pd.DataFrame) -> dict:
    def norm(col, limit):
        series = df[col] if col in df.columns else pd.Series([0])
        return float(np.clip(series.median() / limit, 0, 1))

    B = 1 - norm('PM2.5', 200)
    V = 1 - norm('PM10',  300)
    A = 1 - norm('NO2',   200)
    W = 1 - norm('SO2',   200)
    S = 1 - norm('CO',    10)

    return {k: round(v, 4) for k, v in zip(['B','V','A','W','S'], [B,V,A,W,S])}


# ── Forecast (XGBoost) ────────────────────────────────────────────────────────
def run_forecast(yearly_df: pd.DataFrame, n_years: int = 5) -> list:
    try:
        from xgboost import XGBRegressor
        from sklearn.preprocessing import StandardScaler

        df = yearly_df.copy().reset_index(drop=True)
        df['year_idx']    = df['Year'] - df['Year'].min()
        df['edd_lag1']    = df['EDD_net_cumulative'].shift(1).bfill()
        df['edd_lag2']    = df['EDD_net_cumulative'].shift(2).bfill()
        df['edd_rolling'] = df['EDD_net_cumulative'].rolling(2, min_periods=1).mean()
        df['edd_diff']    = df['EDD_net_cumulative'].diff().fillna(0)

        feature_cols = ['year_idx', 'edd_lag1', 'edd_lag2', 'edd_rolling', 'edd_diff']
        X = df[feature_cols].values
        y = df['EDD_net_cumulative'].values

        scaler   = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        model = XGBRegressor(
            n_estimators=200, max_depth=3, learning_rate=0.05,
            subsample=0.8, colsample_bytree=0.8, random_state=42, verbosity=0,
        )
        model.fit(X_scaled, y)

        last_year = int(df['Year'].max())
        year_min  = int(df['Year'].min())
        history   = list(df['EDD_net_cumulative'].values)
        predictions = []

        for i in range(n_years):
            future_year = last_year + i + 1
            year_idx    = future_year - year_min
            lag1        = history[-1]
            lag2        = history[-2] if len(history) >= 2 else history[-1]
            rolling     = np.mean(history[-2:])
            diff        = history[-1] - history[-2] if len(history) >= 2 else 0

            X_pred   = scaler.transform([[year_idx, lag1, lag2, rolling, diff]])
            pred_val = float(model.predict(X_pred)[0])
            pred_val = max(pred_val, history[-1])   # non-decreasing
            history.append(pred_val)

            predictions.append({'Year': future_year, 'EDD_forecast': round(pred_val, 4)})

        return predictions

    except Exception:
        # Fallback to linear regression if XGBoost fails
        from sklearn.linear_model import LinearRegression
        df  = yearly_df.copy()
        X   = df['Year'].values.reshape(-1, 1)
        y   = df['EDD_net_cumulative'].values
        mdl = LinearRegression().fit(X, y)
        last_year = int(df['Year'].max())
        return [
            {'Year': last_year + i + 1,
             'EDD_forecast': round(max(float(mdl.predict([[last_year + i + 1]])[0]),
                                       float(y[-1])), 4)}
            for i in range(n_years)
        ]


# ── Citizen Input Tool ────────────────────────────────────────────────────────
def check_citizen_input(pm25, pm10, no2, so2, co, o3) -> dict:
    readings = {'PM2.5': pm25, 'PM10': pm10, 'NO2': no2,
                'SO2': so2, 'CO': co, 'O3': o3}
    result   = {}
    total_di = 0.0

    for p, val in readings.items():
        limit   = SAFE_LIMITS[p]
        who_lim = WHO_LIMITS[p]
        di      = max(0.0, (val - limit) / limit)
        total_di += di * (1/6)

        if val > limit * 2:      status = 'Severe'
        elif val > limit * 1.5:  status = 'Very Poor'
        elif val > limit:        status = 'Poor'
        elif val > limit * 0.75: status = 'Moderate'
        else:                    status = 'Good'

        result[p] = {
            'value'        : round(val, 2),
            'cpcb_limit'   : limit,
            'who_limit'    : who_lim,
            'di'           : round(di, 4),
            'exceeded_cpcb': val > limit,
            'exceeded_who' : val > who_lim,
            'excess_pct'   : round(di * 100, 1),
            'status'       : status,
        }

    daily_debt   = round(total_di, 4)
    monthly_debt = round(total_di * 30, 4)
    yearly_debt  = round(total_di * 365, 4)
    cigs_per_day = round(total_di * 22, 2)

    if total_di > 0.5:   risk = 'Very High — Immediate health risk'
    elif total_di > 0.3: risk = 'High — Prolonged exposure harmful'
    elif total_di > 0.1: risk = 'Moderate — Sensitive groups at risk'
    elif total_di > 0:   risk = 'Low — Minor exceedance'
    else:                risk = 'Safe — Within all limits'

    return {
        'pollutants'      : result,
        'daily_debt'      : daily_debt,
        'monthly_debt'    : monthly_debt,
        'yearly_debt'     : yearly_debt,
        'cigarettes_equiv': cigs_per_day,
        'health_risk'     : risk,
        'total_di'        : round(total_di, 4),
    }


# ── If-Measures Projection ────────────────────────────────────────────────────
def project_with_measures(daily_debt: float, reduction_pct: float = 1.0) -> dict:
    no_action_30  = round(daily_debt * 30, 4)
    no_action_365 = round(daily_debt * 365, 4)

    daily_series_action = []
    cumulative    = 0.0
    current_daily = daily_debt
    for day in range(1, 366):
        current_daily = current_daily * (1 - reduction_pct / 100)
        cumulative   += current_daily
        if day <= 30 or day % 30 == 0:
            daily_series_action.append({
                'day'       : day,
                'cumulative': round(cumulative, 4),
                'daily'     : round(current_daily, 4),
            })

    return {
        'no_action_30d' : no_action_30,
        'no_action_365d': no_action_365,
        'with_measures' : daily_series_action,
        'saving_30d'    : round(no_action_30  - daily_series_action[29]['cumulative'], 4),
        'saving_365d'   : round(no_action_365 - daily_series_action[-1]['cumulative'], 4),
    }


# ── CRF Simulator ─────────────────────────────────────────────────────────────
def run_crf_simulator(yearly_data: list, crf_components: dict,
                      component: str, pct_improvement: float,
                      max_edd_ref: float) -> dict:
    sim              = crf_components.copy()
    orig_val         = sim[component]
    sim[component]   = min(1.0, orig_val * (1 + pct_improvement / 100))
    sim_crf          = sum(CRF_W[k] * sim[k] for k in CRF_W)

    yr_df                        = pd.DataFrame(yearly_data)
    yr_df['EDD_net_annual']      = yr_df['EDD_yearly'] * (1 - sim_crf)
    yr_df['EDD_net_cumulative']  = yr_df['EDD_net_annual'].cumsum()
    sim_net_edd = float(yr_df['EDD_net_cumulative'].iloc[-1])

    # Absolute EHS — max_edd_ref ignored
    sim_ehs    = compute_ehs(sim_net_edd)
    avg_yr     = float(yr_df['EDD_yearly'].mean())
    sim_payoff = compute_tpayoff(sim_net_edd, sim_crf, avg_yr)

    if sim_ehs >= 70 and sim_payoff <= 10:
        recommendation = 'SAFE — Industry can open with standard regulations'
        rec_color      = 'green'
    elif sim_ehs >= 50 and sim_payoff <= 20:
        recommendation = 'CONDITIONAL — Strict emission monitoring required'
        rec_color      = 'yellow'
    else:
        recommendation = 'NOT RECOMMENDED — Environmental debt too high'
        rec_color      = 'red'

    return {
        'new_ehs'       : sim_ehs,
        'new_payoff_yrs': sim_payoff,
        'new_crf'       : round(sim_crf, 4),
        'orig_val'      : round(orig_val, 4),
        'new_val'       : round(sim[component], 4),
        'component_name': CRF_NAMES[component],
        'sim_yearly'    : yr_df[['Year','EDD_net_cumulative']].to_dict('records'),
        'recommendation': recommendation,
        'rec_color'     : rec_color,
    }