// Orbit V21 — top HUD: LIVE status badge + quick card launchers. On mobile, each
// label opens its matching telemetry card instead of only changing its underline.
import React from 'react';

const TABS = [
  { id: 'satellite', label: 'SATELLITE' },
  { id: 'weather', label: 'WEATHER' },
  { id: 'event', label: 'EVENT' },
  { id: 'base', label: 'BASE' },
];

export default function OrbitTopBar({ tab, onSelect, t, onSearch, onMiningMap }) {
  return (
    <div className="ov20-topbar">
      <div className="ov20-live-badge"><i />LIVE</div>
      <button type="button" className="ov20-top-search" onClick={onSearch} aria-label={t.findDestination}>⌕ <span>{t.findDestination}</span></button>
      <button type="button" className="ov20-top-mining-map" onClick={onMiningMap} aria-label={t.ko ? 'SPNX 채굴맵 열기' : 'Open SPNX Mining Map'}>
        <span aria-hidden="true">◈</span><b>SPNX</b><em>{t.ko ? '채굴맵' : 'MAP'}</em>
      </button>
      <div className="ov20-tabs">
        {TABS.map((tb) => (
          <button type="button" key={tb.id} className={`ov20-tab ${tab === tb.id ? 'active' : ''}`} onClick={() => onSelect(tb.id)}>{tb.label}</button>
        ))}
      </div>
    </div>
  );
}

export { TABS };
