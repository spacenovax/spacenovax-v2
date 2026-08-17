// Orbit Module — API Manager
// Central fetch layer for all Orbit data sources. Every source here is a public,
// open dataset. No military, private, or real-time human/vehicle tracking data.
// Each fetcher is cached in-memory with a TTL so the UI can poll cheaply.

const cache = new Map();

async function cachedFetch(key, ttlMs, loader) {
  const hit = cache.get(key);
  const t = Date.now();
  if (hit && t - hit.at < ttlMs) return hit.data;
  try {
    const data = await loader();
    cache.set(key, { at: t, data });
    return data;
  } catch (error) {
    if (hit) return hit.data; // serve stale on failure rather than break the UI
    throw error;
  }
}

// ISS live position — https://wheretheiss.at (public, keyless)
export function fetchIssPosition() {
  return cachedFetch('iss', 5_000, async () => {
    const res = await fetch('https://api.wheretheiss.at/v1/satellites/25544');
    if (!res.ok) throw new Error('ISS feed unavailable');
    const d = await res.json();
    return { lat: d.latitude, lon: d.longitude, altKm: d.altitude, velKmh: d.velocity, at: d.timestamp * 1000 };
  });
}

// Satellite TLE set — relayed through our own server to avoid browser CORS limits on Celestrak.
export function fetchSatelliteTle() {
  return cachedFetch('tle', 6 * 60 * 60_000, async () => {
    const res = await fetch('/api/orbit/satellites');
    const d = await res.json();
    if (!d.ok) throw new Error(d.message || 'Satellite network unavailable');
    return d.satellites || [];
  });
}

// Current weather at a point — Open-Meteo (public, keyless)
export function fetchWeather(lat, lon) {
  const key = `wx:${lat.toFixed(1)},${lon.toFixed(1)}`;
  return cachedFetch(key, 10 * 60_000, async () => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,cloud_cover,precipitation,wind_speed_10m,wind_direction_10m,weather_code&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Weather feed unavailable');
    const d = await res.json();
    return d.current || null;
  });
}

// Air quality — separate Open-Meteo service (public, keyless). European AQI scale.
export function fetchAirQuality(lat, lon) {
  const key = `aq:${lat.toFixed(1)},${lon.toFixed(1)}`;
  return cachedFetch(key, 30 * 60_000, async () => {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Air quality feed unavailable');
    const d = await res.json();
    return d.current?.european_aqi ?? null;
  });
}

// Significant earthquakes (last 7 days, mag 4.5+) — USGS (public, keyless)
export function fetchEarthquakes() {
  return cachedFetch('quakes', 5 * 60_000, async () => {
    const res = await fetch('https://earthquake.usgs.gov/earthquake/feed/v1.0/summary/4.5_week.geojson');
    if (!res.ok) throw new Error('Earthquake feed unavailable');
    const d = await res.json();
    return (d.features || []).map((f) => ({
      id: f.id,
      mag: f.properties.mag,
      place: f.properties.place,
      time: f.properties.time,
      lon: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
    }));
  });
}

// Wildfires / volcanoes / severe storms — NASA EONET (public, keyless)
export function fetchEonetEvents() {
  return cachedFetch('eonet', 10 * 60_000, async () => {
    const res = await fetch('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=80');
    if (!res.ok) throw new Error('Earth Intelligence feed unavailable');
    const d = await res.json();
    return (d.events || [])
      .map((e) => {
        const geo = e.geometry?.[e.geometry.length - 1];
        if (!geo) return null;
        const coords = geo.type === 'Point' ? geo.coordinates : geo.coordinates?.[0];
        if (!coords) return null;
        // Full track history (EONET provides one geometry entry per observation over
        // time) — used to draw a storm/typhoon's real path across the globe, not just
        // its latest position.
        const track = (e.geometry || [])
          .map((g) => {
            const c = g.type === 'Point' ? g.coordinates : g.coordinates?.[0];
            return c ? { lon: c[0], lat: c[1], date: g.date } : null;
          })
          .filter(Boolean);
        return {
          id: e.id,
          title: e.title,
          category: e.categories?.[0]?.title || 'Event',
          lon: coords[0],
          lat: coords[1],
          date: geo.date,
          track,
        };
      })
      .filter(Boolean);
  });
}

// Reverse geocode current position -> country/city, for the Current Position panel.
export function reverseGeocode(lat, lon, language = 'en') {
  const key = `rev:${lat.toFixed(2)},${lon.toFixed(2)}:${language}`;
  return cachedFetch(key, 30 * 60_000, async () => {
    const res = await fetch(`/api/orbit/geocode?lat=${lat}&lon=${lon}&lang=${encodeURIComponent(language)}`);
    const d = await res.json();
    if (!d.ok) throw new Error(d.message || 'Reverse geocode unavailable');
    return d.place || null;
  });
}

// Destination search — relayed through our server (Nominatim usage policy requires a
// server-side User-Agent, not a direct browser call).
export function searchDestination(query, language = 'en', { near = null } = {}) {
  // Nearby quick destinations use a coarse (~100m) position only to bias the
  // public search.  The client does not persist it and the route API still owns
  // any actual navigation request.
  const hasNearbyPoint = Number.isFinite(near?.lat) && Number.isFinite(near?.lon)
    && Math.abs(near.lat) <= 90 && Math.abs(near.lon) <= 180;
  const nearbyLat = hasNearbyPoint ? Number(near.lat.toFixed(3)) : null;
  const nearbyLon = hasNearbyPoint ? Number(near.lon.toFixed(3)) : null;
  const nearKey = hasNearbyPoint ? `:${nearbyLat.toFixed(3)},${nearbyLon.toFixed(3)}` : '';
  const key = `geo:${query.toLowerCase()}:${language}${nearKey}`;
  return cachedFetch(key, 5 * 60_000, async () => {
    const nearbyParams = hasNearbyPoint ? `&nearLat=${encodeURIComponent(nearbyLat)}&nearLon=${encodeURIComponent(nearbyLon)}` : '';
    const res = await fetch(`/api/orbit/geocode?q=${encodeURIComponent(query)}&lang=${encodeURIComponent(language)}${nearbyParams}`);
    const d = await res.json();
    if (!d.ok) throw new Error(d.message || 'Destination search unavailable');
    return d.results || [];
  });
}


// Nearby discovery — requested only after a captain searches for a place. The
// server resolves public OSM places around that selected result; no GPS history
// is retained by the client or service.
export function fetchNearbyPlaces(lat, lon, language = 'en') {
  const safeLat = Number(lat);
  const safeLon = Number(lon);
  if (!Number.isFinite(safeLat) || !Number.isFinite(safeLon)) return Promise.resolve([]);
  const key = `nearby:${safeLat.toFixed(3)},${safeLon.toFixed(3)}:${language}`;
  return cachedFetch(key, 10 * 60_000, async () => {
    const res = await fetch(`/api/orbit/nearby-places?lat=${encodeURIComponent(safeLat.toFixed(5))}&lon=${encodeURIComponent(safeLon.toFixed(5))}&lang=${encodeURIComponent(language)}`);
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.message || 'Nearby places unavailable');
    return data.places || [];
  });
}

export function fetchDrivingRoute(from, to, { fresh = false, mode = 'recommended' } = {}) {
  if (!from || !to) return Promise.resolve(null);
  const routeMode = ['recommended', 'toll', 'free'].includes(mode) ? mode : 'recommended';
  const key = `drive:${routeMode}:${from.lat.toFixed(3)},${from.lon.toFixed(3)}:${to.lat.toFixed(3)},${to.lon.toFixed(3)}`;
  const loadRoute = async () => {
    const params = new URLSearchParams({ fromLat: from.lat, fromLon: from.lon, toLat: to.lat, toLon: to.lon, mode: routeMode });
    if (fresh) params.set('fresh', '1');
    const res = await fetch(`/api/orbit/route?${params}`); const data = await res.json();
    if (!res.ok || !data.ok) {
      const error = new Error(data.message || 'Driving route unavailable');
      error.code = data.code || '';
      throw error;
    }
    return data.route || null;
  };
  // A deliberate off-route refresh must never be served a cached route that
  // starts from the old road. Normal destination selection remains cached.
  return fresh ? loadRoute() : cachedFetch(key, 45_000, loadRoute);
}

export function fetchSpaceWeather() {
  return cachedFetch('swpc', 10 * 60_000, async () => {
    const res = await fetch('https://services.swpc.noaa.gov/products/alerts.json');
    if (!res.ok) throw new Error('Space weather feed unavailable');
    const d = await res.json();
    return (d || []).slice(0, 10).map((a) => ({
      id: a.serial_number || a.issue_datetime,
      message: (a.message || '').split('\n')[0],
      issuedAt: a.issue_datetime,
    }));
  });
}
