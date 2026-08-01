// Orbit V21 — Right column: Destination + Weather + Earth Events, stacked, always visible.
import React from 'react';
import OrbitDestination from './OrbitDestination.jsx';
import OrbitWeather from './OrbitWeather.jsx';
import OrbitEvents from './OrbitEvents.jsx';

export default function OrbitRightPanel(props) {
  return (
    <>
      <OrbitDestination {...props} />
      <OrbitWeather {...props} />
      <OrbitEvents {...props} />
    </>
  );
}
