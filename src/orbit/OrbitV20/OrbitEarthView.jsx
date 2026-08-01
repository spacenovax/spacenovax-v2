// Orbit V21 — Live Earth view: sits in the center column of the always-on 3-column HUD.
// EarthEngine (render loop, camera, FlyTo, real NASA texture) is untouched — this only
// mounts the canvas container and renders HTML overlays positioned from the engine's
// per-frame screen projection.
import React from 'react';

export default function OrbitEarthView({ containerRef, current, markerPos, onZoomIn, onZoomOut, onRecenter }) {
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
        {markerPos.current?.visible && (
          <div className="ov20-marker current" style={{ left: markerPos.current.x, top: markerPos.current.y }}><div className="dot" /><span className="tag">CURRENT</span></div>
        )}
        {markerPos.dest?.visible && (
          <div className="ov20-marker dest" style={{ left: markerPos.dest.x, top: markerPos.dest.y }}><div className="dot" /><span className="tag">DEST</span></div>
        )}
        <div className="ov20-globe-controls">
          <button className="ov20-zoom-btn" onClick={onZoomIn}>−</button>
          <button className="ov20-recenter-btn" onClick={onRecenter}>⊕</button>
          <button className="ov20-zoom-btn" onClick={onZoomOut}>+</button>
        </div>
      </div>
    </div>
  );
}
