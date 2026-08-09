import { spawn } from 'node:child_process';
import fs from 'node:fs';

const port = String(33000 + (process.pid % 1000));
const base = `http://127.0.0.1:${port}`;
const dataFile = `/tmp/spnx-community-node-${process.pid}.json`;
const server = spawn(process.execPath, ['server.js'], {
  cwd: new URL('..', import.meta.url),
  env: { ...process.env, PORT: port, DATA_FILE: dataFile, SESSION_SECRET: 'node-test-session-secret' },
  stdio: ['ignore', 'ignore', 'inherit'],
});
process.once('exit', () => server.kill('SIGTERM'));
await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('Community node test server did not start.')), 5000);
  const poll = async () => {
    try { await fetch(`${base}/api/health`); clearTimeout(timeout); resolve(); }
    catch { setTimeout(poll, 50); }
  };
  poll();
});

const headers = { 'content-type': 'application/json', 'x-spnx-client-id': `community-node-qa-${Date.now()}` };
async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, options);
  const body = await response.json();
  if (!response.ok) throw new Error(`${path}: ${response.status} ${body.message || JSON.stringify(body)}`);
  return body;
}

try {
  const session = await request('/api/session', { method: 'POST', headers, body: '{}' });
  const pairing = await request('/api/nodes/pairing', { method: 'POST', headers, body: '{}' });
  const paired = await request('/api/nodes/pair', { method: 'POST', headers, body: JSON.stringify({ pairingCode: pairing.pairingCode, label: 'QA node' }) });
  const token = await request('/api/nodes/token', { method: 'POST', headers, body: JSON.stringify({ nodeId: paired.nodeId, nodeSecret: paired.nodeSecret }) });
  const nodeHeaders = { 'content-type': 'application/json', authorization: `Bearer ${token.accessToken}` };
  const fingerprint = 'a'.repeat(64);
  const heartbeatBody = { cpuPercent: 1, memoryPercent: 1, diskPercent: 1, uptimeSeconds: 60, apiLatencyMs: 100, serviceStatus: 'online', machineFingerprint: fingerprint };
  await request('/api/nodes/heartbeat', { method: 'POST', headers: nodeHeaders, body: JSON.stringify(heartbeatBody) });
  const work = await request('/api/nodes/work', { headers: nodeHeaders });
  await request('/api/nodes/results', { method: 'POST', headers: nodeHeaders, body: JSON.stringify({ taskId: work.task.id, type: work.task.type, sha256: work.task.expectedSha256 }) });

  const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  const node = data.communityNodes[paired.nodeId];
  const day = 24 * 60 * 60 * 1000;
  node.firstHeartbeatAt = Date.now() - day;
  node.lastHeartbeatAt = Date.now() - 60_000;
  node.onlineMs = day;
  node.heartbeatAttempts = 100;
  node.heartbeatSuccesses = 100;
  node.workAttempts = 100;
  node.workSuccesses = 100;
  node.latencyTotalMs = 10_000;
  node.latencySamples = 100;
  node.machineFingerprint = fingerprint;
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));

  const qualified = await request('/api/nodes/heartbeat', { method: 'POST', headers: nodeHeaders, body: JSON.stringify(heartbeatBody) });
  const latest = await request('/api/session', { method: 'POST', headers, body: '{}' });
  const result = {
    automaticPairing: Boolean(paired.nodeId && paired.nodeSecret),
    noManualApproval: qualified.status === 'qualified',
    verifiedBonus: qualified.bonusPercent === 25 && latest.user.communityNode?.bonusPercent === 25,
    oneNodePerCaptain: session.user.id === latest.user.id,
  };
  if (Object.values(result).some((value) => value !== true)) throw new Error(JSON.stringify(result));
  console.log(JSON.stringify(result));
} finally {
  server.kill('SIGTERM');
  fs.rmSync(dataFile, { force: true });
}
