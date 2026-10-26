// src/components/shared/TierBadge.jsx
const TIER_MAP = {
  'Green Lungs' : { color: '#2ECC71', bg: 'rgba(46,204,113,0.15)',  emoji: '🟢' },
  'Caution Zone': { color: '#F1C40F', bg: 'rgba(241,196,15,0.15)',  emoji: '🟡' },
  'Debt Ridden' : { color: '#FF9F43', bg: 'rgba(255,159,67,0.15)',  emoji: '🟠' },
  'Critical'    : { color: '#E74C3C', bg: 'rgba(231,76,60,0.15)',   emoji: '🔴' },
};

export default function TierBadge({ tier, size = 'md' }) {
  const cfg  = TIER_MAP[tier] || TIER_MAP['Critical'];
  const pad  = size === 'sm' ? '2px 8px' : '4px 14px';
  const fs   = size === 'sm' ? '0.7rem'  : '0.8rem';

  return (
    <span
      style={{
        background  : cfg.bg,
        color       : cfg.color,
        border      : `1px solid ${cfg.color}55`,
        borderRadius: 20,
        padding     : pad,
        fontSize    : fs,
        fontFamily  : 'Poppins',
        fontWeight  : 600,
        whiteSpace  : 'nowrap',
      }}
    >
      {cfg.emoji} {tier}
    </span>
  );
}
