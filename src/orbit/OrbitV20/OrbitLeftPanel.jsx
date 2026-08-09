// Orbit V21 — Left column: Current Position + Satellite, stacked, always visible.
import React from 'react';
import OrbitCurrentPosition from './OrbitCurrentPosition.jsx';
import OrbitSatellite from './OrbitSatellite.jsx';

export default function OrbitLeftPanel(props) {
  return (
    <>
      <OrbitCurrentPosition {...props} />
      <OrbitSatellite {...props} />
    </>
  );
}
