import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';

const appPort = String(33000 + (process.pid % 1000));
const upstreamPort = String(34000 + (process.pid % 1000));
const base = `http://127.0.0.1:${appPort}`;
const upstreamBase = `http://127.0.0.1:${upstreamPort}`;
const dataFile = `/tmp/spnx-nova-free-first-${process.pid}.json`;
const upstreamRequests = [];
let activeUpstream = 0;
let maxActiveUpstream = 0;
const clientSource = fs.readFileSync(new URL('../src/V15App.jsx', import.meta.url), 'utf8');

if (!clientSource.includes('NovaAIRouter')
  || !clientSource.includes('novaVoiceRouter.ask')
  || !clientSource.includes('novaVoiceRouter.listen')
  || clientSource.includes("'/api/nova/speech'")) {
  throw new Error('Free-first NOVA client routing is missing.');
}

const upstream = http.createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  upstreamRequests.push({ url: req.url, headers: req.headers, body });
  activeUpstream += 1;
  maxActiveUpstream = Math.max(maxActiveUpstream, activeUpstream);
  setTimeout(() => {
    activeUpstream -= 1;
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text: 'NOVA AI test response.' }] } }] }));
  }, 25);
});
await new Promise((resolve) => upstream.listen(Number(upstreamPort), '127.0.0.1', resolve));

const server = spawn(process.execPath, ['server.js'], {
  cwd: new URL('..', import.meta.url),
  env: { ...process.env, PORT: appPort, DATA_FILE: dataFile, NODE_ENV: 'test', GEMINI_API_KEY: 'test-secret', GEMINI_MODEL: 'gemini-test-model', GEMINI_API_BASE_URL: upstreamBase },
  stdio: ['ignore', 'ignore', 'inherit'],
});
const cleanup = () => { server.kill('SIGTERM'); upstream.close(); fs.rmSync(dataFile, { force: true }); };
process.once('exit', cleanup);
await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('Test server did not start.')), 5000);
  const poll = async () => { try { await fetch(`${base}/api/health`); clearTimeout(timeout); resolve(); } catch { setTimeout(poll, 50); } };
  poll();
});

const makeHeaders = (suffix) => ({ 'content-type': 'application/json', 'x-spnx-client-id': `nova-free-first-${suffix}-${Date.now()}` });
const expectedKorean = 'NOVA AI는 현재 베타 개발 단계입니다.\n\n안정적인 서비스 제공을 위해 계정당 하루 10회까지 이용할 수 있습니다.\n\n내일 다시 이용해 주세요.\n\nSpaceNovaX를 응원해 주셔서 감사합니다.';
const expectedEnglish = 'NOVA AI is currently in the Beta development stage.\n\nTo ensure stable service for all community members, each account can use NOVA AI up to 10 times per day.\n\nPlease come back tomorrow.\n\nThank you for supporting SpaceNovaX.';

async function chat(headers, message, language = 'en') {
  return fetch(`${base}/api/nova/chat`, { method: 'POST', headers, body: JSON.stringify({ message, language, history: [] }) });
}

try {
  const status = await (await fetch(`${base}/api/nova/status`, { headers: makeHeaders('status') })).json();
  if (!status.configured || status.dailyLimit !== 10 || status.model !== 'NOVA Beta') throw new Error(`Unexpected NOVA status: ${JSON.stringify(status)}`);

  const voiceResponse = await fetch(`${base}/api/nova/speech`, { method: 'POST', headers: makeHeaders('voice'), body: JSON.stringify({ text: 'Welcome Captain' }) });
  if (voiceResponse.status !== 410 || (await voiceResponse.json()).code !== 'NOVA_LOCAL_VOICE_ONLY') throw new Error('Remote NOVA voice endpoint was not disabled.');

  const headers = makeHeaders('quota');
  for (let index = 0; index < 10; index += 1) {
    const response = await chat(headers, `Question ${index + 1}`, index === 0 ? 'es' : 'en');
    const body = await response.json();
    if (!response.ok || body.reply !== 'NOVA AI test response.' || body.usage?.used !== index + 1) throw new Error(`NOVA request ${index + 1} failed.`);
  }
  const limited = await chat(headers, '한 번 더', 'ko');
  const limitedBody = await limited.json();
  if (limited.status !== 429 || limitedBody.message !== expectedKorean) throw new Error('Korean daily limit copy mismatch.');

  const englishHeaders = makeHeaders('english');
  for (let index = 0; index < 10; index += 1) await chat(englishHeaders, `English quota ${index + 1}`);
  const englishLimited = await chat(englishHeaders, 'One more');
  const englishLimitedBody = await englishLimited.json();
  if (englishLimited.status !== 429 || englishLimitedBody.message !== expectedEnglish) throw new Error('English daily limit copy mismatch.');

  maxActiveUpstream = 0;
  const queuedHeaders = makeHeaders('queued');
  await Promise.all([chat(queuedHeaders, 'Queue one'), chat(queuedHeaders, 'Queue two')]);
  if (maxActiveUpstream !== 1) throw new Error(`Expected one upstream request per Captain at a time, received ${maxActiveUpstream}.`);
  if (upstreamRequests.some((request) => request.url.includes('interactions'))) throw new Error('Remote voice/audio provider was called.');
  if (upstreamRequests.some((request) => request.headers['x-goog-api-key'] !== 'test-secret')) throw new Error('NOVA server did not authenticate text provider correctly.');
  if (!upstreamRequests[0].body.system_instruction?.parts?.[0]?.text?.includes('Always identify yourself only as NOVA AI')) throw new Error('NOVA identity instruction missing.');
  console.log(JSON.stringify({ freeFirstVoice: true, remoteAudioDisabled: true, textOnlyFallback: true, perCaptainQueue: true, dailyLimit: true }));
} finally { cleanup(); }
