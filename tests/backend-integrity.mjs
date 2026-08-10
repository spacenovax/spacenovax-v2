import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const port = String(32000 + (process.pid % 1000));
const base = process.env.TEST_BASE_URL || `http://127.0.0.1:${port}`;
const dataFile = `/tmp/spnx-v165-integrity-${process.pid}.json`;
const server = spawn(process.execPath, ['server.js'], {
  cwd: new URL('..', import.meta.url),
  env: {
    ...process.env,
    PORT: port,
    DATA_FILE: dataFile,
    ADMIN_ID: 'admin',
    ADMIN_PASSWORD: 'test-admin-password',
    SESSION_SECRET: 'test-session-secret',
  },
  stdio: ['ignore', 'ignore', 'inherit'],
});
process.once('exit', () => server.kill('SIGTERM'));
await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('Test server did not start.')), 5000);
  server.once('error', reject);
  const poll = async () => {
    try {
      await fetch(`${base}/api/health`);
      clearTimeout(timeout);
      resolve();
    } catch {
      setTimeout(poll, 50);
    }
  };
  poll();
});

const clientId = `qa-${Date.now()}`;
const headers = { 'content-type': 'application/json', 'x-spnx-client-id': clientId };

async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, options);
  const body = await response.json();
  if (!response.ok) throw new Error(`${path}: ${response.status} ${body.message || JSON.stringify(body)}`);
  return body;
}

const session = await request('/api/session', { method: 'POST', headers, body: '{}' });
const walletPin = await request('/api/nova-wallet/pin/setup', {
  method: 'POST',
  headers,
  body: JSON.stringify({ pin: '123456' }),
});
const biometricOptions = await request('/api/nova-wallet/biometric/register/options', {
  method: 'POST',
  headers,
  body: '{}',
});
const keypair = nacl.sign.keyPair();
const wallet = bs58.encode(keypair.publicKey);
const challenge = await request('/api/wallet/challenge', {
  method: 'POST',
  headers,
  body: JSON.stringify({ wallet }),
});
const signature = Buffer.from(nacl.sign.detached(Buffer.from(challenge.message), keypair.secretKey)).toString('base64');
const verification = await request('/api/wallet/verify', {
  method: 'POST',
  headers,
  body: JSON.stringify({ wallet, signature: `base64:${signature}` }),
});

const login = await request('/api/admin/login', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ id: 'admin', password: 'test-admin-password' }),
});
const adminHeaders = { 'content-type': 'application/json', authorization: `Bearer ${login.token}` };
await request('/api/admin/points', {
  method: 'POST',
  headers: adminHeaders,
  body: JSON.stringify({ userId: session.user.id, amount: 100, reason: 'integration-test' }),
});
const seeded = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
const requestId = 'cv-integration-cancel';
const payoutId = 'po-integration-cancel';
seeded.convertRequests.push({
  id: requestId,
  userId: session.user.id,
  pointAmount: 10,
  tokenAmount: 10,
  wallet,
  status: 'queued',
  createdAt: Date.now(),
  updatedAt: Date.now(),
});
seeded.payouts.push({
  id: payoutId,
  requestId,
  userId: session.user.id,
  pointAmount: 10,
  tokenAmount: 10,
  wallet,
  status: 'queued',
  attempts: 0,
  createdAt: Date.now(),
  updatedAt: Date.now(),
});
seeded.payoutKeys[requestId] = payoutId;
fs.writeFileSync(dataFile, JSON.stringify(seeded, null, 2));
await request('/api/admin/convert/update', {
  method: 'POST',
  headers: adminHeaders,
  body: JSON.stringify({ id: requestId, action: 'cancel', reason: 'integration-test' }),
});
const originalUrl = 'https://t.me/spacenovaxteam';
await request('/api/admin/mission/update', {
  method: 'POST',
  headers: adminHeaders,
  body: JSON.stringify({ id: 'telegram', url: originalUrl }),
});
const missions = await request('/api/admin/missions', { headers: adminHeaders });
const operations = await request('/api/admin/operations', { headers: adminHeaders });
const queue = await request('/api/admin/convert-queue', { headers: adminHeaders });

const gateResponse = await fetch(`${base}/api/convert/request`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ amount: 10 }),
});
const gate = await gateResponse.json();

const result = {
  freshSession: Boolean(session.user?.id),
  walletPinSecured: Boolean(walletPin.security?.pinConfigured),
  biometricOptionsSecured: Boolean(biometricOptions.challengeId && biometricOptions.options?.challenge && biometricOptions.options?.authenticatorSelection?.userVerification === 'required'),
  walletVerified: Boolean(verification.user?.walletVerified),
  missionUrlPersisted: missions.missions.find((item) => item.id === 'telegram')?.url === originalUrl,
  cancelRelease: queue.queue.find((item) => item.id === requestId)?.status === 'cancelled',
  ledgerIntegrity: operations.operations?.system?.ledgerIntegrity?.valid,
  payoutSafetyGate: gateResponse.status === 400 && /not active/i.test(gate.message || ''),
};
try {
  if (Object.values(result).some((value) => value !== true)) throw new Error(JSON.stringify(result));
  console.log(JSON.stringify(result));
} finally {
  server.kill('SIGTERM');
  fs.rmSync(dataFile, { force: true });
}
