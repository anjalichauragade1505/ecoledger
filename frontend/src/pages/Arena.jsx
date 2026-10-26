// src/pages/Arena.jsx
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import Navbar    from '../components/shared/Navbar';
import TierBadge from '../components/shared/TierBadge';
import EddChart  from '../components/shared/EddChart';
import { getLeaderboard, getPublicCities, getHeadToHead } from '../utils/api';

const CRF_LABELS = { B: 'Biotic', V: 'Vegetation', A: 'Abiotic', W: 'Water', S: 'Soil' };
const TABS       = ['🏆 Leaderboard', '⚔️ Head to Head', '🏁 Recovery Race', '🌦️ Seasonal'];

export default function Arena() {
  const [tab,       setTab]       = useState(0);
  const [board,     setBoard]     = useState([]);
  const [cities,    setCities]    = useState([]);
  const [cityA,     setCityA]     = useState('');
  const [cityB,     setCityB]     = useState('');
  const [h2h,       setH2h]       = useState(null);
  const [h2hLoad,   setH2hLoad]   = useState(false);
  const [seasonal,  setSeasonal]  = useState('All');
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([getLeaderboard(), getPublicCities()])
      .then(([lb, ct]) => {
        setBoard(lb.data.leaderboard);
        setCities(ct.data.cities);
        setLoading(false);
      });
  }, []);

  const fetchH2H = async () => {
    if (!cityA || !cityB || cityA === cityB) return;
    setH2hLoad(true);
    try {
      const r = await getHeadToHead(cityA, cityB);
      setH2h(r.data);
    } finally { setH2hLoad(false); }
  };

  const SEASONS = ['Winter', 'Summer', 'Monsoon', 'Post-Monsoon'];

  return (
    <div className="min-h-screen" style={{ background: '#07130F' }}>
      <Navbar />
      <div className="pt-24 px-6 max-w-7xl mx-auto pb-16">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8 text-center">
          <h1 style={{ fontFamily: 'Orbitron', fontSize: '2rem', fontWeight: 900, letterSpacing: 4 }}>
            <span style={{ color: '#E74C3C' }}>CITY</span>{' '}
            <span style={{ color: '#EAEAEA' }}>BATTLE</span>{' '}
            <span style={{ color: '#2ECC71' }}>ARENA</span>
          </h1>
          <p className="text-textMuted mt-2" style={{ fontFamily: 'Poppins' }}>
            Which city carries the least ecological debt? Competition begins here.
          </p>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 justify-center flex-wrap">
          {TABS.map((t, i) => (
            <button key={i} onClick={() => setTab(i)}
              className="px-5 py-2 rounded-xl text-sm transition-all"
              style={{
                background: tab===i ? 'rgba(231,76,60,0.15)' : 'rgba(16,36,29,0.6)',
                border    : `1px solid ${tab===i ? '#E74C3C' : '#1E3A34'}`,
                color     : tab===i ? '#E74C3C' : '#A7B3AF',
                fontFamily: 'Poppins', fontWeight: 500, cursor: 'pointer',
              }}>
              {t}
            </button>
          ))}
        </div>

        {/* ── Tab 0: Leaderboard ── */}
        {tab === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {loading ? (
              <div className="text-center text-textMuted py-20">Loading leaderboard...</div>
            ) : (
              <div className="space-y-3">
                {board.map((city, i) => (
                  <motion.div key={city.city}
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.07 }}
                    className="glass p-5 flex items-center gap-5"
                    style={{ borderLeft: `4px solid ${city.tier_color}` }}
                  >
                    {/* Rank */}
                    <div style={{ fontFamily: 'Orbitron', fontSize: '1.5rem', fontWeight: 900,
                                  color: i<3 ? ['#FFD700','#C0C0C0','#CD7F32'][i] : '#3D5A52',
                                  minWidth: 40, textAlign: 'center' }}>
                      {i < 3 ? ['🥇','🥈','🥉'][i] : `#${i+1}`}
                    </div>

                    {/* City name */}
                    <div className="flex-1">
                      <p style={{ fontFamily: 'Poppins', fontWeight: 700, fontSize: '1rem', color: '#EAEAEA' }}>
                        {city.city}
                      </p>
                      <p className="text-xs text-textMuted mt-0.5" style={{ fontFamily: 'Inter' }}>
                        T-Payoff: {city.t_payoff} years · Net EDD: {city.net_edd?.toFixed(3)}
                      </p>
                    </div>

                    {/* EHS bar */}
                    <div className="hidden md:flex flex-col items-end gap-1" style={{ minWidth: 180 }}>
                      <div className="flex items-center gap-2 w-full">
                        <div className="flex-1 h-3 rounded-full" style={{ background: '#1E3A34' }}>
                          <motion.div className="h-3 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${city.ehs}%` }}
                            transition={{ delay: i * 0.07 + 0.3, duration: 0.8 }}
                            style={{ background: city.tier_color }}
                          />
                        </div>
                        <span style={{ fontFamily: 'Orbitron', fontSize: '0.9rem', color: city.tier_color, minWidth: 40 }}>
                          {city.ehs}
                        </span>
                      </div>
                      <span className="text-xs" style={{ color: '#6B7A76', fontFamily: 'Inter' }}>EHS Score</span>
                    </div>

                    {/* Tier + trend */}
                    <div className="flex flex-col items-end gap-2">
                      <TierBadge tier={city.tier} size="sm" />
                      <span style={{
                        color: city.trend==='improving' ? '#2ECC71' : city.trend==='worsening' ? '#E74C3C' : '#F1C40F',
                        fontSize: '1.2rem'
                      }}>
                        {city.trend==='improving' ? '↗ Improving' : city.trend==='worsening' ? '↘ Worsening' : '→ Stable'}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ── Tab 1: Head to Head ── */}
        {tab === 1 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* City selectors */}
            <div className="glass p-6 mb-6 flex items-center gap-4 flex-wrap justify-center">
              <select value={cityA} onChange={e => setCityA(e.target.value)}
                className="p-3 rounded-xl text-sm outline-none"
                style={{ background: '#0A1814', border: '2px solid #E74C3C',
                         color: '#EAEAEA', fontFamily: 'Poppins', minWidth: 160 }}>
                <option value="">City A</option>
                {cities.filter(c => c !== cityB).map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              <div style={{ fontFamily: 'Orbitron', color: '#F1C40F', fontSize: '1.5rem' }}>VS</div>

              <select value={cityB} onChange={e => setCityB(e.target.value)}
                className="p-3 rounded-xl text-sm outline-none"
                style={{ background: '#0A1814', border: '2px solid #00D1FF',
                         color: '#EAEAEA', fontFamily: 'Poppins', minWidth: 160 }}>
                <option value="">City B</option>
                {cities.filter(c => c !== cityA).map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              <button onClick={fetchH2H} disabled={!cityA || !cityB || h2hLoad}
                className="btn-primary px-8">
                {h2hLoad ? '⏳' : '⚔️ Compare'}
              </button>
            </div>

            {h2h && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* EDD Charts side by side */}
                {[h2h.city_a, h2h.city_b].map((city, ci) => (
                  <div key={ci} className="glass p-5"
                    style={{ borderTop: `3px solid ${ci===0 ? '#E74C3C' : '#00D1FF'}` }}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 style={{ fontFamily: 'Orbitron', color: ci===0 ? '#E74C3C' : '#00D1FF',
                                   fontSize: '1rem' }}>
                        {city.city}
                      </h3>
                      <TierBadge tier={city.tier} size="sm" />
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      {[['EHS',city.ehs,'#2ECC71'],['EDD',city.net_edd?.toFixed(3),'#00D1FF'],
                        ['CRF',city.crf_score,'#00C9A7'],['Payoff',`${city.t_payoff_years}y`,'#F1C40F']
                      ].map(([k,v,c]) => (
                        <div key={k} className="p-2 rounded-lg text-center"
                             style={{ background: 'rgba(10,24,20,0.8)', border: '1px solid #1E3A34' }}>
                          <p className="text-textDim text-xs" style={{ fontFamily: 'Poppins' }}>{k}</p>
                          <p style={{ fontFamily: 'Orbitron', color: c, fontSize: '1rem' }}>{v}</p>
                        </div>
                      ))}
                    </div>
                    <EddChart yearlyData={city.yearly_data} forecasts={city.forecasts} height={200} />
                  </div>
                ))}

                {/* Radar comparison */}
                <div className="md:col-span-2 glass p-6">
                  <h3 className="text-center mb-4" style={{ fontFamily: 'Poppins', color: '#F1C40F' }}>
                    CRF Component Comparison
                  </h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <RadarChart data={Object.keys(h2h.city_a.crf_components || {}).map(k => ({
                      component: CRF_LABELS[k] || k,
                      [h2h.city_a.city]: h2h.city_a.crf_components[k],
                      [h2h.city_b.city]: h2h.city_b.crf_components[k],
                    }))}>
                      <PolarGrid stroke="rgba(46,204,113,0.15)" />
                      <PolarAngleAxis dataKey="component"
                        tick={{ fill: '#A7B3AF', fontSize: 11, fontFamily: 'Inter' }} />
                      <Radar name={h2h.city_a.city} dataKey={h2h.city_a.city}
                        stroke="#E74C3C" fill="#E74C3C" fillOpacity={0.2} />
                      <Radar name={h2h.city_b.city} dataKey={h2h.city_b.city}
                        stroke="#00D1FF" fill="#00D1FF" fillOpacity={0.2} />
                      <Tooltip contentStyle={{ background: '#10241D', border: '1px solid #1E3A34',
                                               fontFamily: 'Inter', fontSize: 11 }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>

                {/* Verdict */}
                <div className="md:col-span-2 glass p-5 text-center"
                  style={{ border: '1px solid rgba(241,196,15,0.3)',
                           background: 'rgba(241,196,15,0.05)' }}>
                  <p style={{ fontFamily: 'Poppins', color: '#F1C40F', fontSize: '1rem' }}>
                    ⚖️ {h2h.verdict}
                  </p>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ── Tab 2: Recovery Race ── */}
        {tab === 2 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <p className="text-textMuted text-center mb-8" style={{ fontFamily: 'Poppins' }}>
              Cities racing to recover their ecological debt. Lower payoff years = winning.
            </p>
            <div className="glass p-6">
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={[...board].sort((a,b) => a.t_payoff - b.t_payoff)}
                  layout="vertical" margin={{ left: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(46,204,113,0.1)" horizontal={false} />
                  <XAxis type="number" stroke="#6B7A76"
                    tick={{ fontFamily: 'Inter', fontSize: 11 }}
                    label={{ value: 'Recovery Years', position: 'insideBottom', fill: '#6B7A76',
                             fontFamily: 'Inter', fontSize: 11, offset: -5 }} />
                  <YAxis type="category" dataKey="city" stroke="#6B7A76"
                    tick={{ fontFamily: 'Poppins', fontSize: 12, fill: '#EAEAEA' }} />
                  <Tooltip
                    contentStyle={{ background: '#10241D', border: '1px solid #1E3A34',
                                    fontFamily: 'Inter', fontSize: 12 }}
                    formatter={(v, n) => [`${v} years`, 'Recovery Time']}
                  />
                  <Bar dataKey="t_payoff" radius={[0,6,6,0]}
                    fill="url(#raceGrad)" />
                  <defs>
                    <linearGradient id="raceGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%"   stopColor="#2ECC71" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#00D1FF" stopOpacity={0.7} />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Race track visual */}
            <div className="glass p-6 mt-6">
              <h3 className="mb-4 text-center" style={{ fontFamily: 'Orbitron', color: '#00C9A7' }}>
                🏁 Race Track — Recovery Position
              </h3>
              {[...board].sort((a,b) => a.t_payoff - b.t_payoff).map((city, i) => {
                const maxPay = Math.max(...board.map(c => c.t_payoff));
                const pct    = ((maxPay - city.t_payoff) / maxPay) * 100;
                return (
                  <div key={city.city} className="mb-3">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs" style={{ fontFamily: 'Poppins', color: '#EAEAEA' }}>
                        #{i+1} {city.city}
                      </span>
                      <span className="text-xs" style={{ fontFamily: 'Inter', color: '#A7B3AF' }}>
                        {city.t_payoff} yrs to recover
                      </span>
                    </div>
                    <div className="h-6 rounded-full relative overflow-hidden"
                         style={{ background: '#1E3A34' }}>
                      <motion.div
                        className="h-6 rounded-full flex items-center justify-end pr-2"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ delay: i * 0.1, duration: 1, ease: 'easeOut' }}
                        style={{ background: `linear-gradient(90deg, ${city.tier_color}88, ${city.tier_color})` }}
                      >
                        <span style={{ fontSize: '0.7rem', color: '#07130F', fontWeight: 700 }}>🏎️</span>
                      </motion.div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ── Tab 3: Seasonal ── */}
        {tab === 3 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex gap-2 justify-center mb-6 flex-wrap">
              {SEASONS.map(s => (
                <button key={s} onClick={() => setSeasonal(s)}
                  className="px-4 py-2 rounded-xl text-sm transition-all"
                  style={{
                    background: seasonal===s ? 'rgba(0,201,167,0.15)' : 'rgba(16,36,29,0.6)',
                    border    : `1px solid ${seasonal===s ? '#00C9A7' : '#1E3A34'}`,
                    color     : seasonal===s ? '#00C9A7' : '#A7B3AF',
                    fontFamily: 'Poppins', cursor: 'pointer',
                  }}>
                  {s === 'Winter' ? '❄️' : s === 'Summer' ? '☀️' : s === 'Monsoon' ? '🌧️' : '🍂'} {s}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {board.map((city, i) => {
                const seasonData = city.seasonal?.[seasonal] || {};
                return (
                  <motion.div key={city.city}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="glass p-4"
                  >
                    <div className="flex justify-between items-center mb-3">
                      <span style={{ fontFamily: 'Poppins', fontWeight: 600, color: '#EAEAEA' }}>
                        {city.city}
                      </span>
                      <TierBadge tier={city.tier} size="sm" />
                    </div>
                    {Object.entries(seasonData).length > 0 ? (
                      Object.entries(seasonData).map(([p, v]) => (
                        <div key={p} className="flex justify-between text-xs mb-1">
                          <span style={{ color: '#6B7A76', fontFamily: 'Inter' }}>{p}</span>
                          <span style={{ fontFamily: 'Orbitron', color: '#00D1FF', fontSize: '0.75rem' }}>
                            {v}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-textDim text-xs" style={{ fontFamily: 'Inter' }}>
                        No seasonal data available
                      </p>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
