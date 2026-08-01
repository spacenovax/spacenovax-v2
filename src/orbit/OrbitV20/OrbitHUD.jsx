// DEPRECATED as of V21 FINAL — the Final Design Specification abolished the Bottom
// Sheet pattern entirely: Left/Right HUD panels are now always visible (see
// OrbitLeftPanel.jsx / OrbitRightPanel.jsx, composed directly in OrbitV20.jsx). This
// file is no longer imported anywhere. Kept on disk rather than deleted, since no
// explicit delete instruction was given.
//
// Orbit V20 — Slim HUD: always-visible collapsed summary chips (Position/Weather/
// Satellite/Search). Tapping a chip opens its full detail sheet via OrbitNavigation.
// This is what keeps "Navigation 기능이 항상 접근 가능" true even in the default view.
import React from 'react';

export default function OrbitHUD({ t, current, currentPlace, weather, satelliteCount, destination, distanceKm, onOpen }) {
  return (
    <div className="ov20-slim-hud">
      <button className="ov20-slim-chip" onClick={() => onOpen('satellite')}>
        <span className="ico">📍</span><span className="val">{currentPlace?.city || (current ? `${current.lat.toFixed(2)}°` : '—')}</span>
      </button>
      <button className="ov20-slim-chip" onClick={() => onOpen('weather')}>
        <span className="ico">{weather ? (weather.cloud_cover > 50 ? '⛅' : '☀️') : '☁'}</span><span className="val">{weather ? `${Math.round(weather.temperature_2m)}°` : '—'}</span>
      </button>
      <button className="ov20-slim-chip" onClick={() => onOpen('satellite')}>
        <span className="ico">🛰</span><span className="val">{satelliteCount}</span>
      </button>
      <button className="ov20-slim-chip" onClick={() => onOpen('base')}>
        <span className="ico">🎯</span><span className="val">{destination ? `${Math.round(distanceKm).toLocaleString()}km` : (t.ko ? '검색' : 'Search')}</span>
      </button>
    </div>
  );
}
