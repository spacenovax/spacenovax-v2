import fs from 'node:fs';

const root = new URL('..', import.meta.url);
const appSource = fs.readFileSync(new URL('../src/V15App.jsx', import.meta.url), 'utf8');
const serverSource = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const requiredFiles = [
  'src/orbit/EarthEngine.js',
  'src/orbit/SatelliteEngine.js',
  'src/orbit/OrbitV20/OrbitV20.jsx',
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
  || !serverSource.includes('Orbit Earth Navigation live context')) {
  throw new Error('Orbit server proxy or NOVA context integration is missing.');
}

if (!packageJson.dependencies?.three || !packageJson.dependencies?.['satellite.js']) {
  throw new Error('Orbit runtime dependencies are missing.');
}

console.log(JSON.stringify({
  orbitRoute: true,
  lazyLoaded: true,
  earthAssets: true,
  satelliteProxy: true,
  geocodeProxy: true,
  novaOrbitContext: true,
}));
