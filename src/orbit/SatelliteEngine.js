// Orbit Module — Satellite Engine.
// Propagates public TLE data (Celestrak "stations" group, via our server proxy) with
// satellite.js, plus the live ISS feed for a precise anchor point.
import { twoline2satrec, propagate, gstime, eciToGeodetic, degreesLat, degreesLong } from 'satellite.js';
import { fetchSatelliteTle, fetchIssPosition } from './api.js';

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
    return out;
  }

  async issNow() {
    try { return await fetchIssPosition(); } catch { return null; }
  }
}
