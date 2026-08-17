import assert from 'node:assert/strict';

const data = new Map();
global.window = { localStorage: { getItem: (key) => data.get(key) || null, setItem: (key, value) => data.set(key, String(value)) } };

const packs = await import('../src/orbit/navigationOfflinePacks.js');
const now = Date.now();
const origin = { lat: 37.5665, lon: 126.9780 };
const destination = { id: 'seoul-station', label: 'Seoul Station', lat: 37.5547, lon: 126.9706 };
const route = { distanceM: 2100, durationSec: 420, points: [origin, destination], steps: [] };

assert.ok(packs.saveOfflineRegionPack({ route, origin, destination, savedAt: now }));
assert.equal(packs.listOfflineRegionPacks(now).length, 1);
const match = packs.loadCompatibleOfflineRegionPack({ current: origin, destination, now: now + 1000 });
assert.equal(match?.route?.source, 'offline-pack');
assert.equal(match?.destination?.id, destination.id);
for (let index = 1; index <= 4; index += 1) {
  packs.saveOfflineRegionPack({ route, origin, destination: { id: `destination-${index}`, label: `Destination ${index}`, lat: 37.4 + index / 100, lon: 126.8 + index / 100 }, savedAt: now + index });
}
assert.equal(packs.listOfflineRegionPacks(now + 10).length, packs.OFFLINE_REGION_PACK_LIMIT);
assert.ok(packs.removeOfflineRegionPack(packs.listOfflineRegionPacks(now + 10)[0].id));
console.log('offline region route pack tests passed');
