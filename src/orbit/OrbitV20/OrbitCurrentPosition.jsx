// Orbit V21 — Current Position card, always visible in the left column.
import React from 'react';

export default function OrbitCurrentPosition({ t, current, currentPlace, heading, accuracy, gpsState, satelliteCount, compassLabel, onMyLocation }) {
  if (!current) return null;
  const gpsLabel = gpsState === 'live' ? t.gpsLive : gpsState === 'locating' ? t.gpsLocating : t.gpsUnavailable;
  const isLive = gpsState === 'live';
  return (
    <div className="ov20-card ov20-current-card">
      <div className="ov20-card-label ov20-position-label"><span>⌖ {t.currentPosition}</span><i className={gpsState === 'live' ? 'live' : ''}>{gpsLabel}</i></div>
      <h4>{isLive ? (currentPlace?.country || '—') : (t.ko ? '위치 권한을 허용해 주세요' : 'Allow location access')}</h4>
      <div className="ov20-row"><span>{t.ko ? '도시' : 'CITY'}</span><b>{isLive ? (currentPlace?.city || '—') : '—'}</b></div>
      <div className="ov20-row"><span>LAT</span><b>{isLive ? `${current.lat.toFixed(4)}°` : '—'}</b></div>
      <div className="ov20-row"><span>LON</span><b>{isLive ? `${current.lon.toFixed(4)}°` : '—'}</b></div>
      <div className="ov20-row"><span>{t.altitude}</span><b>{isLive && current.altitude ? `${Math.round(current.altitude)}m` : '—'}</b></div>
      <div className="ov20-row"><span>{t.accuracy}</span><b>{isLive && accuracy ? `${Math.round(accuracy)}m` : '—'}</b></div>
      <div className="ov20-row"><span>{t.heading}</span><b>{isLive && typeof heading === 'number' ? `${Math.round(heading)}° ${compassLabel(heading)}` : '—'}</b></div>
      <button className="ov20-btn" onClick={onMyLocation}>⊕ {t.myLocation}</button>
    </div>
  );
}
