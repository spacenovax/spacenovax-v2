import assert from 'node:assert/strict';
import test from 'node:test';
import { createNavigationProfile, getNavigationProgress, guidanceSpeech, maneuverLabel, navigationMessage } from '../src/orbit/navigationLite.js';

const route = {
  points: [
    { lat: 0, lon: 0 },
    { lat: 0, lon: 0.005 },
    { lat: 0.005, lon: 0.005 },
  ],
  steps: [
    { name: 'Start Road', maneuver: { type: 'depart', modifier: 'straight', location: { lat: 0, lon: 0 } } },
    { name: 'Turn Avenue', maneuver: { type: 'turn', modifier: 'left', location: { lat: 0, lon: 0.005 } } },
    { name: 'Arrival Road', maneuver: { type: 'arrive', modifier: '', location: { lat: 0.005, lon: 0.005 } } },
  ],
};

test('Lite navigation follows the next maneuver on the route instead of the first OSRM depart step', () => {
  const profile = createNavigationProfile(route);
  const progress = getNavigationProgress(profile, { lat: 0, lon: 0.002 });
  assert.equal(progress.nextStep.name, 'Turn Avenue');
  assert.ok(progress.nextStep.distanceToManeuverM > 250 && progress.nextStep.distanceToManeuverM < 380);
  assert.ok(progress.remainingRouteM > 800);
});

test('Lite navigation exposes a route-distance signal for safe off-route rechecks', () => {
  const profile = createNavigationProfile(route);
  const onRoute = getNavigationProgress(profile, { lat: 0, lon: 0.002 });
  const offRoute = getNavigationProgress(profile, { lat: 0.0012, lon: 0.002 });
  assert.ok(onRoute.offRouteM < 5);
  assert.ok(offRoute.offRouteM > 100);
});

test('Lite navigation supplies human turn wording at the 300m and 100m thresholds', () => {
  const step = route.steps[1];
  assert.equal(maneuverLabel(step, true), '좌회전');
  assert.match(guidanceSpeech(step, 280, true), /300미터.*좌회전/);
  assert.match(guidanceSpeech(step, 90, true), /100미터.*좌회전/);
});

test('Lite guidance provides the same core safety prompts in every in-app language', () => {
  const languages = ['en', 'ko', 'ja', 'zh', 'es', 'pt', 'de', 'fr', 'ru', 'vi', 'id', 'ar'];
  for (const language of languages) {
    assert.ok(maneuverLabel(route.steps[1], language).length > 1, `${language} maneuver label`);
    assert.ok(guidanceSpeech(route.steps[1], 280, language).length > 12, `${language} 300m prompt`);
    assert.ok(navigationMessage('offRoute', language).length > 12, `${language} reroute prompt`);
  }
});
