import React from 'react';

function formatEta(hours, ko) {
  if (hours == null) return '—';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}${ko ? '분' : 'm'}`;
  return `${Math.floor(hours)}${ko ? '시간' : 'h'} ${Math.round((hours % 1) * 60)}${ko ? '분' : 'm'}`;
}

// A compact route readout for the 3D Earth. It deliberately reports an estimate rather
// than claiming turn-by-turn transport guidance: this is a global/orbital visualisation.
export default function OrbitRouteTelemetry({ t, current, currentPlace, destination, distanceKm, etaHours, courseDeg, compassLabel, onSearch }) {
  const hasRoute = Boolean(current && destination && distanceKm != null);
  const from = currentPlace?.city || currentPlace?.country || (t.ko ? '현재 위치' : 'Current position');
  const to = destination?.label?.split(',')[0] || (t.ko ? '목적지를 선택하세요' : 'Select a destination');

  return (
    <section className={`ov20-route-telemetry ${hasRoute ? 'has-route' : ''}`} aria-label="Orbit route telemetry">
      <div className="ov20-route-head">
        <span className="ov20-route-icon">⌁</span>
        <div><small>{t.ko ? 'NOVA GLOBAL NAVIGATION' : 'NOVA GLOBAL NAVIGATION'}</small><b>{from} <em>→</em> {to}</b></div>
        <button onClick={onSearch}>{hasRoute ? (t.ko ? '경로 변경' : 'CHANGE') : t.findDestination}</button>
      </div>
      <div className="ov20-route-metrics">
        <div><small>{t.distance}</small><b>{hasRoute ? `${Math.round(distanceKm).toLocaleString()} km` : '—'}</b></div>
        <div><small>{t.eta}</small><b>{formatEta(etaHours, t.ko)}</b></div>
        <div className="ov20-route-course"><small>{t.course}</small><b>{hasRoute ? `${compassLabel(courseDeg)} ${Math.round(courseDeg)}°` : '—'}</b></div>
      </div>
    </section>
  );
}
