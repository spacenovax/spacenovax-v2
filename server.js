import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import {
  broadcastSignedPayout,
  inspectSignedPayout,
  prepareSignedPayout,
  solanaPayoutConfig,
  validateSolanaAddress,
} from './lib/solanaPayout.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'spacenovax-data.json');
const COMMUNITY_MEDIA_DIR = process.env.COMMUNITY_MEDIA_DIR || path.join(__dirname, 'community-media');

const MINING_DURATION = 24 * 60 * 60 * 1000;
const BASE_MINING_REWARD = 30;
const GAME_DAILY_LIMIT = 30;
const NOVA_DAILY_LIMIT = 10;
const NOVA_PUBLIC_MODEL_NAME = 'NOVA Beta';
const NOVA_DEFAULT_MODEL = 'gemini-2.5-flash';
const NOVA_MAX_OUTPUT_TOKENS = Math.min(2048, Math.max(800, Number(process.env.NOVA_MAX_OUTPUT_TOKENS || 1400)));
const NOVA_MIN_COMPLETE_REPLY_CHARS = 120;
const NOVA_CHAT_TIMEOUT_MS = Math.min(60000, Math.max(10000, Number(process.env.NOVA_CHAT_TIMEOUT_MS || 35000)));
const NOVA_TTS_DEFAULT_MODEL = 'gemini-3.1-flash-tts-preview';
const NOVA_TTS_DEFAULT_FALLBACK_MODEL = 'gemini-2.5-flash-preview-tts';
const NOVA_TTS_API_REVISION = '2026-05-20';
const NOVA_TTS_MAX_TEXT_LENGTH = 1200;
const NOVA_TTS_RATE_WINDOW = 60 * 60 * 1000;
const NOVA_TTS_RATE_LIMIT = 30;
const novaTtsCache = new Map();
const novaTtsUsage = new Map();
const OFFICIAL_MISSION_IDS = ['website', 'telegram', 'discord', 'x', 'youtube_subscribe'];

const DEFAULT_MISSIONS = [
  { id: 'website', title: 'Visit SpaceNovaX Website', icon: '🌐', reward: 100, type: 'one_time', url: 'https://spacenovax.com', action: 'OPEN', enabled: true },
  { id: 'telegram', title: 'Join SpaceNovaX Telegram Channel', icon: '✈️', reward: 300, type: 'one_time', url: 'https://t.me/spacenovaxteam', action: 'JOIN CHANNEL', enabled: true },
  { id: 'discord', title: 'Join Discord', icon: '💬', reward: 300, type: 'one_time', url: 'https://discord.gg/rxVNWMC8e8', action: 'JOIN', enabled: true },
  { id: 'x', title: 'Follow X', icon: '𝕏', reward: 300, type: 'one_time', url: 'https://x.com/spacenovaxteam', action: 'FOLLOW', enabled: true },
  { id: 'youtube_subscribe', title: 'Subscribe YouTube', icon: '📺', reward: 300, type: 'one_time', url: 'https://youtube.com/@spacenovaxteam', action: 'SUBSCRIBE', enabled: true }
];

function now() {
  return Date.now();
}

function pcmToWave(pcm, sampleRate = 24000) {
  const header = Buffer.alloc(44);
  const dataSize = pcm.length;
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcm]);
}

function extractInteractionAudio(result) {
  const sdkAudio = result?.output_audio || result?.outputAudio;
  if (sdkAudio?.data) return sdkAudio;

  const steps = Array.isArray(result?.steps) ? result.steps : [];
  for (let stepIndex = steps.length - 1; stepIndex >= 0; stepIndex -= 1) {
    const content = Array.isArray(steps[stepIndex]?.content) ? steps[stepIndex].content : [];
    for (let contentIndex = content.length - 1; contentIndex >= 0; contentIndex -= 1) {
      const block = content[contentIndex];
      if ((block?.type === 'audio' || block?.mime_type?.startsWith('audio/')) && block?.data) {
        return block;
      }
    }
  }
  return null;
}

async function requestNovaSpeech({ apiBase, apiKey, model, prompt }) {
  const response = await fetch(`${apiBase}/v1beta/interactions`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
      'Api-Revision': NOVA_TTS_API_REVISION,
    },
    body: JSON.stringify({
      model,
      input: prompt,
      response_format: { type: 'audio' },
      generation_config: {
        speech_config: [{ voice: 'Kore' }],
      },
    }),
  });

  const result = await response.json().catch(() => ({}));
  return {
    ok: response.ok,
    status: response.status,
    message: result?.error?.message || '',
    audio: response.ok ? extractInteractionAudio(result) : null,
  };
}

const NOVA_LANGUAGE_NAMES = {
  en: 'English', ko: 'Korean', ja: 'Japanese', zh: 'Mandarin Chinese',
  es: 'Spanish', pt: 'Portuguese', de: 'German', fr: 'French',
  ru: 'Russian', vi: 'Vietnamese', id: 'Indonesian',
};

function normalizeNovaLanguage(value) {
  const locale = String(value || 'en').trim().toLowerCase().replace(/_/g, '-');
  const base = locale.split('-')[0];
  return Object.prototype.hasOwnProperty.call(NOVA_LANGUAGE_NAMES, base) ? base : 'en';
}

function extractNovaReply(result) {
  const candidates = Array.isArray(result?.candidates) ? result.candidates : [];
  for (const candidate of candidates) {
    const reply = (candidate?.content?.parts || [])
      .map((part) => String(part?.text || ''))
      .join('')
      .trim();
    if (reply) return { reply, finishReason: String(candidate?.finishReason || '') };
  }
  return { reply: '', finishReason: String(candidates[0]?.finishReason || '') };
}

function novaReplyNeedsExpansion(question, reply) {
  const normalizedQuestion = String(question || '').replace(/\s+/g, ' ').trim();
  const normalizedReply = String(reply || '').replace(/\s+/g, ' ').trim();
  if (!normalizedReply) return true;
  if (normalizedQuestion.length < 12) return false;
  if (/^(hi|hello|hey|thanks|thank you|안녕|고마워|감사|こんにちは|你好)[!.?\s]*$/iu.test(normalizedQuestion)) return false;
  return normalizedReply.length < NOVA_MIN_COMPLETE_REPLY_CHARS;
}

async function requestNovaChatCompletion({ endpoint, apiKey, systemInstruction, contents, generationConfig }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NOVA_CHAT_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents,
        generationConfig,
      }),
    });
    const result = await response.json().catch(() => ({}));
    const extracted = extractNovaReply(result);
    return {
      ok: response.ok,
      status: response.status,
      result,
      message: result?.error?.message || '',
      ...extracted,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function readData() {
  if (!fs.existsSync(DATA_FILE)) {
    const initial = {
      users: {},
      events: [],
      ledger: [],
      ledgerKeys: {},
      walletChallenges: {},
      convertRequests: [],
      payouts: [],
      payoutKeys: {},
      distributions: [],
      fleetMessages: [],
      fleetNotifications: [],
      fleetWeeklySettlements: {},
      communityPosts: [],
      communityReports: [],
      missions: DEFAULT_MISSIONS,
      settings: {
        convertEnabled: false,
        kycEnabled: false,
        autoPayoutEnabled: false,
        pointToTokenRate: 1,
        minConvert: 5000,
        fleetBonusPerActiveReferral: 5,
        fleetMaxMembers: 1000,
        activeFleetDays: 7,
        gameRewardsEnabled: true,
        gameDailyLimit: GAME_DAILY_LIMIT,
        novaAiEnabled: true,
        novaDailyMessageLimit: NOVA_DAILY_LIMIT,
        maintenanceMode: false,
        totalSupply: 10000000000,
        miningPool: 3500000000
      }
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }

  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  data.users ||= {};
  data.events ||= [];
  data.ledger ||= [];
  data.ledgerKeys ||= {};
  data.missions ||= DEFAULT_MISSIONS;
  data.settings ||= {};

  const existingMissions = Object.fromEntries((data.missions || []).map((mission) => [mission.id, mission]));
  data.missions = DEFAULT_MISSIONS.map((defaults) => ({
    ...defaults,
    ...(existingMissions[defaults.id] || {}),
    reward: Number(existingMissions[defaults.id]?.reward ?? defaults.reward),
    enabled: existingMissions[defaults.id]?.enabled ?? defaults.enabled,
  }));

  data.settings.miningSandboxEnabled ??= false;
  data.settings.miningSandboxMinutes ??= 5;
  data.settings.eventMultiplier ??= 1;
  data.settings.miningEngineVersion ??= '1.0.0';
  data.settings.gameRewardsEnabled ??= true;
  data.settings.gameDailyLimit = GAME_DAILY_LIMIT;
  data.settings.novaAiEnabled ??= true;
  data.settings.novaDailyMessageLimit = NOVA_DAILY_LIMIT;
  data.settings.maintenanceMode ??= false;
  data.settings.fleetBonusPerActiveReferral = 5;
  data.settings.fleetMaxMembers ??= 1000;
  data.settings.kycEnabled ??= false;
  data.settings.convertEnabled ??= false;
  data.settings.autoPayoutEnabled ??= false;
  data.walletChallenges ||= {};
  data.payouts ||= [];
  data.payoutKeys ||= {};
  data.fleetMessages ||= [];
  data.fleetNotifications ||= [];
  data.fleetWeeklySettlements ||= {};
  data.communityPosts ||= [];
  data.communityReports ||= [];
  for (const user of Object.values(data.users || {})) {
    user.referralCode ||= makeReferralCode(user.id);
    user.referrals ||= [];
    user.securityCircle ||= [];
    user.missionOpens ||= {};
    user.kyc ||= { status: 'not_available', available: false };
  }
  if (!data.settings.v15SeedBalanceMigrated) {
    for (const user of Object.values(data.users || {})) {
      const hasEarnedHistory =
        Number(user.totalMined || 0) > 0 ||
        Object.keys(user.missions || {}).length > 0 ||
        Object.keys(user.missionClaims || {}).length > 0;
      if (Number(user.balance) === 15250 && !hasEarnedHistory) user.balance = 0;
    }
    data.settings.v15SeedBalanceMigrated = true;
  }
  data.convertRequests ||= [];
  data.distributions ||= [];
  return data;
}

function writeData(data) {
  const tempFile = `${DATA_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2));
  fs.renameSync(tempFile, DATA_FILE);
}

function roundPoints(value) {
  return Number(Number(value || 0).toFixed(8));
}

function appendLedger(data, user, { type, amount, idempotencyKey, reference = '', metadata = {} }) {
  data.ledger ||= [];
  data.ledgerKeys ||= {};
  const key = String(idempotencyKey || '').trim();
  if (!key) throw new Error('Ledger idempotency key is required.');
  if (data.ledgerKeys[key]) {
    return data.ledger.find((entry) => entry.id === data.ledgerKeys[key]) || null;
  }

  const signedAmount = roundPoints(amount);
  const nextBalance = roundPoints(Number(user.balance || 0) + signedAmount);
  if (nextBalance < 0) throw new Error('Insufficient SPNX Point balance.');

  const previous = data.ledger[data.ledger.length - 1];
  const entry = {
    id: crypto.randomUUID(),
    sequence: data.ledger.length + 1,
    userId: user.id,
    type: String(type),
    amount: signedAmount,
    balanceAfter: nextBalance,
    reference: String(reference || ''),
    metadata,
    idempotencyKey: key,
    at: now(),
    previousHash: previous?.hash || 'GENESIS'
  };
  entry.hash = crypto.createHash('sha256').update(JSON.stringify(entry)).digest('hex');
  user.balance = nextBalance;
  user.updatedAt = entry.at;
  data.ledger.push(entry);
  data.ledgerKeys[key] = entry.id;
  return entry;
}

function verifyLedgerIntegrity(data) {
  let previousHash = 'GENESIS';
  const ledger = data.ledger || [];
  for (let index = 0; index < ledger.length; index += 1) {
    const entry = ledger[index];
    const { hash, ...unsigned } = entry;
    const expected = crypto.createHash('sha256').update(JSON.stringify(unsigned)).digest('hex');
    if (entry.sequence !== index + 1) return { valid: false, count: ledger.length, index, entryId: entry.id, reason: 'sequence_mismatch' };
    if (entry.previousHash !== previousHash) return { valid: false, count: ledger.length, index, entryId: entry.id, reason: 'previous_hash_mismatch' };
    if (hash !== expected) return { valid: false, count: ledger.length, index, entryId: entry.id, reason: 'entry_hash_mismatch' };
    if (data.ledgerKeys?.[entry.idempotencyKey] !== entry.id) return { valid: false, count: ledger.length, index, entryId: entry.id, reason: 'idempotency_index_mismatch' };
    previousHash = hash;
  }
  return { valid: true, count: ledger.length, headHash: previousHash };
}

function securityCircleCount(data, user) {
  return (user.securityCircle || [])
    .filter((id) => data.users[id] && String(data.users[id].kyc?.status || '').toLowerCase() === 'approved')
    .slice(0, 5).length;
}

function communityPostPermission(data, user) {
  const circleCount = securityCircleCount(data, user);
  return { allowed: circleCount >= 5 && !user.banned, circleCount, required: 5 };
}

function publicCommunityPost(data, post, viewerId = '') {
  const author = data.users[post.authorId];
  return {
    id: post.id,
    category: post.category,
    title: post.title,
    body: post.body,
    imageUrl: post.imageUrl || '',
    createdAt: post.createdAt,
    author: { id: post.authorId, firstName: author?.firstName || post.authorName || 'Captain', fleetGrade: fleetGrade(getActiveFleetCount(data, post.authorId)) },
    likes: (post.likes || []).length,
    liked: (post.likes || []).includes(viewerId),
    comments: (post.comments || []).slice(-30),
    status: post.status || 'published'
  };
}

function makeGuestUser(clientId = '') {
  const stableId = String(clientId || '').trim();
  const suffix = stableId
    ? crypto.createHash('sha256').update(stableId).digest('hex').slice(0, 16)
    : crypto.randomBytes(8).toString('hex');
  return {
    id: `guest-${suffix}`,
    telegramId: null,
    username: 'guest',
    firstName: 'Space Explorer',
    lastName: '',
    isGuest: true
  };
}

function normalizeTelegramUser(raw) {
  if (!raw?.id) return makeGuestUser(raw?.clientId);
  return {
    id: `tg-${raw.id}`,
    telegramId: String(raw.id),
    username: raw.username || '',
    firstName: raw.first_name || raw.firstName || 'Space Explorer',
    lastName: raw.last_name || '',
    isGuest: false
  };
}

function verifiedTelegramUser(req) {
  const initData = String(req.headers['x-telegram-init-data'] || '');
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!initData || !botToken) return null;
  try {
    const params = new URLSearchParams(initData);
    const receivedHash = params.get('hash') || '';
    params.delete('hash');
    const authDate = Number(params.get('auth_date') || 0);
    if (!authDate || Math.abs(Math.floor(Date.now() / 1000) - authDate) > 24 * 60 * 60) return null;
    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const expectedHash = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
    if (!safeEqual(receivedHash, expectedHash)) return null;
    const user = JSON.parse(params.get('user') || '{}');
    return user?.id ? user : null;
  } catch {
    return null;
  }
}

function makeReferralCode(userId = '') {
  return crypto.createHash('sha256').update(`SPNX:${userId}`).digest('hex').slice(0, 8).toUpperCase();
}

function findUserByReferralCode(data, code = '') {
  const normalized = String(code).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return Object.values(data.users || {}).find((user) => String(user.referralCode || makeReferralCode(user.id)).toUpperCase() === normalized);
}

function fleetBonusPercent(activeFleet, data) {
  const perMember = Number(data?.settings?.fleetBonusPerActiveReferral ?? 5);
  const maxMembers = Number(data?.settings?.fleetMaxMembers ?? 1000);
  return Math.max(0, Math.min(maxMembers, Number(activeFleet || 0))) * perMember;
}

function fleetGrade(activeFleet) {
  if (activeFleet >= 1000) return 'Nova Command';
  if (activeFleet >= 500) return 'Diamond Fleet';
  if (activeFleet >= 250) re