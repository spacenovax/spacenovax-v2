import { spawn } from 'node:child_process';
import fs from 'node:fs';

const port = String(34000 + (process.pid % 1000));
const base = `http://127.0.0.1:${port}`;
const dataFile = `/tmp/spnx-critical-flow-${process.pid}.json`;
const clientId = `critical-${Date.now()}`;
const headers = { 'content-type': 'application/json', 'x-spnx-client-id': clientId };
let server;

async function startServer() {
  server = spawn(process.execPath, ['server.js'], {
    cwd: new URL('..', import.meta.url),
    env: {
      ...process.env,
      PORT: port,
      DATA_FILE: dataFile,
      ADMIN_ID: 'admin',
      ADMIN_PASSWORD: 'critical-test-password',
      SESSION_SECRET: 'critical-test-session',
    },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Critical-flow server did not start.')), 5000);
    server.once('error', reject);
    const poll = async () => {
      try {
        await fetch(`${base}/api/health`);
        clearTimeout(timeout);
        resolve();
      } catch {
        setTimeout(poll, 40);
      }
    };
    poll();
  });
}

async function stopServer() {
  if (!server || server.exitCode !== null) return;
  server.kill('SIGTERM');
  await new Promise((resolve) => server.once('exit', resolve));
}

async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, options);
  const body = await response.json();
  if (!response.ok) {
    const error = new Error(`${path}: ${response.status} ${body.message || JSON.stringify(body)}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

async function adminLogin() {
  const login = await request('/api/admin/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: 'admin', password: 'critical-test-password' }),
  });
  return { 'content-type': 'application/json', authorization: `Bearer ${login.token}` };
}

try {
  await startServer();
  const initial = await request('/api/session', { method: 'POST', headers, body: '{}' });
  const userId = initial.user.id;
  await request('/api/mining/start', { method: 'POST', headers, body: '{}' });

  // Simulate the app and Telegram being closed for longer than the whole cycle.
  await stopServer();
  const persisted = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  persisted.users[userId].mining.startedAt = Date.now() - (24 * 60 * 60 * 1000) - 5000;
  fs.writeFileSync(dataFile, JSON.stringify(persisted, null, 2));
  await startServer();

  const resumed = await request('/api/mining/status', { headers });
  let restartBlocked = false;
  try {
    await request('/api/mining/start', { method: 'POST', headers, body: '{}' });
  } catch (error) {
    restartBlocked = error.status === 409 && /claim/i.test(error.body?.message || '');
  }
  const stillClaimable = await request('/api/mining/status', { headers });
  const claimed = await request('/api/mining/claim', { method: 'POST', headers, body: '{}' });

  const gameEventId = `qa-boss-${Date.now()}`;
  const game = await request('/api/game/reward', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      eventId: gameEventId,
      rewardType: 'boss',
      reward: 5,
      score: 123456,
      completedAt: Date.now(),
    }),
  });
  let duplicateGameBlocked = false;
  try {
    await request('/api/game/reward', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        eventId: gameEventId,
        rewardType: 'boss',
        reward: 5,
        score: 123456,
        completedAt: Date.now(),
      }),
    });
  } catch (error) {
    duplicateGameBlocked = error.status === 409;
  }

  const session = await request('/api/session', { method: 'POST', headers, body: '{}' });
  const ledger = await request('/api/ledger', { method: 'POST', headers, body: '{}' });
  const ranking = await request('/api/ranking', { headers });
  const community = await request('/api/community/dashboard', { method: 'POST', headers, body: '{}' });
  const adminHeaders = await adminLogin();
  const adminUsers = await request(`/api/admin/users/search?q=${encodeURIComponent(userId)}`, { headers: adminHeaders });
  const adminStats = await request('/api/admin/stats', { headers: adminHeaders });
  const operations = await request('/api/admin/operations', { headers: adminHeaders });
  const adminContractPaths = [
    '/api/admin/me',
    '/api/admin/logs',
    '/api/admin/users',
    '/api/admin/missions',
    '/api/admin/risk',
    '/api/admin/live-monitor',
    '/api/admin/settings',
    '/api/admin/convert-queue',
    '/api/admin/distribution-simulator',
    '/api/admin/ranking/full',
    '/api/admin/mining/engine',
    '/api/admin/community/reports',
  ];
  const adminContracts = await Promise.all(adminContractPaths.map(async (path) => {
    try {
      await request(path, { headers: adminHeaders });
      return true;
    } catch {
      return false;
    }
  }));

  // Exercise the reversible Admin mutations against the isolated QA ledger.
  // This verifies that the dashboard is not only readable, but writes through
  // the same user, settings, mission, mining, event and ledger stores.
  const currentMissions = await request('/api/admin/missions', { headers: adminHeaders });
  const currentSettings = await request('/api/admin/settings', { headers: adminHeaders });
  const currentEngine = await request('/api/admin/mining/engine', { headers: adminHeaders });
  const mission = currentMissions.missions[0];
  const adminMutations = [];
  adminMutations.push(await request('/api/admin/points', {
    method: 'POST', headers: adminHeaders,
    body: JSON.stringify({ userId, amount: 1, reason: 'QA reversible adjustment' }),
  }));
  adminMutations.push(await request('/api/admin/points', {
    method: 'POST', headers: adminHeaders,
    body: JSON.stringify({ userId, amount: -1, reason: 'QA reversible adjustment rollback' }),
  }));
  adminMutations.push(await request('/api/admin/user/update', {
    method: 'POST', headers: adminHeaders,
    body: JSON.stringify({ userId, banned: true, reason: 'QA reversible moderation check' }),
  }));
  adminMutations.push(await request('/api/admin/user/update', {
    method: 'POST', headers: adminHeaders,
    body: JSON.stringify({ userId, banned: false, reason: 'QA reversible moderation rollback' }),
  }));
  adminMutations.push(await request('/api/admin/mission/update', {
    method: 'POST', headers: adminHeaders,
    body: JSON.stringify({
      id: mission.id,
      title: mission.title,
      reward: mission.reward,
      enabled: mission.enabled,
      url: mission.url,
    }),
  }));
  adminMutations.push(await request('/api/admin/settings/update', {
    method: 'POST', headers: adminHeaders,
    body: JSON.stringify({
      minConvert: currentSettings.settings.minConvert,
      pointToTokenRate: currentSettings.settings.pointToTokenRate,
      fleetMaxMembers: currentSettings.settings.fleetMaxMembers,
      activeFleetDays: currentSettings.settings.activeFleetDays,
      gameRewardsEnabled: currentSettings.settings.gameRewardsEnabled,
      novaAiEnabled: currentSettings.settings.novaAiEnabled,
      maintenanceMode: currentSettings.settings.maintenanceMode,
    }),
  }));
  adminMutations.push(await request('/api/admin/mining/settings', {
    method: 'POST', headers: adminHeaders,
    body: JSON.stringify({
      miningSandboxEnabled: currentEngine.engine.sandbox,
      miningSandboxMinutes: currentEngine.engine.sandboxMinutes,
      eventMultiplier: currentEngine.engine.eventMultiplier,
    }),
  }));
  const sessionAfterAdmin = await request('/api/session', { method: 'POST', headers, body: '{}' });

  const expectedMining = Number(claimed.user.balance || 0);
  const expectedFinal = expectedMining + 5;
  const ranked = ranking.top.find((row) => row.id === userId);
  const adminUser = adminUsers.users.find((row) => row.id === userId);
  const result = {
    resumeAfterRestart: resumed.mining.claimable === true && resumed.mining.remainingMs === 0,
    completedCycleProtected: restartBlocked && stillClaimable.mining.claimable === true,
    miningCredited: expectedMining > 0 && ledger.entries.some((entry) => entry.type === 'mining_reward' && entry.balanceAfter === expectedMining),
    gameCredited: game.reward === 5 && ledger.entries.some((entry) => entry.type === 'game_reward' && entry.balanceAfter === expectedFinal),
    duplicateGameBlocked,
    homeWalletSnapshotAligned: session.user.balance === expectedFinal,
    rankingAligned: ranked?.balance === expectedFinal,
    gameRankingAligned: community.dashboard?.gameScore === 123456,
    adminUserAligned: adminUser?.balance === expectedFinal,
    adminAggregateAligned: adminStats.stats?.totalBalance === expectedFinal,
    ledgerIntegrity: operations.operations?.system?.ledgerIntegrity?.valid === true,
    adminDashboardLinked: adminContracts.every(Boolean),
    adminMutationsLinked: adminMutations.every((body) => body.ok === true)
      && sessionAfterAdmin.user.balance === expectedFinal
      && adminMutations[3].user.banned === false,
  };
  if (Object.values(result).some((value) => value !== true)) throw new Error(JSON.stringify(result));
  console.log(JSON.stringify(result));
} finally {
  await stopServer();
  fs.rmSync(dataFile, { force: true });
}
