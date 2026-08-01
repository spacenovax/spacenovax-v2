// Orbit V21 — Current Position card, always visible in the left column.
import React from 'react';

export default function OrbitCurrentPosition({ t, current, currentPlace, heading, accuracy, satelliteCount, compassLabel, onMyLocation }) {
  if (!current) return null;
  return (
    <div className="ov20-card">
      <div className="ov20-card-label">{t.currentPosition}</div>
      <h4>{currentPlace?.country || '—'}</h4>
      <div className="ov20-row"><span>{t.ko ? '도시' : 'CITY'}</span><b>{currentPlace?.city || '—'}</b></div>
      <div className="ov20-row"><span>LAT</span><b>{current.lat.toFixed(4)}°</b></div>
      <div className="ov20-row"><span>LON</span><b>{current.lon.toFixed(4)}°</b></div>
      <div className="ov20-row"><span>{t.altitude}</span><b>{current.altitude ? `${Math.round(current.altitude)}m` : '—'}</b></div>
      <div className="ov20-row"><span>{t.accuracy}</span><b>{accuracy ? `${Math.round(accuracy)}m` : '—'}</b></div>
      <button className="ov20-btn" onClick={onMyLocation}>⊕ {t.myLocation}</button>
    </div>
  );
}
