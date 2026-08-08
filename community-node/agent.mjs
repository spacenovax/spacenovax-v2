#!/usr/bin/env node
/** Minimal community-node agent. It never receives account, wallet, reward, or KYC data. */
import os from 'node:os';
import process from 'node:process';
import { createHash } from 'node:crypto';

const baseUrl = (process.env.COMMUNITY_NODE_URL || 'http://127.0.0.1:10100').replace(/\/$/, '');
const nodeId = process.env.COMMUNITY_NODE_ID;
const nodeSecret = process.env.COMMUNITY_NODE_SECRET;
if (!nodeId || !nodeSecret) throw new Error('COMMUNITY_NODE_ID and COMMUNITY_NODE_SECRET are required.');

const request = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, { headers: { 'content-type': 'application/json', ...(options.headers || {}) }, ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
};

const startedAt = Date.now();
const token = await request('/v1/nodes/token', { method: 'POST', body: JSON.stringify({ nodeId, nodeSecret }) });
const auth = { authorization: `Bearer ${token.accessToken}` };
const load = os.loadavg()[0] / Math.max(os.cpus().length, 1) * 100;
const memory = process.memoryUsage().rss / os.totalmem() * 100;
await request('/v1/nodes/heartbeat', { method: 'POST', headers: auth, body: JSON.stringify({ cpuPercent: load, memoryPercent: memory, diskPercent: 0, uptimeSeconds: Math.round((Date.now() - startedAt) / 1000), apiLatencyMs: 0, serviceStatus: 'online' }) });
const { task } = await request('/v1/nodes/work', { headers: auth });
const digest = createHash('sha256').update(task.body).digest('hex');
const result = await request('/v1/nodes/results', { method: 'POST', headers: auth, body: JSON.stringify({ taskId: task.id, type: task.type, sha256: digest }) });
console.log(JSON.stringify({ nodeId, task: task.type, verified: result.ok }, null, 2));
