import fs from 'node:fs';

const app = fs.readFileSync(new URL('../src/V15App.jsx', import.meta.url), 'utf8');
const orbit = fs.readFileSync(new URL('../src/orbit/OrbitV20/OrbitV20.jsx', import.meta.url), 'utf8');
const earth = fs.readFileSync(new URL('../src/orbit/EarthEngine.js', import.meta.url), 'utf8');
const performanceManager = fs.readFileSync(new URL('../src/orbit/PerformanceManager.js', import.meta.url), 'utf8');
const orbitNova = fs.readFileSync(new URL('../src/orbit/OrbitV20/OrbitFloatingNova.jsx', import.meta.url), 'utf8');

const localeCodes = ['en', 'ko', 'ja', 'zh', 'es', 'pt', 'de', 'fr', 'ru', 'vi', 'id'];
const result = {
  allSpeechLocalesMapped: localeCodes.every((code) => new RegExp(`\\b${code}:\\s*['\"]`).test(app)),
  recognitionUsesSelectedLocale: (app.match(/recognition\.lang = NOVA_SPEECH_LOCALES\[language\]/g) || []).length >= 2,
  staticGuideVoiceMatchesCopy: app.includes("const guideSpeechLanguage = guides[language] ? language : 'en'"),
  singleGlobalNovaOutsideOrbit: app.includes("tab !== 'orbit' && <NovaGuide") && !orbit.includes('<NovaGuide'),
  singleOrbitNova: (orbit.match(/<OrbitFloatingNova/g) || []).length === 1 && orbitNova.includes('export default function OrbitFloatingNova'),
  orbitTasksRemoved: orbit.includes("MasterRenderLoop.remove('orbit-earth')") && orbit.includes("MasterRenderLoop.remove('orbit-perf')"),
  asyncSatelliteCleanup: orbit.includes('let alive = true') && orbit.includes('if (!alive) return') && orbit.includes('alive = false'),
  performanceListenersDisposed: performanceManager.includes("removeEventListener('levelchange'") && performanceManager.includes("removeEventListener('chargingchange'"),
  earthInputListenersDisposed: earth.includes("removeEventListener('pointermove'") && earth.includes("removeEventListener('touchmove'") && earth.includes('this._interactionHandlers = null'),
  gpuResourcesDisposed: earth.includes('renderer.renderLists?.dispose?.()') && earth.includes('renderer.forceContextLoss?.()') && earth.includes('value?.isTexture'),
};

if (Object.values(result).some((value) => value !== true)) throw new Error(JSON.stringify(result));
console.log(JSON.stringify(result));
