import assert from 'node:assert/strict';
import test from 'node:test';
import { getLowDataMode, loadCompatibleLiteRoute, saveLiteRoute, setLowDataMode } from '../src/orbit/navigationLiteStore.js';

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, String(value)) };
}

globalThis.window = { localStorage: memoryStorage() };

const origin = { lat: 14.5995, lon: 120.9842 };
const destination = { lat: 14.6095, lon: 120.9942, label: 'NOVA destination' };
const route = {
  distanceM: 1900,
  durationSec: 360,
  points: [origin, destination],
  steps: [{ name: 'Main Road', maneuver: { type: 'turn', modifier: 'right', location: destination } }],
};

test('Lite route fallback stays on the captain device and requires a nearby origin and destination', () => {
  const saved = saveLiteRoute({ route, origin, destination });
  assert.ok(saved?.savedAt);
  assert.equal(loadCompatibleLiteRoute({ current: { lat: 14.6002, lon: 120.9845 }, destination })?.route.points.length, 2);
  assert.equal(loadCompatibleLiteRoute({ current: { lat: 14.65, lon: 120.98 }, destination }), null);
  assert.equal(loadCompatibleLiteRoute({ current: origin, destination: { ...destination, lat: 14.7 } }), null);
});

test('Lite low-data preference is stored only in browser storage', () => {
  assert.equal(setLowDataMode(true), true);
  assert.equal(getLowDataMode(), true);
  assert.equal(setLowDataMode(false), false);
  assert.equal(getLowDataMode(), false);
});
