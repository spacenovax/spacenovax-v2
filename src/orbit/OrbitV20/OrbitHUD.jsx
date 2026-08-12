// Mobile navigation HUD. Detailed telemetry stays one tap away without covering Earth.
import React from 'react';

export default function OrbitHUD({ t, current, currentPlace, weather, satelliteCount, destination, distanceKm, activePanel, onOpen }) {
  const open = (panel) => onOpen(activePanel === panel ? null : panel);
  return (
    <nav className="ov20-slim-hud" aria-label={t.ko ? '네비게이션 HUD' : 'Navigation HUD'}>
      <button className={`ov20-slim-chip ${activePanel === 'position' ? 'active' : ''}`} onClick={() => open('position')}>
        <span className="ico">📍</span><span className="val">{currentPlace?.city || (current ? `${current.lat.toFixed(2)}°` : '—')}</span>
      </button>
      <button className={`ov20-slim-chip ${activePanel === 'weather' ? 'active' : ''}`} onClick={() => open('weather')}>
        <span className="ico">{weather ? (weather.cloud_cover > 50 ? '⛅' : '☀️') : '☁'}</span><span className="val">{weather ? `${Math.round(weather.temperature_2m)}°` : '—'}</span>
      </button>
      <button className={`ov20-slim-chip ${activePanel === 'satellite' ? 'active' : ''}`} onClick={() => open('satellite')}>
        <span className="ico">🛰</span><span className="val">{satelliteCount}</span>
      </button>
      <button className={`ov20-slim-chip ${activePanel === 'destination' ? 'active' : ''}`} onClick={() => open('destination')}>
        <span className="ico">🎯</span><span className="val">{destination && Number.isFinite(distanceKm) ? `${Math.round(distanceKm).toLocaleString()}km` : (t.ko ? '목적지' : 'Target')}</span>
      </button>
      <button className={`ov20-slim-chip ${activePanel === 'events' ? 'active' : ''}`} onClick={() => open('events')}>
        <span className="ico">◉</span><span className="val">{t.ko ? '이벤트' : 'Events'}</span>
      </button>
    </nav>
  );
}
