// DEPRECATED as of V21 FINAL — Bottom Sheet is completely abolished per the Final
// Design Specification. OrbitLeftPanel and OrbitRightPanel are now composed directly
// and permanently in OrbitV20.jsx's 3-column layout. This file is no longer imported
// anywhere. Kept on disk rather than deleted, since no explicit delete instruction was
// given.
//
// Orbit V20 — Bottom Sheet shell. This IS the "Navigation always accessible" surface:
// tapping any top tab or Slim HUD chip opens this with the matching panel. Tapping the
// scrim or the same tab again closes it back to the Earth-only default view.
import React from 'react';
import OrbitLeftPanel from './OrbitLeftPanel.jsx';
import OrbitRightPanel from './OrbitRightPanel.jsx';
import OrbitWeather from './OrbitWeather.jsx';
import OrbitEvents from './OrbitEvents.jsx';

export default function OrbitNavigation({ tab, onClose, panelProps }) {
  if (tab === 'live') return null;
  return (
    <>
      <div className="ov20-sheet-scrim" onClick={onClose} />
      <div className="ov20-sheet">
        <div className="ov20-sheet-handle" />
        {tab === 'satellite' && <OrbitLeftPanel {...panelProps} />}
        {tab === 'weather' && <OrbitWeather {...panelProps} />}
        {tab === 'event' && <OrbitEvents {...panelProps} />}
        {tab === 'base' && <OrbitRightPanel {...panelProps} />}
      </div>
    </>
  );
}
