#!/usr/bin/env node
/**
 * Genesis Community Node V1 agent.
 * It uses only short-lived read/cache/monitor tokens and cannot access account,
 * balance, mining, reward, wallet, KYC, ledger, database, or admin endpoints.
 */
import os from 'node:os';
import process from 'node:process';
import { createHash } from 'node:crypto';

const baseUrl = (process.env.COMMUNITY_NODE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const pairingCode = String(process.env.COMMUNITY_NODE_PAIRING_CODE || '').trim();
let nodeId = process.env.COMMUNITY_NODE_ID;
let nodeSecret = process.env.COMMUNITY_NODE_SECRET;
const label = String(process.env.COMMUNITY_NODE_LABEL || `${os.hostname()} community node`).slice(0, 80);
const intervalMs = Math.max(30_000, Number(process.env.COMMUNITY_NODE_INTERVAL_MS || 60_000));
const machineFingerprint = createHash('sha256').update(`${os.hostname()}|${os.platform()}|${os.arch()}|${os.cpus().length}`).digest('hex');

const request = async (path, options = {}) => {
  const started = Date.now();
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.message || data.error || `HTTP ${response.status}`);
  return { data, latency: Date.now() - started };
};

if (pairingCode && (!nodeId || !nodeSecret)) {
  const { data } = await request('/api/nodes/pair', { method: 'POST', body: JSON.stringify({ pairingCode, label }) });
  nodeId = data.nodeId;
  nodeSecret = data.nodeSecret;
  console.log('\nPairing complete. Store these once-only values in your local environment, then remove COMMUNITY_NODE_PAIRING_CODE:');
  console.log(`COMMUNITY_NODE_ID=${nodeId}`);
  console.log(`COMMUNITY_NODE_SECRET=${nodeSecret}\n`);
}

if (!nodeId || !nodeSecret) throw new Error('Set COMMUNITY_NODE_PAIRING_CODE once, or set COMMUNITY_NODE_ID and COMMUNITY_NODE_SECRET.');
const startedAt = Date.now();

async function cycle() {
  const { data: token } = await request('/api/nodes/token', { method: 'POST', body: JSON.stringify({ nodeId, nodeSecret }) });
  const auth = { authorization: `Bearer ${token.accessToken}` };
  const load = os.loadavg()[0] / Math.max(os.cpus().length, 1) * 100;
  const memory = process.memoryUsage().rss / os.totalmem() * 100;
  const { data: heartbeat } = await request('/api/nodes/heartbeat', {
    method: 'POST', headers: auth,
    body: JSON.stringify({ cpuPercent: load, memoryPercent: memory, diskPercent: 0, uptimeSeconds: Math.round((Date.now() - startedAt) / 1000), apiLatencyMs: 0, serviceStatus: 'online', machineFingerprint }),
  });
  const { data: workResponse } = await request('/api/nodes/work', { headers: auth });
  const task = workResponse.task;
  const sha256 = createHash('sha256').update(task.body).digest('hex');
  const { data: result } = await request('/api/nodes/results', { method: 'POST', headers: auth, body: JSON.stringify({ taskId: task.id, type: task.type, sha256 }) });
  console.log(JSON.stringify({ at: new Date().toISOString(), nodeId, status: heartbeat.status, task: task.type, verified: result.ok }, null, 2));
}

async function run() {
  try { await cycle(); } catch (error) { console.error(`[Genesis Node] ${error.message}`); }
}

await run();
setInterval(run, intervalMs);
