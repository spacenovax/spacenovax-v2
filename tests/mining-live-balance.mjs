import { spawn } from 'node:child_process';
import fs from 'node:fs';

const port = String(34000 + (process.pid % 1000));
const base = `http://127.0.0.1:${port}`;
const dataFile = `/tmp/spnx-live-mining-${process.pid}.json`;
const server = spawn(process.execPath, ['server.js'], {
  cwd: new URL('..', import.meta.url),
  env: { ...process.env, PORT: port, DATA_FILE: dataFile, SESSION_SECRET: 'live-mining-test-secret' },
  stdio: ['ignore', 'ignore', 'inherit'],
});
process.once('exit', () => server.kill('SIGTERM'));

await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('Test server did not start.')), 5000);
  const poll = async () => {
    try { await fetch(`${base}/api/health`); clearTimeout(timeout); resolve(); }
    catch { setTimeout(poll, 50); }
  };
  poll();
});

const headers = { 'content-type': 'application/json', 'x-spnx-client-id': `live-${Date.now()}` };
async function request(path, body = {}) {
  const response = await fetch(`${base}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(`${path}: ${data.message || response.status}`);
  return data;
}

try {
  const before = await request('/api/session');
  const started = await request('/api/mining/start');
  const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  const user = data.users[started.user.id];
  // Simulate a real server-side elapsed interval without trusting the client.
  user.mining.startedAt = Date.now() - (60 * 60 * 1000);
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
  const after = await request('/api/session');
  const result = {
    initialSettledBalance: Number(before.user.balance) === 0,
    activeMining: after.user.mining?.active === true,
    timestampPresent: Number(after.user.mining?.calculatedAt) > 0,
    inProgressAmount: Number(after.user.mining?.minedSoFar) > 0,
    displayBalanceIncludesMining: Number(after.user.displayBalance) > Number(after.user.balance),
    ledgerBalanceUnchangedUntilClaim: Number(after.user.balance) === 0,
  };
  if (Object.values(result).some((value) => value !== true)) throw new Error(JSON.stringify(result));
  console.log(JSON.stringify(result));
} finally {
  server.kill('SIGTERM');
  fs.rmSync(dataFile, { force: true });
}
