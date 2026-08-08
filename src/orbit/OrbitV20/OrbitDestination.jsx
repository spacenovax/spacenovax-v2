// Orbit V21 — Destination search + route summary + Captain Base, always visible in the
// right column. Geocoding/FlyTo/Arc Route logic stays in OrbitV20.jsx / the engines.
import React from 'react';

export default function OrbitDestination({
  t, current, destination, searchQuery, searchResults, distanceKm, etaHours, courseDeg,
  compassLabel, base, onOpenSearch, onPick, onAddFavorite, onClearRoute, onSaveHome, onSaveWork,
}) {
  return (
    <div className="ov20-card">
      <div className="ov20-card-label">{t.destination}</div>
      {!destination ? (
        <button className="ov20-search-launch" onClick={onOpenSearch}><span>⌕</span><b>{t.findDestination}</b></button>
      ) : current ? (
        <>
          <div className="ov20-dest-selected">
            <div><b>{destination.country || destination.label.split(',').pop()}</b><small>{destination.label.split(',')[0]}</small></div>
            <button className="ov20-fav-star" onClick={onAddFavorite}>★</button>
          </div>
          <div className="ov20-row"><span>{t.distance}</span><b>{Math.round(distanceKm).toLocaleString()}km</b></div>
          <div className="ov20-row"><span>ETA</span><b>{etaHours < 1 ? `${Math.round(etaHours * 60)}m` : `${Math.floor(etaHours)}h${Math.round((etaHours % 1) * 60)}m`}</b></div>
          <div className="ov20-row"><span>{t.course}</span><b>{courseDeg.toFixed(0)}° {compassLabel(courseDeg)}</b></div>
          <button className="ov20-btn primary" onClick={onClearRoute}>✕ {t.ko ? '취소' : 'Clear'}</button>
          <button className="ov20-btn" onClick={onOpenSearch}>⌕ {t.changeDestination}</button>
        </>
      ) : null}
      <div className="ov20-status-grid">
        <div><small>HOME</small><b>{base.home ? '✓' : t.notSet}</b></div>
        <div><small>WORK</small><b>{base.work ? '✓' : t.notSet}</b></div>
      </div>
      {!base.home && <button className="ov20-btn" onClick={onSaveHome}>{t.setHome}</button>}
      {!base.work && <button className="ov20-btn" onClick={onSaveWork}>{t.setWork}</button>}
    </div>
  );
}
