// src/components/shared/EddChart.jsx
import {
  ResponsiveContainer, ComposedChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass p-3 text-sm" style={{ fontFamily: 'Inter' }}>
      <p className="text-primary font-semibold mb-1">Year {label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: <span className="font-bold">{Number(p.value).toFixed(4)}</span>
        </p>
      ))}
    </div>
  );
};

export default function EddChart({ yearlyData = [], forecasts = [], height = 280 }) {
  const combined = [
    ...yearlyData.map(d => ({
      year       : d.Year,
      edd        : d.EDD_net_cumulative,
      edd_yearly : d.EDD_net_annual,
    })),
    ...forecasts.map(d => ({
      year    : d.Year,
      forecast: d.EDD_forecast,
    })),
  ].sort((a, b) => a.year - b.year);

  const lastHistorical = yearlyData.length
    ? yearlyData[yearlyData.length - 1].Year
    : null;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={combined} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(46,204,113,0.1)" />
        <XAxis dataKey="year" stroke="#6B7A76" tick={{ fontFamily: 'Inter', fontSize: 11 }} />
        <YAxis stroke="#6B7A76" tick={{ fontFamily: 'Inter', fontSize: 11 }} width={50} />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontFamily: 'Inter', fontSize: 12, color: '#A7B3AF' }}
        />
        {lastHistorical && (
          <ReferenceLine x={lastHistorical} stroke="rgba(46,204,113,0.4)"
            strokeDasharray="4 4" label={{ value: 'Now', fill: '#2ECC71', fontSize: 11 }} />
        )}
        <Line
          type="monotone" dataKey="edd" name="Cumulative EDD"
          stroke="#00D1FF" strokeWidth={2.5} dot={false}
          activeDot={{ r: 5, fill: '#00D1FF' }}
        />
        <Line
          type="monotone" dataKey="edd_yearly" name="Annual EDD"
          stroke="#2ECC71" strokeWidth={1.5} dot={false} strokeDasharray="0"
        />
        <Line
          type="monotone" dataKey="forecast" name="Forecast"
          stroke="#F1C40F" strokeWidth={2} dot={false} strokeDasharray="6 3"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
