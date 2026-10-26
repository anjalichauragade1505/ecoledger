// src/pages/Citizen.jsx
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend, AreaChart, Area
} from 'recharts';
import Navbar  from '../components/shared/Navbar';
import EddChart from '../components/shared/EddChart';
import { getPublicCities, getPublicCity, checkCitizenInput, getPersonalExposure } from '../utils/api';

const POLLUTANTS = [
  { key: 'pm25',  label: 'PM2.5',  unit: 'µg/m³', max: 500,  cpcb: 60,  who: 15,  color: '#FF5C5C' },
  { key: 'pm10',  label: 'PM10',   unit: 'µg/m³', max: 600,  cpcb: 100, who: 45,  color: '#FFC857' },
  { key: 'no2',   label: 'NO₂',    unit: 'µg/m³', max: 400,  cpcb: 80,  who: 25,  color: '#FF9F43' },
  { key: 'so2',   label: 'SO₂',    unit: 'µg/m³', max: 400,  cpcb: 80,  who: 40,  color: '#00D1FF' },
  { key: 'co',    label: 'CO',     unit: 'mg/m³',  max: 20,   cpcb: 4,   who: 4,   color: '#2ECC71' },
  { key: 'o3',    label: 'O₃',     unit: 'µg/m³', max: 300,  cpcb: 100, who: 100, color: '#00C9A7' },
];

const STATUS_COLOR = {
  Severe    : '#9B1C31',
  'Very Poor': '#E74C3C',
  Poor      : '#FF9F43',
  Moderate  : '#F1C40F',
  Good      : '#2ECC71',
};
// ─────────────────────────────────────────────────────────────
// EDD-Based Citizen Policy Recommendation Engine
// Calibrated for real EDD scale (~0.0001 → 2.0)
// Matches admin panel structure: icon + title + desc cards
// ─────────────────────────────────────────────────────────────

function getCitizenRecommendations(net_edd) {
  if (net_edd === null || net_edd === undefined) return null;

  if (net_edd >= 0.5) {
    return {
      severity   : 'CRITICAL EMERGENCY',
      color      : '#E74C3C',
      bgColor    : 'rgba(231,76,60,0.08)',
      borderColor: 'rgba(231,76,60,0.4)',
      icon       : '🚨',
      headline   : 'Pollution levels are extremely dangerous. Your immediate action matters.',
      policies   : [
        { icon: '😷', title: 'Wear N95 Masks',            desc: 'Always wear a certified N95 or equivalent mask outdoors. Avoid surgical masks — they don\'t filter fine particles.' },
        { icon: '🚗', title: 'Avoid Private Vehicles',    desc: 'Switch to public transport, cycling, or walking. Each trip avoided cuts your personal emissions contribution.' },
        { icon: '🏠', title: 'Stay Indoors',              desc: 'Keep windows shut during peak pollution hours (morning and evening). Use air purifiers with HEPA filters indoors.' },
        { icon: '🌳', title: 'Plant Emergency Green',     desc: 'Place air-purifying indoor plants (Peace Lily, Snake Plant). Support community tree-planting drives.' },
        { icon: '📢', title: 'Raise Community Awareness', desc: 'Alert your neighbourhood. Share AQI data. Demand emergency clean-air action from local authorities.' },
        { icon: '🏥', title: 'Monitor Your Health',       desc: 'Seek medical attention if experiencing respiratory symptoms. Elderly, children and asthma patients must stay indoors.' },
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
      headline   : 'Ecological debt is rising fast. Strong personal action can make a real difference.',
      policies   : [
        { icon: '🚌', title: 'Use Public Transport',      desc: 'Choose buses, metro, or carpooling over private vehicles. Reducing vehicle emissions directly lowers city EDD.' },
        { icon: '♻️', title: 'Segregate & Reduce Waste',  desc: 'Separate dry/wet waste at home. Avoid burning garbage or crop stubble. Compost organic waste instead.' },
        { icon: '🌿', title: 'Grow Green at Home',        desc: 'Plant trees and shrubs around your home. Participate in local afforestation campaigns and green drives.' },
        { icon: '💡', title: 'Cut Energy Consumption',    desc: 'Switch to LED bulbs, unplug idle devices, and use energy-efficient appliances to reduce power-plant emissions.' },
        { icon: '📋', title: 'Track Local AQI Daily',     desc: 'Check AQI apps before outdoor activity. Adjust plans when AQI exceeds 150. Share readings with your network.' },
        { icon: '🗳️', title: 'Demand Policy Action',      desc: 'Petition local councillors for cleaner fuel policies, emission-free zones, and better public transport.' },
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
      headline   : 'Pollution is moderate. Early action now prevents long-term ecological damage.',
      policies   : [
        { icon: '🚲', title: 'Cycle for Short Trips',     desc: 'Replace car trips under 5 km with cycling or walking. It cuts emissions and improves your personal health.' },
        { icon: '🌱', title: 'Plant Indoor Greenery',     desc: 'Grow air-purifying plants indoors. Support neighbourhood green cover initiatives and rooftop gardens.' },
        { icon: '🏠', title: 'Green Your Home',           desc: 'Improve home insulation and ventilation. Install solar panels if feasible. Switch to LPG or induction cooking.' },
        { icon: '📋', title: 'Participate in Monitoring', desc: 'Join citizen science AQI monitoring programs. Report illegal burning or industrial smoke to authorities.' },
        { icon: '🎓', title: 'Educate Your Community',    desc: 'Organise awareness sessions in schools and housing societies. Encourage waste segregation and composting.' },
      ],
    };
  }

  return {
    severity   : 'LOW / STABLE',
    color      : '#2ECC71',
    bgColor    : 'rgba(46,204,113,0.08)',
    borderColor: 'rgba(46,204,113,0.3)',
    icon       : '✅',
    headline   : 'Environmental conditions are stable. Keep up sustainable habits to protect your city.',
    policies   : [
      { icon: '🌳', title: 'Protect Green Spaces',        desc: 'Volunteer for tree-planting and park clean-up drives. Oppose unnecessary felling of urban trees.' },
      { icon: '☀️', title: 'Go Renewable at Home',        desc: 'Install rooftop solar or join a community solar scheme. Switch to green energy providers where available.' },
      { icon: '📈', title: 'Stay Informed',               desc: 'Follow your city\'s EHS and AQI trends. Share progress with neighbours to reinforce collective good habits.' },
      { icon: '🤝', title: 'Be a Green Ambassador',       desc: 'Inspire friends and family to adopt eco-friendly practices. Lead by example in your community.' },
    ],
  };
}

function CitizenPolicyPanel({ net_edd }) {
  const rec = getCitizenRecommendations(net_edd);
  if (!rec) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="glass p-6 mt-6"
      style={{ border: `1px solid ${rec.borderColor}`, background: rec.bgColor }}
    >
      {/* Header — identical structure to admin PolicyPanel */}
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

      {/* Policy cards — same card layout as admin */}
      <p className="text-xs uppercase tracking-widest text-textMuted mb-3"
         style={{ fontFamily: 'Poppins', fontWeight: 600 }}>
        Recommended Citizen Actions
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {rec.policies.map((p, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
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

export default function Citizen() {
  const [cities,       setCities]       = useState([]);
  const [selectedCity, setSelectedCity] = useState('');
  const [cityData,     setCityData]     = useState(null);
  const [values,       setValues]       = useState({ pm25:30, pm10:60, no2:40, so2:30, co:2, o3:50 });
  const [result,       setResult]       = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [tab,          setTab]          = useState(0);
  const [yearsLived,   setYearsLived]   = useState(5);
  const [exposure,     setExposure]     = useState(null);
  const [expLoad,      setExpLoad]      = useState(false);

  useEffect(() => {
    getPublicCities().then(r => setCities(r.data.cities));
  }, []);

  useEffect(() => {
    if (selectedCity) {
      getPublicCity(selectedCity).then(r => setCityData(r.data));
    }
  }, [selectedCity]);

  const handleCheck = async () => {
    if (!selectedCity) return;
    setLoading(true);
    try {
      const r = await checkCitizenInput({ city: selectedCity, ...values });
      setResult(r.data);
      setTab(1);
    } finally { setLoading(false); }
  };

  const handleExposure = async () => {
    if (!selectedCity) return;
    setExpLoad(true);
    try {
      const r = await getPersonalExposure(selectedCity, yearsLived);
      setExposure(r.data);
    } finally { setExpLoad(false); }
  };

  // Build projection chart data
  const projectionData = result?.projection?.with_measures?.map(d => ({
    day       : d.day,
    withAction: d.cumulative,
    noAction  : result.projection.no_action_30d
      ? (result.check.daily_debt * d.day) : d.cumulative,
  })) || [];

  const TABS = [' Input Tool', ' Results', ' City Profile', ' Personal Exposure'];

  return (
    <div className="min-h-screen" style={{ background: '#07130F' }}>
      <Navbar />
      <div className="pt-24 px-6 max-w-6xl mx-auto pb-16">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8 text-center">
          <h1 style={{ fontFamily: 'Orbitron', fontSize: '1.8rem', fontWeight: 900, color: '#2ECC71', letterSpacing: 3 }}>
            CITIZEN DASHBOARD
          </h1>
          <p className="text-textMuted mt-2" style={{ fontFamily: 'Poppins' }}>
            Understand your city's ecological debt and what today's air means for tomorrow.
          </p>
        </motion.div>

        {/* City selector — always visible */}
        <div className="glass p-4 mb-6 flex items-center gap-4 flex-wrap">
          <span className="text-textMuted text-sm" style={{ fontFamily: 'Poppins' }}>Your City:</span>
          <select value={selectedCity} onChange={e => setSelectedCity(e.target.value)}
            className="p-3 rounded-xl text-sm outline-none flex-1"
            style={{ background: '#0A1814', border: '2px solid #2ECC71',
                     color: '#EAEAEA', fontFamily: 'Poppins', maxWidth: 260 }}>
            <option value="">-- Select your city --</option>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {cityData && (
            <div className="flex items-center gap-3 text-sm">
              <span style={{ fontFamily: 'Poppins', color: '#A7B3AF' }}>EHS:</span>
              <span style={{ fontFamily: 'Orbitron', color: cityData.tier_color, fontSize: '1rem' }}>
                {cityData.ehs}
              </span>
              <span style={{ fontFamily: 'Poppins', color: cityData.tier_color, fontWeight: 600 }}>
                {cityData.tier_emoji} {cityData.tier}
              </span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {TABS.map((t, i) => (
            <button key={i} onClick={() => setTab(i)}
              className="px-4 py-2 rounded-xl text-sm whitespace-nowrap transition-all"
              style={{
                background: tab===i ? 'rgba(46,204,113,0.15)' : 'rgba(16,36,29,0.6)',
                border    : `1px solid ${tab===i ? '#2ECC71' : '#1E3A34'}`,
                color     : tab===i ? '#2ECC71' : '#A7B3AF',
                fontFamily: 'Poppins', fontWeight: 500, cursor: 'pointer',
              }}>
              {t}
            </button>
          ))}
        </div>

        {/* ── Tab 0: Input Tool ── */}
        {tab === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="glass p-6">
              <h3 className="mb-6" style={{ fontFamily: 'Orbitron', color: '#00C9A7', fontSize: '1rem' }}>
                🎚️ Enter Today's Pollutant Readings
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {POLLUTANTS.map(p => (
                  <div key={p.key}>
                    <div className="flex justify-between mb-2">
                      <span style={{ fontFamily: 'Poppins', color: '#EAEAEA', fontWeight: 600 }}>
                        {p.label}
                      </span>
                      <span style={{ fontFamily: 'Orbitron', color: p.color, fontSize: '1rem' }}>
                        {values[p.key]} <span className="text-xs text-textMuted">{p.unit}</span>
                      </span>
                    </div>

                    <input type="range" min={0} max={p.max} step={0.5}
                      value={values[p.key]}
                      onChange={e => setValues({ ...values, [p.key]: Number(e.target.value) })}
                      className="w-full mb-2"
                      style={{ accentColor: p.color }}
                    />

                    {/* CPCB + WHO limit markers */}
                    <div className="flex gap-3 text-xs">
                      <span className="px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(46,204,113,0.1)', color: '#2ECC71',
                                 border: '1px solid rgba(46,204,113,0.2)', fontFamily: 'Inter' }}>
                        CPCB: {p.cpcb}
                      </span>
                      <span className="px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(0,209,255,0.1)', color: '#00D1FF',
                                 border: '1px solid rgba(0,209,255,0.2)', fontFamily: 'Inter' }}>
                        WHO: {p.who}
                      </span>
                      {values[p.key] > p.cpcb && (
                        <span className="px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(231,76,60,0.1)', color: '#E74C3C',
                                   border: '1px solid rgba(231,76,60,0.2)', fontFamily: 'Inter' }}>
                          ⚠ Exceeds CPCB
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={handleCheck} disabled={loading || !selectedCity}
                className="btn-primary w-full mt-8 text-base py-4"
                style={{ opacity: !selectedCity ? 0.5 : 1 }}>
                {loading ? '⏳ Analysing...' : !selectedCity ? 'Select a city first' : '🔍 Analyse & Calculate Debt Impact'}
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Tab 1: Results ── */}
        {tab === 1 && result && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">

            {/* Health risk banner */}
            <div className="glass p-5 text-center"
              style={{
                borderTop: `3px solid ${
                  result.check.total_di > 0.3 ? '#E74C3C' :
                  result.check.total_di > 0.1 ? '#F1C40F' : '#2ECC71'
                }`,
              }}>
              <p style={{ fontFamily: 'Orbitron', fontSize: '1.3rem',
                          color: result.check.total_di > 0.3 ? '#E74C3C' :
                                 result.check.total_di > 0.1 ? '#F1C40F' : '#2ECC71' }}>
                {result.check.health_risk}
              </p>
              <p className="text-textMuted text-sm mt-1" style={{ fontFamily: 'Poppins' }}>
                🚬 Equivalent to smoking {result.check.cigarettes_equiv} cigarettes/day
              </p>
            </div>

            {/* Pollutant status bars */}
            <div className="glass p-6">
              <h3 className="mb-5" style={{ fontFamily: 'Poppins', color: '#00C9A7', fontWeight: 600 }}>
                Pollutant Analysis vs CPCB & WHO Limits
              </h3>
              <div className="space-y-4">
                {POLLUTANTS.map(p => {
                  const r = result.check.pollutants[p.label.replace('₂','2').replace('₃','3')];
                  if (!r) return null;
                  const pct = Math.min((r.value / (r.cpcb_limit * 2)) * 100, 100);
                  return (
                    <div key={p.key}>
                      <div className="flex justify-between mb-1">
                        <span style={{ fontFamily: 'Poppins', color: '#EAEAEA', fontSize: '0.9rem' }}>
                          {p.label}
                        </span>
                        <div className="flex items-center gap-2">
                          <span style={{ fontFamily: 'Orbitron', color: p.color, fontSize: '0.85rem' }}>
                            {r.value}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-xs"
                            style={{
                              background: `${STATUS_COLOR[r.status]}22`,
                              color     : STATUS_COLOR[r.status] || '#2ECC71',
                              border    : `1px solid ${STATUS_COLOR[r.status] || '#2ECC71'}55`,
                              fontFamily: 'Poppins',
                            }}>
                            {r.status}
                          </span>
                        </div>
                      </div>
                      <div className="h-3 rounded-full relative" style={{ background: '#1E3A34' }}>
                        {/* WHO marker */}
                        <div className="absolute top-0 bottom-0 w-0.5 rounded"
                          style={{ left: `${(r.who_limit / (r.cpcb_limit * 2)) * 100}%`,
                                   background: '#00D1FF', opacity: 0.6 }} />
                        {/* CPCB marker */}
                        <div className="absolute top-0 bottom-0 w-0.5 rounded"
                          style={{ left: '50%', background: '#F1C40F', opacity: 0.6 }} />
                        <motion.div className="h-3 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8 }}
                          style={{ background: `linear-gradient(90deg, ${p.color}88, ${p.color})` }}
                        />
                      </div>
                      {r.exceeded_cpcb && (
                        <p className="text-xs mt-1" style={{ color: '#E74C3C', fontFamily: 'Inter' }}>
                          ⚠ Exceeds CPCB by {r.excess_pct}%
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Debt contribution */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: 'Today\'s Debt Addition', value: result.check.daily_debt, unit: 'EDD units', color: '#FF9F43' },
                { label: '30-Day Projection',      value: result.check.monthly_debt, unit: 'EDD units', color: '#E74C3C' },
                { label: '1-Year Projection',      value: result.check.yearly_debt,  unit: 'EDD units', color: '#9B1C31' },
              ].map(item => (
                <div key={item.label} className="glass p-5 text-center"
                  style={{ boxShadow: `0 0 15px ${item.color}22` }}>
                  <p className="text-textMuted text-xs mb-2" style={{ fontFamily: 'Poppins', textTransform: 'uppercase' }}>
                    {item.label}
                  </p>
                  <p style={{ fontFamily: 'Orbitron', color: item.color, fontSize: '1.6rem', fontWeight: 700 }}>
                    +{item.value}
                  </p>
                  <p className="text-textDim text-xs mt-1" style={{ fontFamily: 'Inter' }}>{item.unit}</p>
                </div>
              ))}
            </div>

            {/* City EHS impact */}
            {result.city_context?.current_ehs && (
              <div className="glass p-5"
                style={{ border: '1px solid rgba(231,76,60,0.3)', background: 'rgba(231,76,60,0.04)' }}>
                <h3 className="mb-3" style={{ fontFamily: 'Poppins', color: '#FF9F43', fontWeight: 600 }}>
                  📉 Impact on {selectedCity}'s Ecological Health
                </h3>
                <div className="flex items-center gap-6 flex-wrap">
                  <div>
                    <p className="text-textDim text-xs" style={{ fontFamily: 'Poppins' }}>Current EHS</p>
                    <p style={{ fontFamily: 'Orbitron', color: '#2ECC71', fontSize: '1.4rem' }}>
                      {result.city_context.current_ehs}
                    </p>
                  </div>
                  <div style={{ color: '#E74C3C', fontSize: '1.5rem' }}>→</div>
                  <div>
                    <p className="text-textDim text-xs" style={{ fontFamily: 'Poppins' }}>After 30 days like this</p>
                    <p style={{ fontFamily: 'Orbitron', color: '#E74C3C', fontSize: '1.4rem' }}>
                      {result.city_context.ehs_after_30d ?? '—'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Projection chart — action vs no action */}
            {projectionData.length > 0 && (
              <div className="glass p-6">
                <h3 className="mb-4" style={{ fontFamily: 'Poppins', color: '#2ECC71', fontWeight: 600 }}>
                  📈 30-Day EDD Accumulation: Action vs No Action
                </h3>
                <p className="text-textMuted text-xs mb-4" style={{ fontFamily: 'Inter' }}>
                  "With Action" assumes 1% daily reduction in pollution through measures.
                </p>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={projectionData}>
                    <defs>
                      <linearGradient id="noActGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#E74C3C" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#E74C3C" stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#2ECC71" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#2ECC71" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(46,204,113,0.1)" />
                    <XAxis dataKey="day" stroke="#6B7A76"
                      tick={{ fontFamily: 'Inter', fontSize: 11 }}
                      label={{ value: 'Day', position: 'insideBottom', fill: '#6B7A76', fontSize: 11 }} />
                    <YAxis stroke="#6B7A76" tick={{ fontFamily: 'Inter', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: '#10241D', border: '1px solid #1E3A34',
                                             fontFamily: 'Inter', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontFamily: 'Inter', fontSize: 12, color: '#A7B3AF' }} />
                    <Area type="monotone" dataKey="noAction"   name="No Action"
                      stroke="#E74C3C" fill="url(#noActGrad)" strokeWidth={2} />
                    <Area type="monotone" dataKey="withAction" name="With Measures"
                      stroke="#2ECC71" fill="url(#actGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>

                {result.projection.saving_30d && (
                  <div className="mt-4 p-3 rounded-xl text-center"
                    style={{ background: 'rgba(46,204,113,0.08)', border: '1px solid rgba(46,204,113,0.2)' }}>
                    <p style={{ fontFamily: 'Poppins', color: '#2ECC71', fontSize: '0.9rem' }}>
                      💚 With measures, {selectedCity} saves{' '}
                      <strong>{result.projection.saving_30d} EDD units</strong> in 30 days.
                    </p>
                  </div>
                )}
              </div>
            )}
            {/* Citizen Recommendations — driven by city's current net EDD */}
            {result?.city_context?.current_edd != null && (
              <CitizenPolicyPanel
                net_edd={result.city_context.current_edd}
              />
            )}
          </motion.div>
        )}

        {tab === 1 && !result && (
          <div className="glass p-16 text-center text-textMuted" style={{ fontFamily: 'Poppins' }}>
            Enter pollutant values and run analysis first.
          </div>
        )}

        {/* ── Tab 2: City Profile ── */}
        {tab === 2 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {cityData ? (
              <div className="space-y-6">
                {/* Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'EHS Score', value: cityData.ehs, color: '#2ECC71' },
                    { label: 'Net EDD',   value: cityData.net_edd?.toFixed(3), color: '#00D1FF' },
                    { label: 'CRF Score', value: cityData.crf_score, color: '#00C9A7' },
                    { label: 'Recovery',  value: `${cityData.t_payoff_years}y`, color: '#F1C40F' },
                  ].map((item, i) => (
                    <motion.div key={item.label}
                      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="glass p-4 text-center"
                      style={{ boxShadow: `0 0 15px ${item.color}18` }}>
                      <p className="text-textMuted text-xs mb-2" style={{ fontFamily: 'Poppins', textTransform: 'uppercase' }}>
                        {item.label}
                      </p>
                      <p style={{ fontFamily: 'Orbitron', color: item.color, fontSize: '1.5rem', fontWeight: 700 }}>
                        {item.value}
                      </p>
                    </motion.div>
                  ))}
                </div>

                {/* EDD Chart */}
                <div className="glass p-6">
                  <h3 className="mb-4" style={{ fontFamily: 'Poppins', color: '#00D1FF', fontWeight: 600 }}>
                    📈 Ecological Debt History — {selectedCity}
                  </h3>
                  <EddChart yearlyData={cityData.yearly_data} forecasts={cityData.forecasts} height={300} />
                </div>

                {/* Plain English */}
                <div className="glass p-6" style={{ border: '1px solid rgba(46,204,113,0.2)' }}>
                  <h3 className="mb-3" style={{ fontFamily: 'Poppins', color: '#2ECC71', fontWeight: 600 }}>
                    🌍 What does this mean?
                  </h3>
                  <p style={{ fontFamily: 'Inter', color: '#EAEAEA', lineHeight: 1.8, fontSize: '0.95rem' }}>
                    <strong style={{ color: cityData.tier_color }}>{selectedCity}</strong> currently has an
                    Environmental Health Score of <strong style={{ color: '#2ECC71' }}>{cityData.ehs}/100</strong>
                    , placing it in the <strong style={{ color: cityData.tier_color }}>{cityData.tier}</strong> tier.
                    The city has accumulated an ecological debt of{' '}
                    <strong style={{ color: '#00D1FF' }}>{cityData.net_edd?.toFixed(3)} EDD units</strong>.
                    At the current recovery rate, it will take approximately{' '}
                    <strong style={{ color: '#F1C40F' }}>{cityData.t_payoff_years} years</strong> to
                    return to a safe environmental baseline.
                    The trend is currently{' '}
                    <strong style={{ color: cityData.trend==='improving' ? '#2ECC71' : '#E74C3C' }}>
                      {cityData.trend}
                    </strong>.
                  </p>
                </div>

                {/* Pollutant contributions */}
                {cityData.pollutant_contrib?.length > 0 && (
                  <div className="glass p-6">
                    <h3 className="mb-4" style={{ fontFamily: 'Poppins', color: '#FF9F43', fontWeight: 600 }}>
                      🔬 Pollutant Contribution Breakdown
                    </h3>
                    <div className="space-y-3">
                      {cityData.pollutant_contrib.map(p => (
                        <div key={p.pollutant}>
                          <div className="flex justify-between mb-1">
                            <span style={{ fontFamily: 'Poppins', color: '#EAEAEA', fontSize: '0.9rem' }}>
                              {p.pollutant}
                            </span>
                            <span style={{ fontFamily: 'Orbitron', color: '#FF9F43', fontSize: '0.85rem' }}>
                              {p.contribution_pct}%
                            </span>
                          </div>
                          <div className="h-2 rounded-full" style={{ background: '#1E3A34' }}>
                            <motion.div className="h-2 rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${p.contribution_pct}%` }}
                              transition={{ duration: 0.8 }}
                              style={{ background: 'linear-gradient(90deg, #FF9F43, #E74C3C)' }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Policy Recommendations — inside cityData block so net_edd is guaranteed */}
                <CitizenPolicyPanel net_edd={cityData.net_edd} />
              </div>
            ) : (
              <div className="glass p-16 text-center text-textMuted" style={{ fontFamily: 'Poppins' }}>
                Select a city to view its ecological profile.
              </div>
            )}
          </motion.div>
        )}

        {/* ── Tab 3: Personal Exposure ── */}
        {tab === 3 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto">
            <div className="glass p-8">
              <h3 className="mb-2" style={{ fontFamily: 'Orbitron', color: '#00C9A7', fontSize: '1rem' }}>
                👤 Personal Ecological Exposure Estimator
              </h3>
              <p className="text-textMuted text-sm mb-6" style={{ fontFamily: 'Inter' }}>
                How much ecological debt have you personally lived through?
              </p>

              <div className="mb-5">
                <label className="text-textMuted text-xs uppercase tracking-widest mb-2 block"
                       style={{ fontFamily: 'Poppins' }}>
                  Years lived in {selectedCity || 'your city'}: <span style={{ color: '#2ECC71' }}>{yearsLived}</span>
                </label>
                <input type="range" min={1} max={30} value={yearsLived}
                  onChange={e => setYearsLived(Number(e.target.value))}
                  className="w-full" style={{ accentColor: '#00C9A7' }} />
                <div className="flex justify-between text-textDim text-xs mt-1">
                  <span>1 year</span><span>30 years</span>
                </div>
              </div>

              <button onClick={handleExposure} disabled={expLoad || !selectedCity}
                className="btn-primary w-full"
                style={{ opacity: !selectedCity ? 0.5 : 1 }}>
                {expLoad ? '⏳ Calculating...' : !selectedCity ? 'Select a city first' : '📊 Calculate My Exposure'}
              </button>
            </div>

            {exposure && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="mt-6 space-y-4">

                {/* Personal EDD */}
                <div className="glass p-6 text-center"
                  style={{ boxShadow: '0 0 40px rgba(0,201,167,0.15)' }}>
                  <p className="text-textMuted text-sm mb-2" style={{ fontFamily: 'Poppins' }}>
                    Your personal cumulative ecological exposure
                  </p>
                  <p style={{ fontFamily: 'Orbitron', color: '#00C9A7', fontSize: '3rem', fontWeight: 900 }}>
                    {exposure.personal_edd}
                  </p>
                  <p className="text-textDim text-xs mt-1" style={{ fontFamily: 'Inter' }}>EDD units</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="glass p-5 text-center">
                    <p className="text-textMuted text-xs mb-2" style={{ fontFamily: 'Poppins' }}>
                      Equivalent Bad Air Days
                    </p>
                    <p style={{ fontFamily: 'Orbitron', color: '#FF9F43', fontSize: '1.8rem', fontWeight: 700 }}>
                      {exposure.equivalent_bad_air_days}
                    </p>
                    <p className="text-textDim text-xs mt-1">days above safe threshold</p>
                  </div>
                  <div className="glass p-5 text-center">
                    <p className="text-textMuted text-xs mb-2" style={{ fontFamily: 'Poppins' }}>
                      Cigarette Equivalent
                    </p>
                    <p style={{ fontFamily: 'Orbitron', color: '#E74C3C', fontSize: '1.8rem', fontWeight: 700 }}>
                      {exposure.cigarette_equiv_total}
                    </p>
                    <p className="text-textDim text-xs mt-1">total cigarettes equivalent</p>
                  </div>
                </div>

                <div className="glass p-5"
                  style={{ border: '1px solid rgba(0,201,167,0.25)', background: 'rgba(0,201,167,0.05)' }}>
                  <p style={{ fontFamily: 'Poppins', color: '#00C9A7', lineHeight: 1.7 }}>
                    💬 {exposure.health_message}
                  </p>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
