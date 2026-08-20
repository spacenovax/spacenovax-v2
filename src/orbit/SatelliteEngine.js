// Orbit Module — Satellite Engine.
// Propagates public TLE data (Celestrak "stations" group, via our server proxy) with
// satellite.js, plus the live ISS feed for a precise anchor point.
import { twoline2satrec, propagate, gstime, eciToGeodetic, degreesLat, degreesLong } from 'satellite.js';
import { fetchSatelliteTle, fetchIssPosition } from './api.js';

// The public TLE relay can briefly be unavailable. These are display-only
// reference orbits so the globe never collapses to a single ISS icon; each is
// explicitly marked estimated and is replaced immediately when live TLE data loads.
const DISPLAY_FALLBACKS = [
  { id: 'POISK', name: 'POISK', lat: 45, lon: 118, altKm: 408 },
  { id: 'CSS-TIANHE', name: 'CSS (TIANHE)', lat: 27, lon: 104, altKm: 390 },
  { id: 'KIBO', name: 'KIBO', lat: 19, lon: 142, altKm: 408 },
  { id: 'NOAA-20', name: 'NOAA 20', lat: 7, lon: 82, altKm: 824 },
  { id: 'SENTINEL-2', name: 'SENTINEL 2', lat: 36, lon: 68, altKm: 786 },
  { id: 'HUBBLE', name: 'HUBBLE', lat: 52, lon: 91, altKm: 535 },
];

export default class SatelliteEngine {
  constructor() {
    this.satrecs = [];
    this.ready = false;
  }

  async load() {
    try {
      const tle = await fetchSatelliteTle();
      this.satrecs = tle
        .map((s) => {
          try { return { name: s.name, rec: twoline2satrec(s.line1, s.line2) }; }
          catch { return null; }
        })
        .filter(Boolean);
      this.ready = true;
    } catch {
      this.satrecs = [];
      this.ready = false;
    }
    return this.ready;
  }

  positionsNow() {
    const date = new Date();
    const gst = gstime(date);
    const out = [];
    for (const { name, rec } of this.satrecs) {
      try {
        const pv = propagate(rec, date);
        if (!pv?.position) continue;
        const geo = eciToGeodetic(pv.position, gst);
        out.push({
          id: name,
          name,
          lat: degreesLat(geo.latitude),
          lon: degreesLong(geo.longitude),
          altKm: geo.height,
        });
      } catch { /* skip decayed / invalid element sets */ }
    }
    if (out.length) return out;
    const minutes = date.getTime() / 60_000;
    return DISPLAY_FALLBACKS.map((satellite, index) => ({
      ...satellite,
      // Slow visual drift keeps the fallback recognisably orbital without
      // claiming a precise real-time position.
      lat: Math.max(-78, Math.min(78, satellite.lat + Math.sin(minutes / (13 + index * 2)) * 8)),
      lon: ((satellite.lon + minutes * (0.32 + index * 0.03) + 540) % 360) - 180,
      estimated: true,
    }));
  }

  async issNow() {
    try { return await fetchIssPosition(); } catch { return null; }
  }
}
