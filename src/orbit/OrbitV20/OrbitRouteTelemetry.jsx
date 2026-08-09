import React from 'react';

function formatEta(hours, ko) {
  if (hours == null) return '—';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}${ko ? '분' : 'm'}`;
  return `${Math.floor(hours)}${ko ? '시간' : 'h'} ${Math.round((hours % 1) * 60)}${ko ? '분' : 'm'}`;
}

// A compact route readout for the 3D Earth. It deliberately reports an estimate rather
// than claiming turn-by-turn transport guidance: this is a global/orbital visualisation.
export default function OrbitRouteTelemetry({ t, current, currentPlace, destination, distanceKm, etaHours, courseDeg, compassLabel, navigationActive, hasArrived, routeStatus, nextStep, onSearch, onStartNavigation, onStopNavigation }) {
  const hasRoute = Boolean(current && destination && distanceKm != null);
  const from = currentPlace?.city || currentPlace?.country || (t.ko ? '현재 위치' : 'Current position');
  const to = destination?.label?.split(',')[0] || (t.ko ? '목적지를 선택하세요' : 'Select a destination');

  return (
    <section className={`ov20-route-telemetry ${hasRoute ? 'has-route' : ''}`} aria-label="Orbit route telemetry">
      <div className="ov20-route-head">
        <span className="ov20-route-icon">⌁</span>
        <div><small>{hasArrived ? t.arrived : navigationActive ? t.liveGuidance : 'NOVA GLOBAL NAVIGATION'}</small><b>{from} <em>→</em> {to}</b></div>
        <button onClick={onSearch}>{hasRoute ? (t.ko ? '경로 변경' : 'CHANGE') : t.findDestination}</button>
      </div>
      {hasRoute && <small className="ov20-route-road-status">{routeStatus === 'loading' ? (t.ko ? '자동차 도로 경로 계산 중…' : 'CALCULATING DRIVING ROUTE…') : routeStatus === 'ready' ? `${t.ko ? '자동차 경로' : 'DRIVING ROUTE'}${nextStep?.name ? ` · ${nextStep.name}` : ''}` : (t.ko ? '도로 경로를 불러오지 못했습니다. 직선 거리만 표시합니다.' : 'Driving route unavailable. Showing direct distance.')}</small>}
      <div className="ov20-route-metrics">
        <div><small>{t.distance}</small><b>{hasRoute ? `${Math.round(distanceKm).toLocaleString()} km` : '—'}</b></div>
        <div><small>{t.eta}</small><b>{formatEta(etaHours, t.ko)}</b></div>
        <div className="ov20-route-course"><small>{t.course}</small><b>{hasRoute ? `${compassLabel(courseDeg)} ${Math.round(courseDeg)}°` : '—'}</b></div>
      </div>
      {hasRoute && !hasArrived && <button className={`ov20-route-guidance-btn ${navigationActive ? 'active' : ''}`} onClick={navigationActive ? onStopNavigation : onStartNavigation}>
        {navigationActive ? `■ ${t.endNavigation}` : `▶ ${t.startNavigation}`}
      </button>}
    </section>
  );
}
