// Orbit V21 — Satellite tracking summary, always visible in the left column.
import React from 'react';

function compactName(name) {
  return String(name || 'SATELLITE').replace(/^ISS \(ZARYA\)$/i, 'ISS').slice(0, 18);
}

export default function OrbitSatellite({ t, issTracked, otherTracked, issPosition, satellites = [] }) {
  const bars = [3, 5, 4, 6, 5, 7, 6, 8];
  return (
    <div className="ov20-card ov20-satellite-card">
      <div className="ov20-card-label">◌ {t.satellitesTitle}</div>
      <div className="ov20-sat-row ov20-iss-row"><span className="name">ISS · {issTracked ? 'LIVE' : 'OFFLINE'}</span><span className="count">{issPosition ? `${Math.round(issPosition.altKm)} km` : '—'}</span></div>
      {issPosition && <div className="ov20-sat-meta">{Math.round(issPosition.velKmh).toLocaleString()} km/h</div>}
      {satellites.slice(0, 3).map((satellite) => <div className="ov20-sat-row" key={satellite.id}><span className="name">{compactName(satellite.name)}</span><span className="count">{Math.round(satellite.altKm)}k</span></div>)}
      <div className="ov20-sat-row"><span className="name">{t.tracked}</span><span className="count">{otherTracked}</span></div>
      <div className="ov20-signal">{bars.map((h, i) => <i key={i} style={{ height: `${h * 2}px` }} />)}</div>
    </div>
  );
}
