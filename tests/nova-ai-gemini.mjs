import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';

const appPort = String(33000 + (process.pid % 1000));
const upstreamPort = String(34000 + (process.pid % 1000));
const base = `http://127.0.0.1:${appPort}`;
const upstreamBase = `http://127.0.0.1:${upstreamPort}`;
const dataFile = `/tmp/spnx-v166-nova-${process.pid}.json`;
const upstreamRequests = [];

const upstream = http.createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  upstreamRequests.push({ url: req.url, headers: req.headers, body });
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({
    candidates: [{ content: { role: 'model', parts: [{ text: 'NOVA AI test response.' }] } }],
  }));
});
await new Promise((resolve) => upstream.listen(Number(upstreamPort), '127.0.0.1', resolve));

const server = spawn(process.execPath, ['server.js'], {
  cwd: new URL('..', import.meta.url),
  env: {
    ...process.env,
    PORT: appPort,
    DATA_FILE: dataFile,
    NODE_ENV: 'test',
    GEMINI_API_KEY: 'test-secret',
    GEMINI_MODEL: 'gemini-test-model',
    GEMINI_API_BASE_URL: upstreamBase,
  },
  stdio: ['ignore', 'ignore', 'inherit'],
});

const cleanup = () => {
  server.kill('SIGTERM');
  upstream.close();
  fs.rmSync(dataFile, { force: true });
};
process.once('exit', cleanup);

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

const headers = {
  'content-type': 'application/json',
  'x-spnx-client-id': `nova-qa-${Date.now()}`,
};

try {
  const statusResponse = await fetch(`${base}/api/nova/status`, { headers });
  const status = await statusResponse.json();
  if (!status.configured || status.model !== 'NOVA Beta' || status.dailyLimit !== 10) {
    throw new Error(`Unexpected NOVA status: ${JSON.stringify(status)}`);
  }

  for (let index = 0; index < 10; index += 1) {
    const response = await fetch(`${base}/api/nova/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: `Question ${index + 1}`,
        language: index === 0 ? 'es' : 'en',
        history: index ? [{ role: 'assistant', text: 'Previous NOVA answer' }] : [],
        captainContext: { id: `spoofed-${index}`, level: 999, balance: 999999 },
      }),
    });
    const body = await response.json();
    if (!response.ok || body.reply !== 'NOVA AI test response.' || body.usage?.used !== index + 1) {
      throw new Error(`NOVA request ${index + 1} failed: ${response.status} ${JSON.stringify(body)}`);
    }
  }

  const limitedResponse = await fetch(`${base}/api/nova/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message: '한 번 더', language: 'ko', captainContext: { id: 'another-spoof' } }),
  });
  const limited = await limitedResponse.json();
  const expectedKorean = 'NOVA AI는 현재 베타 개발 단계입니다.\n\n안정적인 서비스 제공을 위해 계정당 하루 10회까지 이용할 수 있습니다.\n\n내일 다시 이용해 주세요.\n\nSpaceNovaX를 응원해 주셔서 감사합니다.';
  if (limitedResponse.status !== 429 || limited.code !== 'NOVA_DAILY_LIMIT' || limited.message !== expectedKorean) {
    throw new Error(`Korean limit message mismatch: ${limitedResponse.status} ${JSON.stringify(limited)}`);
  }

  const englishHeaders = {
    ...headers,
    'x-spnx-client-id': `nova-qa-en-${Date.now()}`,
  };
  for (let index = 0; index < 10; index += 1) {
    const response = await fetch(`${base}/api/nova/chat`, {
      method: 'POST',
      headers: englishHeaders,
      body: JSON.stringify({ message: `English quota ${index + 1}`, language: 'en' }),
    });
    if (!response.ok) throw new Error(`English quota setup failed at request ${index + 1}.`);
  }
  const englishLimitedResponse = await fetch(`${base}/api/nova/chat`, {
    method: 'POST',
    headers: englishHeaders,
    body: JSON.stringify({ message: 'One more', language: 'en' }),
  });
  const englishLimited = await englishLimitedResponse.json();
  const expectedEnglish = 'NOVA AI is currently in the Beta development stage.\n\nTo ensure stable service for all community members, each account can use NOVA AI up to 10 times per day.\n\nPlease come back tomorrow.\n\nThank you for supporting SpaceNovaX.';
  if (englishLimitedResponse.status !== 429 || englishLimited.code !== 'NOVA_DAILY_LIMIT' || englishLimited.message !== expectedEnglish) {
    throw new Error(`English limit message mismatch: ${englishLimitedResponse.status} ${JSON.stringify(englishLimited)}`);
  }

  if (upstreamRequests.length !== 20) throw new Error(`Expected 20 upstream calls, received ${upstreamRequests.length}`);
  const first = upstreamRequests[0];
  if (first.headers['x-goog-api-key'] !== 'test-secret') throw new Error('NOVA server did not authenticate upstream correctly.');
  if (!first.url.includes('/v1beta/models/gemini-test-model:generateContent')) throw new Error(`Unexpected upstream URL: ${first.url}`);
  if (!first.body.system_instruction?.parts?.[0]?.text?.includes('Always identify yourself only as NOVA AI')) {
    throw new Error('NOVA identity instruction missing.');
  }
  if (first.body.contents?.at(-1)?.role !== 'user') throw new Error('Conversation payload was not converted correctly.');

  const stored = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  const userIds = new Set(stored.events.filter((event) => event.type === 'nova_chat').map((event) => event.userId));
  if (userIds.size !== 2 || [...userIds].some((userId) => userId.startsWith('spoofed-'))) {
    throw new Error('NOVA daily quota trusted client-provided identity.');
  }

  console.log(JSON.stringify({
    providerAdapter: true,
    publicIdentity: true,
    dailyLimit: true,
    koreanLimitCopy: true,
    englishLimitCopy: true,
    serverAccountIdentity: true,
    multilingualPrompt: true,
  }));
} finally {
  cleanup();
}
