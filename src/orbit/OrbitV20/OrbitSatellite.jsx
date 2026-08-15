// Orbit V21 — Satellite tracking summary, always visible in the left column.
import React from 'react';

function compactName(name) {
  return String(name || 'SATELLITE').replace(/^ISS \(ZARYA\)$/i, 'ISS').slice(0, 18);
}

export default function OrbitSatellite({ t, issTracked, otherTracked, issPosition, satellites = [], satelliteLayer = {}, onToggleSatelliteLayer }) {
  const bars = [3, 5, 4, 6, 5, 7, 6, 8];
  const layerOn = Boolean(satelliteLayer.enabled);
  const layerStatus = satelliteLayer.status || 'idle';
  const observationLabel = layerStatus === 'loading'
    ? (t.ko ? 'NASA GIBS 관측 화면을 불러오는 중…' : 'LOADING NASA GIBS OBSERVATION…')
    : layerStatus === 'error'
      ? (t.ko ? '위성 자료 연결이 지연되어 기본 지구본을 유지합니다.' : 'SATELLITE SOURCE DELAYED · BASE GLOBE ACTIVE')
      : layerOn
        ? `NASA GIBS · MODIS TERRA · ${satelliteLayer.date || 'UTC'}`
        : (t.ko ? 'NASA GIBS · 최신 관측 화면 선택 가능' : 'NASA GIBS · LATEST OBSERVATION AVAILABLE');
  return (
    <div className="ov20-card ov20-satellite-card">
      <div className="ov20-card-label">◌ {t.satellitesTitle}</div>
      <div className="ov20-sat-row ov20-iss-row"><span className="name">ISS · {issTracked ? 'LIVE' : 'OFFLINE'}</span><span className="count">{issPosition ? `${Math.round(issPosition.altKm)} km` : '—'}</span></div>
      {issPosition && <div className="ov20-sat-meta">{Math.round(issPosition.velKmh).toLocaleString()} km/h</div>}
      {satellites.slice(0, 3).map((satellite) => <div className="ov20-sat-row" key={satellite.id}><span className="name">{compactName(satellite.name)}</span><span className="count">{Math.round(satellite.altKm)}k</span></div>)}
      <div className="ov20-sat-row"><span className="name">{t.tracked}</span><span className="count">{otherTracked}</span></div>
      <div className={`ov20-satellite-layer ${layerOn ? 'active' : ''}`}>
        <span>◉ {t.ko ? 'NASA 기상위성' : 'NASA SATELLITE'}</span>
        <small>{observationLabel}</small>
        <button type="button" className="ov20-btn primary" onClick={onToggleSatelliteLayer} disabled={layerStatus === 'loading'}>
          {layerStatus === 'loading'
            ? (t.ko ? '관측 자료 연결 중…' : 'CONNECTING…')
            : layerOn
              ? (t.ko ? '기본 지구본으로 전환' : 'RETURN TO BASE GLOBE')
              : (t.ko ? 'NASA 위성 관측 보기' : 'VIEW NASA SATELLITE')}
        </button>
      </div>
      <div className="ov20-signal">{bars.map((h, i) => <i key={i} style={{ height: `${h * 2}px` }} />)}</div>
    </div>
  );
}
