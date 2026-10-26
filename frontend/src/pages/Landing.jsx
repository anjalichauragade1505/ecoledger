// src/pages/Landing.jsx
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, CircleMarker, Tooltip as MapTooltip } from 'react-leaflet';
import { getLandingSummary } from '../utils/api';
import Navbar from '../components/shared/Navbar';
import 'leaflet/dist/leaflet.css';

function AnimatedCounter({ target, duration = 2500 }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!target) return;
    const start = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress === 1) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return <span>{count.toLocaleString()}</span>;
}

const TIER_COLOR = {
  'Green Lungs' : '#2ECC71',
  'Caution Zone': '#F1C40F',
  'Debt Ridden' : '#FF9F43',
  'Critical'    : '#E74C3C',
};

export default function Landing() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    getLandingSummary()
      .then(r => setSummary(r.data))
      .catch(() => setSummary({ total_edd: 0, city_count: 0, city_points: [] }))
      .finally(() => setLoading(false));
  }, []);

  const particles = Array.from({ length: 30 }, (_, i) => i);

  return (
    <div className="min-h-screen grid-bg relative overflow-hidden" style={{ background: '#07130F' }}>
      <Navbar />

      {/* Floating particles */}
      {particles.map(i => (
        <motion.div key={i}
          className="absolute rounded-full pointer-events-none"
          style={{
            width : Math.random() * 4 + 2,
            height: Math.random() * 4 + 2,
            background: i % 3 === 0 ? '#2ECC71' : i % 3 === 1 ? '#00D1FF' : '#00C9A7',
            left  : `${Math.random() * 100}%`,
            top   : `${Math.random() * 100}%`,
            opacity: 0.3,
          }}
          animate={{
            y    : [0, -30, 0],
            opacity: [0.3, 0.7, 0.3],
          }}
          transition={{
            duration: 4 + Math.random() * 4,
            repeat  : Infinity,
            delay   : Math.random() * 4,
          }}
        />
      ))}

      {/* Main hero */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen pt-20 px-6">

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6 px-4 py-2 rounded-full text-xs font-semibold tracking-widest"
          style={{
            background: 'rgba(46,204,113,0.1)',
            border    : '1px solid rgba(46,204,113,0.3)',
            color     : '#2ECC71',
            fontFamily: 'Orbitron',
          }}
        >
          🌍 DATA-DRIVEN SUSTAINABILITY INTELLIGENCE
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          style={{ fontFamily: 'Orbitron', fontWeight: 900, letterSpacing: 4, textAlign: 'center' }}
          className="text-5xl md:text-7xl mb-4"
        >
          <span style={{ color: '#2ECC71' }}>ECO</span>
          <span style={{ color: '#EAEAEA' }}>LEDGER</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-textMuted text-lg text-center max-w-xl mb-10"
          style={{ fontFamily: 'Poppins' }}
        >
          Monitoring Today. Recovering Tomorrow.
          <br />
          <span className="text-sm">
            Tracking the cumulative Ecological Damage Debt of India's cities.
          </span>
        </motion.p>

        {/* Live EDD counter */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8 }}
          className="glass p-6 mb-10 text-center"
          style={{ boxShadow: '0 0 40px rgba(46,204,113,0.2)', minWidth: 340 }}
        >
          <p className="text-textMuted text-xs tracking-widest uppercase mb-2"
             style={{ fontFamily: 'Poppins' }}>
            Total Ecological Debt — {summary?.city_count || 0} Cities
          </p>
          <div style={{ fontFamily: 'Orbitron', fontSize: '2.8rem', fontWeight: 900, color: '#2ECC71' }}
               className="animate-glow-pulse">
            {loading ? '——' : <AnimatedCounter target={Math.round((summary?.total_edd || 0) * 10000)} />}
          </div>
          <p className="text-textDim text-xs mt-1">EDD Units accumulated</p>
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
          className="flex gap-4 flex-wrap justify-center mb-16"
        >
          <button onClick={() => navigate('/admin-login')} className="btn-primary text-base px-8 py-3 flex items-center gap-2">
            🏛️ Admin Portal
          </button>
          <button
            onClick={() => navigate('/citizen')}
            className="px-8 py-3 rounded-xl text-base font-semibold transition-all flex items-center gap-2"
            style={{
              background: 'transparent',
              border    : '2px solid #00C9A7',
              color     : '#00C9A7',
              fontFamily: 'Poppins',
            }}
            onMouseEnter={e => { e.target.style.background = 'rgba(0,201,167,0.1)'; }}
            onMouseLeave={e => { e.target.style.background = 'transparent'; }}
          >
            👤 Citizen Dashboard
          </button>
          <button
            onClick={() => navigate('/arena')}
            className="px-8 py-3 rounded-xl text-base font-semibold transition-all flex items-center gap-2"
            style={{
              background: 'transparent',
              border    : '2px solid #00D1FF',
              color     : '#00D1FF',
              fontFamily: 'Poppins',
            }}
            onMouseEnter={e => { e.target.style.background = 'rgba(0,209,255,0.1)'; }}
            onMouseLeave={e => { e.target.style.background = 'transparent'; }}
          >
            ⚔️ City Battle Arena
          </button>
        </motion.div>

        {/* India Map */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="w-full max-w-4xl glass overflow-hidden"
          style={{ height: 420, boxShadow: '0 0 60px rgba(46,204,113,0.15)' }}
        >
          <MapContainer
            center={[22.5, 82.5]} zoom={5}
            style={{ height: '100%', width: '100%', background: '#07130F' }}
            zoomControl={false} attributionControl={false}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            {(summary?.city_points || []).map((city, i) => (
              <CircleMarker key={i}
                center={[city.lat, city.lng]}
                radius={6 + (100 - Math.min(city.ehs, 99)) / 25}
                pathOptions={{
                  fillColor  : TIER_COLOR[city.tier] || '#2ECC71',
                  fillOpacity: 0.75,
                  color      : TIER_COLOR[city.tier] || '#2ECC71',
                  weight     : 2,
                }}
              >
                <MapTooltip permanent={false}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 12 }}>
                    <strong>{city.city}</strong><br />
                    EHS: {city.ehs} | {city.tier}
                  </div>
                </MapTooltip>
              </CircleMarker>
            ))}
          </MapContainer>
        </motion.div>

        {/* Feature pills */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="flex flex-wrap gap-3 justify-center mt-10 pb-16"
        >
          {[
            '📊 Ecological Damage Debt',
            '🔬 Live Pollutant Analysis',
            '🏆 City Battle Arena',
            '🔮 Forecast Projections',
            '♻️ CRF Recovery Simulator',
            '📄 PDF Export Reports',
          ].map((f, i) => (
            <span key={i} className="px-4 py-2 rounded-full text-xs"
              style={{
                background: 'rgba(46,204,113,0.07)',
                border    : '1px solid rgba(46,204,113,0.2)',
                color     : '#A7B3AF',
                fontFamily: 'Poppins',
              }}>
              {f}
            </span>
          ))}
        </motion.div>
      </div>
    </div>
  );
}