// Orbit V21 — Satellite tracking summary, always visible in the left column.
import React from 'react';

export default function OrbitSatellite({ t, issTracked, otherTracked }) {
  const bars = [3, 5, 4, 6, 5, 7, 6, 8];
  return (
    <div className="ov20-card">
      <div className="ov20-card-label">{t.satellitesTitle}</div>
      <div className="ov20-sat-row"><span className="name">ISS</span><span className="count">{issTracked}</span></div>
      <div className="ov20-sat-row"><span className="name">{t.tracked}</span><span className="count">{otherTracked}</span></div>
      <div className="ov20-signal">{bars.map((h, i) => <i key={i} style={{ height: `${h * 2}px` }} />)}</div>
    </div>
  );
}
