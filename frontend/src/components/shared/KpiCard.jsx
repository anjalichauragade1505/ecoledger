// src/components/shared/KpiCard.jsx
import { motion } from 'framer-motion';

export default function KpiCard({ label, value, unit, icon, color = '#2ECC71', delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="glass p-5 flex flex-col gap-2"
      style={{ boxShadow: `0 0 20px ${color}22` }}
    >
      <div className="flex items-center justify-between">
        <span className="text-textMuted text-xs font-medium uppercase tracking-widest" style={{ fontFamily: 'Poppins' }}>
          {label}
        </span>
        {icon && <span className="text-xl">{icon}</span>}
      </div>
      <div className="flex items-end gap-1">
        <span className="text-3xl font-bold" style={{ color, fontFamily: 'Orbitron' }}>
          {value ?? '—'}
        </span>
        {unit && <span className="text-textMuted text-sm mb-1">{unit}</span>}
      </div>
    </motion.div>
  );
}
