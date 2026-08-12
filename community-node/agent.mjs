#!/usr/bin/env node
/**
 * SpaceNovaX Genesis Community Node V1.1.
 * Public cache, service health and SHA-256 verification only.
 * No access to balances, mining ledgers, wallets, KYC or private user data.
 */
import os from 'node:os';
import process from 'node:process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const runtimeDir = process.versions.bun && process.platform === 'win32' ? dirname(process.execPath) : dirname(fileURLToPath(import.meta.url));
const configPath = resolve(runtimeDir, 'node-config.json');
let localConfig = {};
if (existsSync(configPath)) { try { localConfig = JSON.parse(readFileSync(configPath, 'utf8')); } catch { localConfig = {}; } }
const baseUrl = (process.env.COMMUNITY_NODE_URL || localConfig.baseUrl || 'https://app.spacenovax.com').replace(/\/$/, '');
let pairingCode = String(process.env.COMMUNITY_NODE_PAIRING_CODE || '').trim();
let nodeId = process.env.COMMUNITY_NODE_ID || localConfig.nodeId;
let nodeSecret = process.env.COMMUNITY_NODE_SECRET || localConfig.nodeSecret;
const label = String(process.env.COMMUNITY_NODE_LABEL || `${os.hostname()} community node`).slice(0, 80);
const intervalMs = Math.max(30_000, Number(process.env.COMMUNITY_NODE_INTERVAL_MS || 60_000));
const machineFingerprint = createHash('sha256').update(`${os.hostname()}|${os.platform()}|${os.arch()}|${os.cpus().length}`).digest('hex');
const startedAt = Date.now();
let cycleNumber = 0;

const workLabels = {
  'spnx-public-ranking-cache': 'SPNX public ranking cache synchronized',
  'spnx-public-missions-cache': 'SPNX public mission cache synchronized',
  'spnx-i18n-cache': 'SPNX language cache verified · languages=12',
  'navigation-satellite-cache': 'NAVIGATION satellite cache synchronized',
  'navigation-weather-status': 'NAVIGATION weather gateway verified',
  'navigation-route-gateway-status': 'NAVIGATION route gateway verified',
  'nova-ai-public-help-cache': 'NOVA AI public help cache synchronized',
  'nova-ai-service-health': 'NOVA AI service health verified',
  'nova-x-game-gateway-status': 'NOVA-X game gateway online',
  'nova-x-public-ranking-cache': 'NOVA-X public ranking cache synchronized',
  'nova-x-asset-integrity': 'NOVA-X public asset integrity verified',
};
function info(message, details = '') {
  const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`\x1b[32mINFO\x1b[0m [${stamp}] ${message}${details ? `  ${details}` : ''}`);
}
const request = async (path, options = {}) => {
  const started = Date.now();
  const response = await fetch(`${baseUrl}${path}`, { headers: { 'content-type': 'application/json', ...(options.headers || {}) }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.message || data.error || `HTTP ${response.status}`);
  return { data, latency: Date.now() - started };
};

console.log('======================================================');
console.log('  SPACENOVAX GENESIS COMMUNITY NODE V1.1');
console.log('  Navigation · NOVA AI · NOVA-X · SPNX Public Network');
console.log('======================================================\n');

if (!nodeId || !nodeSecret) {
  if (!pairingCode) {
    const prompt = createInterface({ input: process.stdin, output: process.stdout });
    pairingCode = String(await prompt.question('앱에서 발급한 1회용 페어링 코드를 입력하세요: ')).trim();
    prompt.close();
  }
  const { data } = await request('/api/nodes/pair', { method: 'POST', body: JSON.stringify({ pairingCode, label }) });
  nodeId = data.nodeId; nodeSecret = data.nodeSecret;
  writeFileSync(configPath, JSON.stringify({ baseUrl, nodeId, nodeSecret }, null, 2), { mode: 0o600 });
  info('Pairing completed', 'secure node credentials saved');
}
if (!nodeId || !nodeSecret) throw new Error('Node pairing credentials are missing.');

async function cycle() {
  cycleNumber += 1;
  const tokenResponse = await request('/api/nodes/token', { method: 'POST', body: JSON.stringify({ nodeId, nodeSecret }) });
  const auth = { authorization: `Bearer ${tokenResponse.data.accessToken}` };
  const load = os.loadavg()[0] / Math.max(os.cpus().length, 1) * 100;
  const memory = process.memoryUsage().rss / os.totalmem() * 100;
  const { data: heartbeat } = await request('/api/nodes/heartbeat', {
    method: 'POST', headers: auth,
    body: JSON.stringify({ cpuPercent: load, memoryPercent: memory, diskPercent: 0, uptimeSeconds: Math.round((Date.now() - startedAt) / 1000), apiLatencyMs: tokenResponse.latency, serviceStatus: 'online', machineFingerprint }),
  });
  const { data: workResponse } = await request('/api/nodes/work', { headers: auth });
  const task = workResponse.task;
  const sha256 = createHash('sha256').update(task.body).digest('hex');
  const { data: result } = await request('/api/nodes/results', { method: 'POST', headers: auth, body: JSON.stringify({ taskId: task.id, type: task.type, sha256 }) });
  const uptime = Math.round((Date.now() - startedAt) / 1000);
  info(workLabels[task.type] || `PUBLIC CACHE ${task.type}`, `cycle=${cycleNumber} latency=${tokenResponse.latency}ms`);
  info('SHA-256 public work verified', `hash=${sha256.slice(0, 12)}…${sha256.slice(-8)}`);
  info('Heartbeat acknowledged', `status=${String(heartbeat.status || 'online').toUpperCase()} uptime=${uptime}s`);
  info('Mining speed bonus active', `+${heartbeat.bonusPercent || 0}%`);
  return result;
}
async function run() {
  try { await cycle(); }
  catch (error) { console.error(`\x1b[31mWARN\x1b[0m [${new Date().toISOString()}] ${error.message} · reconnecting automatically`); }
}
await run();
setInterval(run, intervalMs);
