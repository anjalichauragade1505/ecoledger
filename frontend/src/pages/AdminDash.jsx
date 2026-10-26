// src/pages/AdminDash.jsx
// FIXES:
//   1. EDD thresholds rescaled to match actual net_edd values (0.0–2.0 range)
//      Critical  : net_edd >= 0.5
//      High      : net_edd >= 0.2
//      Moderate  : net_edd >= 0.05
//      Low/Stable: net_edd <  0.05
//   2. KPI row shows Selected City EHS (not avg)
//   3. Policy panel rendered in City Detail tab

import { useEffect, useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip
} from 'recharts';
import Navbar      from '../components/shared/Navbar';
import KpiCard     from '../components/shared/KpiCard';
import TierBadge   from '../components/shared/TierBadge';
import EddChart    from '../components/shared/EddChart';
import {
  getAdminDashboard, getAdminCity, uploadCityFile,
  runSimulator, exportCityPDF
} from '../utils/api';

const TABS = ['📊 Scoreboard', '📁 Upload', '🔬 Simulator', '🚨 Alerts', '🏙️ City Detail'];
const CRF_LABELS = { B: 'Biotic', V: 'Vegetation', A: 'Abiotic', W: 'Water', S: 'Soil' };

// ── EDD-Based Policy Engine ───────────────────────────────────────────────────
// net_edd from formulas.py is in range ~0.0001 to ~2.0
// Thresholds calibrated accordingly:
//   >= 0.5  → CRITICAL EMERGENCY
//   >= 0.2  → HIGH RISK
//   >= 0.05 → MODERATE CONCERN
//   <  0.05 → LOW / STABLE
export function getPolicyRecommendations(net_edd) {
  if (net_edd === null || net_edd === undefined) return null;

  if (net_edd >= 0.5) {
    return {
      severity   : 'CRITICAL EMERGENCY',
      color      : '#E74C3C',
      bgColor    : 'rgba(231,76,60,0.08)',
      borderColor: 'rgba(231,76,60,0.4)',
      icon       : '🚨',
      headline   : 'Immediate action required. Ecological debt is severely high.',
      policies   : [
        { icon: '🏭', title: 'Industrial Shutdown',      desc: 'Immediately suspend all non-essential heavy industries and coal-based plants. Enforce daily emission audits.' },
        { icon: '🚗', title: 'Vehicle Ban',              desc: 'Implement odd-even vehicle scheme. Ban diesel vehicles >10 years old. Promote emergency EV adoption.' },
        { icon: '🌳', title: 'Emergency Afforestation',  desc: 'Deploy urban greening task force. Plant 10,000+ trees within 60 days. Create green buffer zones.' },
        { icon: '💧', title: 'Water Body Restoration',   desc: 'Halt all industrial discharge into water bodies. Mandatory effluent treatment before release.' },
        { icon: '⚖️', title: 'Strict Legal Enforcement', desc: 'Invoke environmental emergency act. Maximum penalties for violations. Daily compliance reporting.' },
        { icon: '🏥', title: 'Public Health Alert',      desc: 'Issue citywide air quality health advisory. Distribute masks. Restrict outdoor activity for sensitive groups.' },
      ],
    };
  }

  if (net_edd >= 0.2) {
    return {
      severity   : 'HIGH RISK',
      color      : '#FF9F43',
      bgColor    : 'rgba(255,159,67,0.08)',
      borderColor: 'rgba(255,159,67,0.4)',
      icon       : '⚠️',
      headline   : 'Ecological debt is high. Strict interventions needed to reverse trajectory.',
      policies   : [
        { icon: '🏭', title: 'Emission Caps',           desc: 'Set strict per-industry emission ceilings. Mandatory real-time CEMS sensors on all stacks.' },
        { icon: '🚌', title: 'Public Transport Push',   desc: 'Expand bus rapid transit lanes. Subsidise monthly transit passes. Restrict private vehicles in core zones.' },
        { icon: '🌿', title: 'Green Cover Mandate',     desc: 'Require 25% green cover in all new construction. Penalise builders who clear trees without permits.' },
        { icon: '♻️', title: 'Waste-to-Energy',         desc: 'Accelerate waste segregation and composting. Close open landfill burning sites within 90 days.' },
        { icon: '📊', title: 'Monthly EDD Audits',      desc: 'Conduct monthly ecological debt reviews. Publish city-level pollution accountability reports.' },
        { icon: '💡', title: 'Renewable Energy Targets',desc: 'Mandate 30% renewable in city power mix within 2 years. Incentivise rooftop solar adoption.' },
      ],
    };
  }

  if (net_edd >= 0.05) {
    return {
      severity   : 'MODERATE CONCERN',
      color      : '#F1C40F',
      bgColor    : 'rgba(241,196,15,0.08)',
      borderColor: 'rgba(241,196,15,0.3)',
      icon       : '🔶',
      headline   : 'Ecological debt is moderate. Proactive measures will prevent escalation.',
      policies   : [
        { icon: '🚲', title: 'Cycling & Walking Infrastructure', desc: 'Build protected cycle lanes on major arterials. Develop pedestrian-first zones in high-traffic areas.' },
        { icon: '🌱', title: 'Urban Greening Programme',         desc: 'Incentivise rooftop gardens and vertical green walls. Plant trees along every major road corridor.' },
        { icon: '🏠', title: 'Green Building Code',              desc: 'Mandate energy-efficiency ratings for new buildings. Offer tax rebates for green-certified constructions.' },
        { icon: '📋', title: 'Pollution Monitoring Network',     desc: 'Install IoT air quality sensors in every ward. Make real-time data publicly accessible.' },
        { icon: '🎓', title: 'Environmental Awareness',          desc: 'Launch school and community campaigns on pollution reduction and waste segregation.' },
      ],
    };
  }

  return {
    severity   : 'LOW / STABLE',
    color      : '#2ECC71',
    bgColor    : 'rgba(46,204,113,0.08)',
    borderColor: 'rgba(46,204,113,0.3)',
    icon       : '✅',
    headline   : 'Ecological debt is low. Maintain gains and pursue sustainability goals.',
    policies   : [
      { icon: '🌳', title: 'Conservation Targets',    desc: 'Protect existing green cover. Set 5-year biodiversity targets. Expand wildlife corridors.' },
      { icon: '☀️', title: 'Clean Energy Expansion',  desc: 'Push city renewable share above 50%. Support community solar and wind micro-grids.' },
      { icon: '📈', title: 'Continue EDD Monitoring', desc: 'Maintain quarterly ecological audits. Publish transparent EHS progress dashboards.' },
      { icon: '🤝', title: 'Become a Model City',     desc: 'Share best practices with peer cities. Host regional environmental governance forums.' },
    ],
  };
}

// ── Shared PolicyPanel Component ─────────────────────────────────────────────
export function PolicyPanel({ net_edd, ehs, tier }) {
  const rec = getPolicyRecommendations(net_edd);
  if (!rec) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="glass p-6 mt-6"
      style={{ border: `1px solid ${rec.borderColor}`, background: rec.bgColor }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <span style={{ fontSize: '1.5rem' }}>{rec.icon}</span>
        <div>
          <p style={{ fontFamily: 'Orbitron', color: rec.color, fontSize: '0.85rem', fontWeight: 700, letterSpacing: 2 }}>
            {rec.severity}
          </p>
          <p style={{ fontFamily: 'Poppins', color: '#A7B3AF', fontSize: '0.8rem', marginTop: 2 }}>
            {rec.headline}
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-textDim" style={{ fontFamily: 'Poppins' }}>Net EDD</p>
          <p style={{ fontFamily: 'Orbitron', color: rec.color, fontSize: '1.1rem' }}>
            {typeof net_edd === 'number' ? net_edd.toFixed(4) : net_edd}
          </p>
        </div>
      </div>

      {/* Policy cards */}
      <p className="text-xs uppercase tracking-widest text-textMuted mb-3"
         style={{ fontFamily: 'Poppins', fontWeight: 600 }}>
        Recommended Policy Actions
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {rec.policies.map((p, i) => (
          <motion.div key={i}
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.07 }}
            className="p-3 rounded-xl"
            style={{ background: 'rgba(7,19,15,0.7)', border: '1px solid rgba(30,58,52,0.8)' }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span style={{ fontSize: '1rem' }}>{p.icon}</span>
              <span style={{ fontFamily: 'Poppins', color: rec.color, fontWeight: 600, fontSize: '0.82rem' }}>
                {p.title}
              </span>
            </div>
            <p style={{ fontFamily: 'Inter', color: '#8A9A96', fontSize: '0.75rem', lineHeight: 1.5 }}>
              {p.desc}
            </p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function AdminDash() {
  const [tab,          setTab]          = useState(0);
  const [cities,       setCities]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [selectedCity, setSelectedCity] = useState(null);
  const [cityDetail,   setCityDetail]   = useState(null);
  const [alertThresh,  setAlertThresh]  = useState(40);
  const [simCity,      setSimCity]      = useState('');
  const [simComp,      setSimComp]      = useState('B');
  const [simPct,       setSimPct]       = useState(10);
  const [simResult,    setSimResult]    = useState(null);
  const [simLoading,   setSimLoading]   = useState(false);
  const [uploading,    setUploading]    = useState(false);

  useEffect(() => {
    getAdminDashboard()
      .then(r => { setCities(r.data.cities); setLoading(false); })
      .catch(() => { toast.error('Failed to load dashboard'); setLoading(false); });
  }, []);

  useEffect(() => {
    if (selectedCity) {
      getAdminCity(selectedCity)
        .then(r => setCityDetail(r.data))
        .catch(() => toast.error('Failed to load city'));
    }
  }, [selectedCity]);

  const selectedCityRow = cities.find(c => c.city === selectedCity) || null;

  const onDrop = useCallback(async (files) => {
    if (!files.length) return;
    const fd = new FormData();
    fd.append('file', files[0]);
    setUploading(true);
    try {
      const r = await uploadCityFile(fd);
      toast.success(` Processed: ${r.data.cities_processed.join(', ')}`);
      const dash = await getAdminDashboard();
      setCities(dash.data.cities);
    } catch (err) {
        const detail = err?.response?.data?.detail;
        toast.error(detail ? `Upload failed: ${detail}` : 'Upload failed — check CSV format');
    } finally {
      setUploading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'text/csv': ['.csv'] }, multiple: false
  });

  const handleSimulate = async () => {
    if (!simCity) return toast.error('Select a city first');
    setSimLoading(true);
    try {
      const r = await runSimulator(simCity, simComp, simPct);
      setSimResult(r.data);
    } catch { toast.error('Simulation failed'); }
    finally   { setSimLoading(false); }
  };

  const handleExport = async (city) => {
    try {
      const r   = await exportCityPDF(city);
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
      const a   = document.createElement('a');
      a.href = url; a.download = `${city}_EcoLedger_Report.pdf`; a.click();
      toast.success('PDF downloaded!');
    } catch { toast.error('Export failed'); }
  };

  const flagged = cities.filter(c => c.ehs < alertThresh);

  const ehsColor = (ehs) =>
    ehs >= 70 ? '#2ECC71' : ehs >= 50 ? '#F1C40F' : ehs >= 30 ? '#FF9F43' : '#E74C3C';

  return (
    <div className="min-h-screen" style={{ background: '#07130F' }}>
      <Navbar />
      <div className="pt-20 px-6 max-w-7xl mx-auto pb-16">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex items-center justify-between">
          <div>
            <h1 style={{ fontFamily: 'Orbitron', fontSize: '1.6rem', color: '#2ECC71' }}>
              Admin Command Center
            </h1>
            <p className="text-textMuted text-sm mt-1" style={{ fontFamily: 'Poppins' }}>
              EcoLedger — Ecological Damage Debt Management
            </p>
          </div>
          <div className="glass px-4 py-2 text-xs" style={{ color: '#2ECC71', fontFamily: 'Orbitron' }}>
            🟢 LIVE
          </div>
        </motion.div>

        {/* ── KPI Row ── */}
        {!loading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <KpiCard label="Cities Monitored" value={cities.length} icon="" delay={0.1} />
            <KpiCard
              label={selectedCityRow ? `EHS — ${selectedCityRow.city}` : 'Select a City'}
              value={selectedCityRow ? selectedCityRow.ehs : '—'}
              unit={selectedCityRow ? '/100' : ''}
              icon=""
              color={selectedCityRow ? ehsColor(selectedCityRow.ehs) : '#6B7A76'}
              delay={0.2}
            />
            <KpiCard label="Critical Cities"
              value={cities.filter(c => c.tier === 'Critical').length}
              icon="" color="#E74C3C" delay={0.3} />
            <KpiCard label="Improving"
              value={cities.filter(c => c.trend === 'improving').length}
              icon="" color="#00D1FF" delay={0.4} />
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {TABS.map((t, i) => (
            <button key={i} onClick={() => setTab(i)}
              className="px-5 py-2 rounded-xl text-sm whitespace-nowrap transition-all"
              style={{
                background: tab === i ? 'rgba(46,204,113,0.15)' : 'rgba(16,36,29,0.6)',
                border    : `1px solid ${tab === i ? '#2ECC71' : '#1E3A34'}`,
                color     : tab === i ? '#2ECC71' : '#A7B3AF',
                fontFamily: 'Poppins', fontWeight: 500, cursor: 'pointer',
              }}>
              {t}
            </button>
          ))}
        </div>

        {/* ══ Tab 0: Scoreboard ══ */}
        {tab === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="glass overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid #1E3A34', background: 'rgba(46,204,113,0.06)' }}>
                    {['Rank','City','EHS Score','EDD','Tier','T-Payoff','Trend','Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-textMuted"
                          style={{ fontFamily: 'Poppins', fontWeight: 600, fontSize: '0.75rem',
                                   textTransform: 'uppercase', letterSpacing: 1 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={8} className="text-center py-12 text-textMuted">Loading...</td></tr>
                  ) : cities.map((city, i) => (
                    <motion.tr key={city.city}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      style={{
                        borderBottom: '1px solid rgba(30,58,52,0.5)',
                        cursor      : 'pointer',
                        background  : selectedCity === city.city ? 'rgba(46,204,113,0.06)' : 'transparent',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(46,204,113,0.04)'}
                      onMouseLeave={e => e.currentTarget.style.background =
                        selectedCity === city.city ? 'rgba(46,204,113,0.06)' : 'transparent'}
                      onClick={() => { setSelectedCity(city.city); setTab(4); }}
                    >
                      <td className="px-4 py-3" style={{ color: '#6B7A76', fontFamily: 'Orbitron', fontSize: '0.85rem' }}>
                        #{i + 1}
                      </td>
                      <td className="px-4 py-3 font-semibold" style={{ fontFamily: 'Poppins', color: '#EAEAEA' }}>
                        {city.city}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 rounded-full" style={{ width: 60, background: '#1E3A34' }}>
                            <div className="h-2 rounded-full" style={{
                              width    : `${city.ehs}%`,
                              background: ehsColor(city.ehs),
                            }} />
                          </div>
                          <span style={{ fontFamily: 'Orbitron', fontSize: '0.8rem', color: ehsColor(city.ehs) }}>
                            {city.ehs}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3" style={{ fontFamily: 'Inter', color: '#00D1FF', fontSize: '0.85rem' }}>
                        {city.net_edd?.toFixed(4)}
                      </td>
                      <td className="px-4 py-3"><TierBadge tier={city.tier} size="sm" /></td>
                      <td className="px-4 py-3" style={{ fontFamily: 'Inter', color: '#A7B3AF', fontSize: '0.85rem' }}>
                        {city.t_payoff} yrs
                      </td>
                      <td className="px-4 py-3">
                        <span style={{
                          color    : city.trend === 'improving' ? '#2ECC71' : city.trend === 'worsening' ? '#E74C3C' : '#F1C40F',
                          fontSize : '1.1rem',
                        }}>
                          {city.trend === 'improving' ? '↗' : city.trend === 'worsening' ? '↘' : '→'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={e => { e.stopPropagation(); handleExport(city.city); }}
                          className="text-xs px-3 py-1 rounded-lg transition-all"
                          style={{ border: '1px solid rgba(46,204,113,0.3)', color: '#2ECC71',
                                   background: 'transparent', fontFamily: 'Poppins', cursor: 'pointer' }}>
                          PDF
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* ══ Tab 1: Upload ══ */}
        {tab === 1 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto">
            <div {...getRootProps()}
              className="glass p-16 text-center cursor-pointer transition-all"
              style={{
                border    : `2px dashed ${isDragActive ? '#2ECC71' : '#1E3A34'}`,
                background: isDragActive ? 'rgba(46,204,113,0.05)' : '',
                boxShadow : isDragActive ? '0 0 40px rgba(46,204,113,0.2)' : '',
              }}>
              <input {...getInputProps()} />
              <div className="text-5xl mb-4">{uploading ? '⏳' : '📁'}</div>
              <p style={{ fontFamily: 'Poppins', color: '#EAEAEA', fontSize: '1.1rem', fontWeight: 600 }}>
                {uploading ? 'Processing dataset...' : isDragActive ? 'Drop it here!' : 'Drag & Drop City CSV'}
              </p>
              <p className="text-textMuted text-sm mt-2" style={{ fontFamily: 'Inter' }}>
                or click to browse. Supports single or multi-city CSV files.
              </p>
              {uploading && (
                <div className="mt-4 flex justify-center gap-2 flex-wrap">
                  {['Cleaning data', 'Computing DI', 'Calculating CRF', 'Computing EDD', 'Saving to Drive'].map((s, i) => (
                    <motion.span key={i}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.5 }}
                      className="text-xs px-2 py-1 rounded-full"
                      style={{ background: 'rgba(46,204,113,0.1)', color: '#2ECC71', fontFamily: 'Poppins' }}>
                      ✓ {s}
                    </motion.span>
                  ))}
                </div>
              )}
            </div>

            <div className="glass p-6 mt-6">
              <h3 className="text-sm font-semibold mb-3" style={{ fontFamily: 'Poppins', color: '#2ECC71' }}>
                📋 Expected CSV Columns
              </h3>
              <div className="flex flex-wrap gap-2">
                {['Timestamp or Year','City','PM2.5','PM10','NO2','SO2','CO','O3'].map(c => (
                  <span key={c} className="text-xs px-3 py-1 rounded-full"
                    style={{ background: 'rgba(0,209,255,0.1)', color: '#00D1FF',
                             border: '1px solid rgba(0,209,255,0.2)', fontFamily: 'Inter' }}>
                    {c}
                  </span>
                ))}
              </div>
              <p className="text-textDim text-xs mt-3" style={{ fontFamily: 'Inter' }}>
                Results will be automatically saved to Google Drive under the city's folder.
              </p>
            </div>
          </motion.div>
        )}

        {/* ══ Tab 2: Simulator ══ */}
        {tab === 2 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass p-6">
              <h3 style={{ fontFamily: 'Orbitron', color: '#00C9A7', marginBottom: 20 }}>
                ♻️ CRF Recovery Simulator
              </h3>

              <div className="mb-5">
                <label className="text-textMuted text-xs uppercase tracking-widest mb-2 block"
                       style={{ fontFamily: 'Poppins' }}>Select City</label>
                <select value={simCity} onChange={e => setSimCity(e.target.value)}
                  className="w-full p-3 rounded-xl text-sm outline-none"
                  style={{ background: '#0A1814', border: '1px solid #1E3A34',
                           color: '#EAEAEA', fontFamily: 'Inter' }}>
                  <option value="">-- Choose City --</option>
                  {cities.map(c => <option key={c.city} value={c.city}>{c.city}</option>)}
                </select>
              </div>

              <div className="mb-5">
                <label className="text-textMuted text-xs uppercase tracking-widest mb-2 block"
                       style={{ fontFamily: 'Poppins' }}>CRF Component</label>
                <div className="grid grid-cols-5 gap-2">
                  {Object.entries(CRF_LABELS).map(([k, v]) => (
                    <button key={k} onClick={() => setSimComp(k)}
                      className="py-2 rounded-xl text-xs font-semibold transition-all"
                      style={{
                        background: simComp === k ? 'rgba(0,201,167,0.2)' : 'rgba(10,24,20,0.8)',
                        border    : `1px solid ${simComp === k ? '#00C9A7' : '#1E3A34'}`,
                        color     : simComp === k ? '#00C9A7' : '#A7B3AF',
                        fontFamily: 'Poppins', cursor: 'pointer',
                      }}>
                      {k}<br /><span style={{ fontSize: '0.65rem' }}>{v}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <label className="text-textMuted text-xs uppercase tracking-widest mb-2 block"
                       style={{ fontFamily: 'Poppins' }}>
                  Improvement: <span style={{ color: '#2ECC71' }}>{simPct}%</span>
                </label>
                <input type="range" min={1} max={100} value={simPct}
                  onChange={e => setSimPct(Number(e.target.value))}
                  className="w-full" style={{ accentColor: '#2ECC71' }} />
                <div className="flex justify-between text-textDim text-xs mt-1">
                  <span>1%</span><span>100%</span>
                </div>
              </div>

              <button onClick={handleSimulate} disabled={simLoading} className="btn-primary w-full">
                {simLoading ? '⏳ Simulating...' : '▶ Run Simulation'}
              </button>
            </div>

            {/* Simulator Results */}
            <div className="glass p-6">
              {simResult ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <h3 style={{ fontFamily: 'Orbitron', color: '#2ECC71', marginBottom: 16, fontSize: '0.9rem' }}>
                    Simulation Results — {simCity}
                  </h3>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    {[
                      { label: 'Original EHS',    value: simResult.orig_ehs,              color: '#A7B3AF' },
                      { label: 'New EHS',         value: simResult.new_ehs,               color: '#2ECC71' },
                      { label: 'Original Payoff', value: `${simResult.orig_payoff} yrs`,  color: '#A7B3AF' },
                      { label: 'New Payoff',      value: `${simResult.new_payoff_yrs} yrs`, color: '#00C9A7' },
                    ].map(item => (
                      <div key={item.label} className="p-3 rounded-xl"
                           style={{ background: 'rgba(10,24,20,0.8)', border: '1px solid #1E3A34' }}>
                        <p className="text-textDim text-xs mb-1" style={{ fontFamily: 'Poppins' }}>{item.label}</p>
                        <p style={{ fontFamily: 'Orbitron', color: item.color, fontSize: '1.2rem', fontWeight: 700 }}>
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 rounded-xl mb-4" style={{
                    background: simResult.rec_color === 'green'  ? 'rgba(46,204,113,0.1)'
                               : simResult.rec_color === 'yellow' ? 'rgba(241,196,15,0.1)'
                               : 'rgba(231,76,60,0.1)',
                    border: `1px solid ${simResult.rec_color === 'green' ? '#2ECC71' : simResult.rec_color === 'yellow' ? '#F1C40F' : '#E74C3C'}`,
                  }}>
                    <p className="text-sm" style={{
                      fontFamily: 'Poppins',
                      color: simResult.rec_color === 'green' ? '#2ECC71' : simResult.rec_color === 'yellow' ? '#F1C40F' : '#E74C3C',
                    }}>
                      {simResult.recommendation}
                    </p>
                  </div>

                  <EddChart
                    yearlyData={simResult.sim_yearly.map(d => ({
                      Year: d.Year, EDD_net_cumulative: d.EDD_net_cumulative, EDD_net_annual: 0
                    }))}
                    height={180}
                  />
                </motion.div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-textMuted text-center py-16">
                  <div className="text-5xl mb-4">🔬</div>
                  <p style={{ fontFamily: 'Poppins' }}>Configure and run a simulation to see results</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ══ Tab 3: Alerts ══ */}
        {tab === 3 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl">
            <div className="glass p-6 mb-6">
              <h3 style={{ fontFamily: 'Orbitron', color: '#E74C3C', marginBottom: 16 }}>
                🚨 Alert Threshold Manager
              </h3>
              <label className="text-textMuted text-xs uppercase tracking-widest mb-2 block"
                     style={{ fontFamily: 'Poppins' }}>
                Flag cities with EHS below: <span style={{ color: '#E74C3C' }}>{alertThresh}</span>
              </label>
              <input type="range" min={0} max={100} value={alertThresh}
                onChange={e => setAlertThresh(Number(e.target.value))}
                className="w-full mb-2" style={{ accentColor: '#E74C3C' }} />
              <p className="text-textDim text-xs" style={{ fontFamily: 'Inter' }}>
                {flagged.length} cities flagged
              </p>
            </div>

            {flagged.length === 0 ? (
              <div className="glass p-10 text-center">
                <div className="text-4xl mb-3">✅</div>
                <p className="text-textMuted" style={{ fontFamily: 'Poppins' }}>
                  No cities below threshold {alertThresh}
                </p>
              </div>
            ) : flagged.map((city, i) => (
              <motion.div key={city.city}
                initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="glass p-4 mb-3 flex items-center justify-between"
                style={{ borderLeft: '3px solid #E74C3C', cursor: 'pointer' }}
                onClick={() => { setSelectedCity(city.city); setTab(4); }}>
                <div>
                  <p className="font-semibold" style={{ fontFamily: 'Poppins', color: '#EAEAEA' }}>
                    {city.city}
                  </p>
                  <p className="text-xs text-textMuted" style={{ fontFamily: 'Inter' }}>
                    EHS: <span style={{ color: ehsColor(city.ehs), fontFamily: 'Orbitron' }}>{city.ehs}</span>
                    {' '}| EDD: <span style={{ color: '#00D1FF' }}>{city.net_edd?.toFixed(4)}</span>
                    {' '}| T-Payoff: {city.t_payoff} years
                  </p>
                </div>
                <TierBadge tier={city.tier} />
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* ══ Tab 4: City Detail ══ */}
        {tab === 4 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="mb-4">
              <select value={selectedCity || ''} onChange={e => setSelectedCity(e.target.value)}
                className="p-3 rounded-xl text-sm outline-none mr-4"
                style={{ background: '#0A1814', border: '1px solid #1E3A34',
                         color: '#EAEAEA', fontFamily: 'Inter' }}>
                <option value="">-- Select City --</option>
                {cities.map(c => <option key={c.city} value={c.city}>{c.city}</option>)}
              </select>
            </div>

            {cityDetail ? (
              <>
                {/* ── EHS Hero Banner ── */}
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                  className="glass p-5 mb-6 flex items-center gap-6 flex-wrap"
                  style={{
                    border    : `1px solid ${ehsColor(cityDetail.ehs)}55`,
                    background: `${ehsColor(cityDetail.ehs)}0A`,
                    boxShadow : `0 0 30px ${ehsColor(cityDetail.ehs)}18`,
                  }}>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-textMuted mb-1"
                       style={{ fontFamily: 'Poppins' }}>
                      Environmental Health Score
                    </p>
                    <p style={{ fontFamily: 'Orbitron', fontSize: '3rem', fontWeight: 900,
                                color: ehsColor(cityDetail.ehs), lineHeight: 1 }}>
                      {cityDetail.ehs}
                      <span style={{ fontSize: '1.2rem', color: '#6B7A76' }}>/100</span>
                    </p>
                  </div>
                  <div style={{ borderLeft: '1px solid #1E3A34', paddingLeft: 24 }}>
                    <TierBadge tier={cityDetail.tier} />
                    <p className="text-xs text-textMuted mt-2" style={{ fontFamily: 'Poppins' }}>
                      {cityDetail.tier_emoji} {cityDetail.city}
                    </p>
                  </div>
                  <div style={{ borderLeft: '1px solid #1E3A34', paddingLeft: 24 }}>
                    <p className="text-xs text-textDim mb-1" style={{ fontFamily: 'Poppins' }}>Net EDD</p>
                    <p style={{ fontFamily: 'Orbitron', color: '#00D1FF', fontSize: '1.4rem' }}>
                      {cityDetail.net_edd?.toFixed(4)}
                    </p>
                  </div>
                  <div style={{ borderLeft: '1px solid #1E3A34', paddingLeft: 24 }}>
                    <p className="text-xs text-textDim mb-1" style={{ fontFamily: 'Poppins' }}>Recovery</p>
                    <p style={{ fontFamily: 'Orbitron', color: '#F1C40F', fontSize: '1.4rem' }}>
                      {cityDetail.t_payoff_years} yrs
                    </p>
                  </div>
                  <div className="ml-auto">
                    <button onClick={() => handleExport(cityDetail.city)} className="btn-primary text-sm">
                      📄 Export PDF
                    </button>
                  </div>
                </motion.div>

                {/* ── Charts + Stats Grid ── */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2 glass p-5">
                    <h3 className="text-sm font-semibold mb-4"
                        style={{ fontFamily: 'Poppins', color: '#00D1FF' }}>
                      📈 EDD History + Forecast — {cityDetail.city}
                    </h3>
                    <EddChart yearlyData={cityDetail.yearly_data} forecasts={cityDetail.forecasts} height={300} />
                  </div>

                  <div className="flex flex-col gap-4">
                    <div className="glass p-4">
                      <div className="space-y-3">
                        {[
                          ['EHS Score',   cityDetail.ehs,                          ehsColor(cityDetail.ehs)],
                          ['Net EDD',     cityDetail.net_edd?.toFixed(4),          '#00D1FF'],
                          ['CRF Score',   cityDetail.crf_score,                    '#00C9A7'],
                          ['Recovery',    `${cityDetail.t_payoff_years} yrs`,      '#F1C40F'],
                          ['Data Points', cityDetail.data_points,                  '#A7B3AF'],
                          ['Trend',       cityDetail.trend, cityDetail.trend === 'improving' ? '#2ECC71' : '#E74C3C'],
                        ].map(([k, v, c]) => (
                          <div key={k} className="flex justify-between items-center">
                            <span className="text-textMuted text-xs" style={{ fontFamily: 'Poppins' }}>{k}</span>
                            <span style={{ fontFamily: 'Orbitron', color: c, fontSize: '0.85rem' }}>{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="glass p-4">
                      <p className="text-xs text-textMuted mb-3" style={{ fontFamily: 'Poppins' }}>CRF Components</p>
                      <ResponsiveContainer width="100%" height={160}>
                        <RadarChart data={Object.entries(cityDetail.crf_components || {}).map(([k, v]) => ({
                          component: CRF_LABELS[k] || k, value: v
                        }))}>
                          <PolarGrid stroke="rgba(46,204,113,0.2)" />
                          <PolarAngleAxis dataKey="component"
                            tick={{ fill: '#A7B3AF', fontSize: 9, fontFamily: 'Inter' }} />
                          <Radar dataKey="value" stroke="#2ECC71" fill="#2ECC71" fillOpacity={0.2} />
                          <Tooltip contentStyle={{ background: '#10241D', border: '1px solid #1E3A34',
                                                    fontFamily: 'Inter', fontSize: 11 }} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* ── EDD-Based Policy Recommendations ── */}
                <PolicyPanel
                  net_edd={cityDetail.net_edd}
                  ehs={cityDetail.ehs}
                  tier={cityDetail.tier}
                />
              </>
            ) : (
              <div className="glass p-12 text-center text-textMuted" style={{ fontFamily: 'Poppins' }}>
                Select a city to view details
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}