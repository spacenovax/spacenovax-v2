import fs from 'node:fs';

const root = new URL('..', import.meta.url);
const appSource = fs.readFileSync(new URL('../src/V15App.jsx', import.meta.url), 'utf8');
const serverSource = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const requiredFiles = [
  'src/orbit/EarthEngine.js',
  'src/orbit/SatelliteEngine.js',
  'src/orbit/OrbitV20/OrbitV20.jsx',
  'src/orbit/OrbitV20/OrbitRouteTelemetry.jsx',
  'src/orbit/OrbitV20/OrbitDrivingView.jsx',
  'src/orbit/OrbitV20/OrbitSatellite.jsx',
  'src/orbit/OrbitV20/OrbitEvents.jsx',
  'src/orbit/OrbitV20/orbit-v20.css',
  'public/orbit/earth-day-real.webp',
  'public/orbit/earth-night-real.webp',
  'public/orbit/earth-clouds-real.webp',
];

for (const file of requiredFiles) {
  if (!fs.existsSync(new URL(file, root))) throw new Error(`Orbit integration file missing: ${file}`);
}

if (!appSource.includes("lazy(() => import('./orbit/OrbitV20/OrbitV20.jsx'))")
  || !appSource.includes("tab === 'orbit'")
  || !appSource.includes("tab !== 'orbit'")
  || !appSource.includes("['orbit','globe',orbitLabel,isKorean ? '네비' : 'Orbit']")) {
  throw new Error('Orbit route, lazy loading, or navigation integration is missing.');
}

if (!serverSource.includes("app.get('/api/orbit/satellites'")
  || !serverSource.includes("app.get('/api/orbit/geocode'")
  || !serverSource.includes("app.get('/api/orbit/route'")
  || !serverSource.includes('Orbit Earth Navigation live context')) {
  throw new Error('Orbit server proxy or NOVA context integration is missing.');
}

if (!serverSource.includes('namedetails=1')
  || !fs.readFileSync(new URL('../src/orbit/OrbitV20/OrbitV20.jsx', import.meta.url), 'utf8').includes('searchDestination(q, language)')
  || !fs.readFileSync(new URL('../src/orbit/api.js', import.meta.url), 'utf8').includes('lang=${encodeURIComponent(language)}')) {
  throw new Error('Orbit localized destination search is missing.');
}

if (!packageJson.dependencies?.three || !packageJson.dependencies?.['satellite.js']) {
  throw new Error('Orbit runtime dependencies are missing.');
}

const orbitSource = fs.readFileSync(new URL('../src/orbit/OrbitV20/OrbitV20.jsx', import.meta.url), 'utf8');
const earthViewSource = fs.readFileSync(new URL('../src/orbit/OrbitV20/OrbitEarthView.jsx', import.meta.url), 'utf8');
const earthEngineSource = fs.readFileSync(new URL('../src/orbit/EarthEngine.js', import.meta.url), 'utf8');
const routeSource = fs.readFileSync(new URL('../src/orbit/OrbitV20/OrbitRouteTelemetry.jsx', import.meta.url), 'utf8');
const drivingViewSource = fs.readFileSync(new URL('../src/orbit/OrbitV20/OrbitDrivingView.jsx', import.meta.url), 'utf8');
const searchOverlaySource = fs.readFileSync(new URL('../src/orbit/OrbitV20/OrbitSearchOverlay.jsx', import.meta.url), 'utf8');
const satelliteSource = fs.readFileSync(new URL('../src/orbit/OrbitV20/OrbitSatellite.jsx', import.meta.url), 'utf8');
const eventSource = fs.readFileSync(new URL('../src/orbit/OrbitV20/OrbitEvents.jsx', import.meta.url), 'utf8');

if (!orbitSource.includes('setIssPosition')
  || !orbitSource.includes('setSatellites')
  || !orbitSource.includes('markerTargets')
  || !orbitSource.includes("type: 'typhoon'")
  || !orbitSource.includes("type: 'satellite'")
  || !orbitSource.includes('<OrbitRouteTelemetry')) {
  throw new Error('Orbit live satellite and route telemetry UI integration is missing.');
}

if (!orbitSource.includes('fetchDrivingRoute')
  || !earthEngineSource.includes('setRoadRoute')
  || !routeSource.includes('DRIVING ROUTE')) {
  throw new Error('Orbit driving navigation integration is missing.');
}

if (!orbitSource.includes('<OrbitDrivingView')
  || !drivingViewSource.includes('MapContainer')
  || !drivingViewSource.includes('GPS LIVE GUIDANCE')
  || !drivingViewSource.includes('MapControls')
  || !drivingViewSource.includes('routeArrow')) {
  throw new Error('Orbit 2D driving guidance view is missing.');
}

if (!orbitSource.includes('gpsRetry')
  || !fs.readFileSync(new URL('../src/orbit/OrbitV20/OrbitCurrentPosition.jsx', import.meta.url), 'utf8').includes('Allow location access')) {
  throw new Error('Orbit GPS permission fallback must not present a default map point as a live location.');
}

if (!searchOverlaySource.includes('BrowserSpeechProvider')
  || !searchOverlaySource.includes('toggleVoiceSearch')
  || !searchOverlaySource.includes('ov20-search-mic')) {
  throw new Error('Orbit voice destination search is missing.');
}

if (!earthViewSource.includes('ov20-marker-pin')
  || !earthViewSource.includes("type === 'base'")
  || !earthViewSource.includes("type === 'typhoon'")
  || !earthViewSource.includes("type === 'satellite'")) {
  throw new Error('Orbit semantic 3D marker overlay integration is missing.');
}

if (!earthEngineSource.includes('zoomProgress')
  || !earthEngineSource.includes('expanded: zoomProgress')
  || !orbitSource.includes('markerUpdateAt')) {
  throw new Error('Orbit responsive marker projection or render throttling is missing.');
}

if (!earthEngineSource.includes('nightAmbient')
  || !earthEngineSource.includes('readableNight')
  || !earthEngineSource.includes('vec3(0.026, 0.082, 0.175)')) {
  throw new Error('Orbit mobile night-side visibility fallback is missing.');
}

if (!routeSource.includes('NOVA GLOBAL NAVIGATION')
  || !routeSource.includes('distanceKm')
  || !satelliteSource.includes('satellites.slice(0, 3)')
  || !eventSource.includes('topEvents')) {
  throw new Error('Orbit telemetry panel details are missing.');
}

console.log(JSON.stringify({
  orbitRoute: true,
  lazyLoaded: true,
  earthAssets: true,
  satelliteProxy: true,
  geocodeProxy: true,
  novaOrbitContext: true,
  liveSatelliteTelemetry: true,
  routeTelemetry: true,
}));
