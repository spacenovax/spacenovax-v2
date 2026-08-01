// Orbit V21 — Earth Events card, always visible in the right column.
import React from 'react';

export default function OrbitEvents({ t, counts, topEvents }) {
  return (
    <div className="ov20-card">
      <div className="ov20-card-label">{t.earthEvents}</div>
      <div className="ov20-ev-row"><span className="dot" style={{ background: 'var(--ov20-red)' }} /><div className="name">{t.typhoon}<small>{counts.typhoon}</small></div></div>
      <div className="ov20-ev-row"><span className="dot" style={{ background: 'var(--ov20-amber)' }} /><div className="name">{t.quake}<small>{counts.quake}</small></div></div>
      <div className="ov20-ev-row"><span className="dot" style={{ background: 'transparent', border: '1px solid var(--ov20-amber)' }} /><div className="name">{t.volcano}<small>{counts.volcano}</small></div></div>
      <div className="ov20-ev-row"><span className="dot" style={{ background: 'var(--ov20-amber)' }} /><div className="name">{t.wildfire}<small>{counts.wildfire}</small></div></div>
    </div>
  );
}
