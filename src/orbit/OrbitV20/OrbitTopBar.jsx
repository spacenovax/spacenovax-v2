// Orbit V21 — top HUD: LIVE status badge (always on) + 4 thin tabs that only set a
// highlight (SATELLITE/WEATHER/EVENT/BASE) — panels are always visible now, tabs no
// longer show/hide anything (Bottom Sheet was abolished per the Final Design Spec).
import React from 'react';

const TABS = [
  { id: 'satellite', label: 'SATELLITE' },
  { id: 'weather', label: 'WEATHER' },
  { id: 'event', label: 'EVENT' },
  { id: 'base', label: 'BASE' },
];

export default function OrbitTopBar({ tab, onSelect, t, onSearch }) {
  return (
    <div className="ov20-topbar">
      <div className="ov20-live-badge"><i />LIVE</div>
      <button className="ov20-top-search" onClick={onSearch} aria-label={t.findDestination}>⌕ <span>{t.findDestination}</span></button>
      <div className="ov20-tabs">
        {TABS.map((tb) => (
          <button key={tb.id} className={`ov20-tab ${tab === tb.id ? 'active' : ''}`} onClick={() => onSelect(tb.id)}>{tb.label}</button>
        ))}
      </div>
    </div>
  );
}

export { TABS };
