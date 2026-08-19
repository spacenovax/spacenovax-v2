// Orbit V21 — Live Earth view: sits in the center column of the always-on 3-column HUD.
// EarthEngine (render loop, camera, FlyTo, real NASA texture) is untouched — this only
// mounts the canvas container and renders HTML overlays positioned from the engine's
// per-frame screen projection.
import React from 'react';

function MarkerIcon({ type }) {
  if (type === 'base') return <span className="ov20-marker-symbol" aria-hidden="true">⌂</span>;
  if (type === 'typhoon') return <span className="ov20-marker-symbol ov20-typhoon-symbol" aria-hidden="true">◌</span>;
  if (type === 'satellite') return <span className="ov20-marker-symbol ov20-satellite-symbol" aria-hidden="true"><i /><i /><b /></span>;
  if (type === 'destination') return <span className="ov20-marker-symbol" aria-hidden="true">⌖</span>;
  return <span className="ov20-marker-symbol" aria-hidden="true">●</span>;
}

function Marker({ marker, projection }) {
  if (!projection?.visible) return null;
  const expanded = projection.expanded && marker.detail;
  return (
    <div
      className={`ov20-marker ov20-marker-${marker.type} ${expanded ? 'expanded' : 'compact'}`}
      style={{ left: projection.x, top: projection.y, '--marker-scale': projection.scale || 1 }}
      aria-label={marker.label}
    >
      <span className="ov20-marker-pulse" />
      <span className="ov20-marker-pin"><MarkerIcon type={marker.type} /></span>
      <span className="ov20-marker-label">
        <b>{marker.label}</b>
        {expanded && <small>{marker.detail}</small>}
      </span>
    </div>
  );
}

export default function OrbitEarthView({ containerRef, current, markerPos, markerTargets = [], onZoomIn, onZoomOut, onRecenter }) {
  return (
    <div className="ov20-globe-col">
      <div className="ov20-globe-wrap">
        <div className="ov20-globe-canvas" ref={containerRef} />
        {current && (
          <div className="ov20-coord-pill">
            <span>LAT</span>{current.lat.toFixed(2)}°&nbsp;<span>LON</span>{current.lon.toFixed(2)}°
          </div>
        )}
        <div className="ov20-crosshair" />
        {markerTargets.map((marker) => <Marker key={marker.id} marker={marker} projection={markerPos[marker.id]} />)}
        <div className="ov20-globe-controls">
          <button className="ov20-zoom-btn" onClick={onZoomIn}>−</button>
          <button className="ov20-recenter-btn" onClick={onRecenter}>⊕</button>
          <button className="ov20-zoom-btn" onClick={onZoomOut}>+</button>
        </div>
      </div>
    </div>
  );
}
