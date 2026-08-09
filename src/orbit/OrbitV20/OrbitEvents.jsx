// Orbit V21 — Earth Events card, always visible in the right column.
import React from 'react';

export default function OrbitEvents({ t, counts, topEvents }) {
  const label = (event) => event?.title || (event?.kind === 'typhoon' ? t.typhoon : event?.kind === 'quake' ? t.quake : event?.kind === 'volcano' ? t.volcano : t.wildfire);
  const color = (kind) => kind === 'quake' ? 'var(--ov20-red)' : kind === 'typhoon' ? '#8f73ff' : 'var(--ov20-amber)';
  return (
    <div className="ov20-card ov20-events-card">
      <div className="ov20-card-label">◉ {t.earthEvents}</div>
      {(topEvents || []).length ? topEvents.slice(0, 3).map((event) => <div className="ov20-ev-row" key={event.id}><span className="dot" style={{ background: color(event.kind) }} /><div className="name">{label(event)}<small>{event.kind?.toUpperCase()}</small></div></div>) : <p className="ov20-empty">{t.ko ? '이벤트를 확인 중...' : 'Checking live events…'}</p>}
      <div className="ov20-event-counts"><span>{t.typhoon} {counts.typhoon}</span><span>{t.quake} {counts.quake}</span></div>
    </div>
  );
}
