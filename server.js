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
const NOVA_TTS_DEFAULT_MODEL = 'gemini-3.1-flash-tts-preview';
const NOVA_TTS_FALLBACK_MODEL = 'gemini-2.5-flash-preview-tts';
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
  if (activeFleet >= 250) return 'Platinum Fleet';
  if (activeFleet >= 100) return 'Gold Fleet';
  if (activeFleet >= 25) return 'Silver Fleet';
  if (activeFleet >= 5) return 'Bronze Fleet';
  return 'Explorer Fleet';
}

function getActiveFleetCount(data, userId) {
  const cutoff = now() - 7 * 24 * 60 * 60 * 1000;
  return Object.values(data.users).filter((u) => u.referredBy === userId && (u.lastMiningAt || 0) >= cutoff).length;
}

function miningPhase(data) {
  const used = getMiningPoolUsed(data);
  const pool = data.settings?.miningPool || 3500000000;
  const ratio = pool > 0 ? used / pool : 0;
  if (ratio >= 0.9) return { phase: 5, reward: 4.8, used, pool, ratio, multiplier: 0.2 };
  if (ratio >= 0.75) return { phase: 4, reward: 9.6, used, pool, ratio, multiplier: 0.4 };
  if (ratio >= 0.5) return { phase: 3, reward: 14.4, used, pool, ratio, multiplier: 0.6 };
  if (ratio >= 0.25) return { phase: 2, reward: 19.2, used, pool, ratio, multiplier: 0.8 };
  return { phase: 1, reward: BASE_MINING_REWARD, used, pool, ratio, multiplier: 1 };
}

function ensureUser(data, telegramUser, referralCode = '') {
  const tUser = normalizeTelegramUser(telegramUser);
  const userId = tUser.id;

  if (!data.users[userId]) {
    const referralOwner = referralCode ? findUserByReferralCode(data, referralCode) || data.users[referralCode] : null;
    const referrer = referralOwner?.id || null;
    data.users[userId] = {
      ...tUser,
      balance: 0,
      totalMined: 0,
      exp: 850,
      level: 7,
      rankTitle: 'Captain',
      mining: null,
      missions: {},
      referredBy: referrer,
      referralCode: makeReferralCode(userId),
      referrals: [],
      solanaWallet: '',
      createdAt: now(),
      updatedAt: now(),
      lastMiningAt: 0
    };

    if (referrer) {
      data.users[referrer].referrals ||= [];
      if (!data.users[referrer].referrals.includes(userId)) data.users[referrer].referrals.push(userId);
    }

    data.events.push({ type: 'user_created', userId, referredBy: referrer, at: now() });
  } else {
    data.users[userId] = { ...data.users[userId], ...tUser, updatedAt: now() };
  }

  return data.users[userId];
}


function getMiningDuration(data) {
  if (data.settings?.miningSandboxEnabled) return Math.max(1, Number(data.settings?.miningSandboxMinutes || 5)) * 60 * 1000;
  return MINING_DURATION;
}
function getMiningPoolUsed(data) {
  return Object.values(data.users || {}).reduce((sum, user) => sum + Number(user.totalMined || 0), 0);
}
function getMiningPoolRemaining(data) {
  const pool = Number(data.settings?.miningPool || 3500000000);
  return Math.max(0, pool - getMiningPoolUsed(data));
}
function miningSpeedPerHour(data, user) {
  const phase = miningPhase(data);
  const activeFleet = getActiveFleetCount(data, user.id);
  const fleetBonus = fleetBonusPercent(activeFleet, data);
  const securityCircle = (user.securityCircle || [])
    .map((id) => data.users[id])
    .filter((member) => member && String(member.kyc?.status || '').toLowerCase() === 'approved')
    .slice(0, 5);
  const securityBonus = securityCircle.length;
  const missionPassportComplete = OFFICIAL_MISSION_IDS.every((id) => Boolean(user.missionClaims?.[id]));
  const missionBonus = missionPassportComplete ? 5 : 0;
  const eventMultiplier = Number(data.settings?.eventMultiplier || 1);
  const duration = getMiningDuration(data);
  const basePerHour = phase.reward / 24;
  const finalPerHour = basePerHour * (1 + (fleetBonus + securityBonus + missionBonus) / 100) * eventMultiplier;
  return { basePerHour, finalPerHour: Number(finalPerHour.toFixed(8)), fleetBonus, securityBonus, securityCircleCount: securityCircle.length, missionBonus, missionPassportComplete, activeFleet, phase: phase.phase, eventMultiplier, duration };
}
function miningRewardForCycle(data, user) {
  const speed = miningSpeedPerHour(data, user);
  const hours = speed.duration / (60 * 60 * 1000);
  const amount = speed.finalPerHour * hours;
  const remaining = getMiningPoolRemaining(data);
  return Number(Math.max(0, Math.min(amount, remaining)).toFixed(8));
}

function calculateMining(data, user) {
  const speed = miningSpeedPerHour(data, user);
  const reward = miningRewardForCycle(data, user);
  const duration = speed.duration;
  if (!user.mining?.active) {
    return { active: false, reward, baseReward: miningPhase(data).reward, speedPerHour: speed.finalPerHour, baseSpeedPerHour: speed.basePerHour, fleetBonus: speed.fleetBonus, securityBonus: speed.securityBonus, securityCircleCount: speed.securityCircleCount, missionBonus: speed.missionBonus, missionPassportComplete: speed.missionPassportComplete, activeFleet: speed.activeFleet, phase: speed.phase, eventMultiplier: speed.eventMultiplier, durationMs: duration, remainingMs: duration, progress: 0, minedSoFar: 0, claimable: false, sandbox: Boolean(data.settings?.miningSandboxEnabled), engineVersion: data.settings?.miningEngineVersion || '1.0.0' };
  }
  const startedAt = Number(user.mining.startedAt || now());
  const endsAt = startedAt + duration;
  const remainingMs = Math.max(0, endsAt - now());
  const progress = Math.min(1, Math.max(0, (now() - startedAt) / duration));
  const minedSoFar = Number((reward * progress).toFixed(8));
  return { active: remainingMs > 0, startedAt, endsAt, remainingMs, progress, minedSoFar, reward, baseReward: miningPhase(data).reward, speedPerHour: speed.finalPerHour, baseSpeedPerHour: speed.basePerHour, fleetBonus: speed.fleetBonus, securityBonus: speed.securityBonus, securityCircleCount: speed.securityCircleCount, missionBonus: speed.missionBonus, missionPassportComplete: speed.missionPassportComplete, activeFleet: speed.activeFleet, phase: speed.phase, eventMultiplier: speed.eventMultiplier, durationMs: duration, claimable: remainingMs <= 0, sandbox: Boolean(data.settings?.miningSandboxEnabled), engineVersion: data.settings?.miningEngineVersion || '1.0.0' };
}

function publicUser(data, user) {
  const activeFleet = getActiveFleetCount(data, user.id);
  const bonus = fleetBonusPercent(activeFleet, data);

  return {
    id: user.id,
    telegramId: user.telegramId,
    username: user.username,
    firstName: user.firstName,
    isGuest: user.isGuest,
    balance: Number(user.balance || 0),
    totalMined: Number(user.totalMined || 0),
    exp: user.exp,
    level: user.level,
    rankTitle: user.rankTitle,
    missions: user.missions || {},
    missionPassportComplete: OFFICIAL_MISSION_IDS.every((id) => Boolean(user.missionClaims?.[id])),
    missionBonus: OFFICIAL_MISSION_IDS.every((id) => Boolean(user.missionClaims?.[id])) ? 5 : 0,
    referredBy: user.referredBy,
    referralCode: user.referralCode || makeReferralCode(user.id),
    referrals: user.referrals || [],
    securityCircle: user.securityCircle || [],
    securityCircleCount: (user.securityCircle || []).filter((id) => data.users[id] && String(data.users[id].kyc?.status || '').toLowerCase() === 'approved').slice(0, 5).length,
    securityCircleBonus: (user.securityCircle || []).filter((id) => data.users[id] && String(data.users[id].kyc?.status || '').toLowerCase() === 'approved').slice(0, 5).length,
    activeFleet,
    fleetBonus: bonus,
    fleetGrade: fleetGrade(activeFleet),
    fleetMaxMembers: Number(data.settings?.fleetMaxMembers || 1000),
    fleetBonusPerMember: Number(data.settings?.fleetBonusPerActiveReferral || 5),
    mining: calculateMining(data, user),
    gameReward: user.gameReward || { date: gameRewardWindowKey(), earnedToday: 0, bestScore: 0, breakdown: {} },
    solanaWallet: user.solanaWallet || '',
    walletVerified: Boolean(user.walletVerifiedAt && user.verifiedSolanaWallet === user.solanaWallet),
    walletVerifiedAt: Number(user.walletVerifiedAt || 0),
    kyc: user.kyc || { status: 'not_available', available: false },
    conversionAvailable: Boolean(data.settings?.convertEnabled && data.settings?.kycEnabled)
  };
}

function getSessionUser(req, data) {
  const telegramUser = verifiedTelegramUser(req);
  const clientId = String(req.headers['x-spnx-client-id'] || req.body?.clientId || '');
  const fallbackUser = IS_PRODUCTION ? { clientId } : (req.body?.telegramUser || { clientId });
  const user = ensureUser(data, telegramUser || fallbackUser, req.body?.ref || req.query?.ref || '');
  return user;
}

function requireVerifiedCaptain(user, res) {
  if (IS_PRODUCTION && (user.isGuest || !user.telegramId)) {
    res.status(401).json({
      ok: false,
      message: 'Open SpaceNovaX from the official Telegram Mini App to earn SPNX Points.'
    });
    return false;
  }
  if (user.banned) {
    res.status(403).json({ ok: false, message: 'Account is restricted.' });
    return false;
  }
  return true;
}

function walletVerificationMessage(userId, challenge) {
  return [
    'SpaceNovaX wallet verification',
    `Captain: ${userId}`,
    `Nonce: ${challenge.nonce}`,
    `Expires: ${challenge.expiresAt}`,
  ].join('\n');
}

function kycRuntimeReady() {
  return String(process.env.KYC_WEBHOOK_ENABLED || '').toLowerCase() === 'true'
    && Boolean(process.env.KYC_WEBHOOK_SECRET);
}

function conversionRuntimeStatus(data) {
  const solana = solanaPayoutConfig();
  return {
    kycRuntimeReady: kycRuntimeReady(),
    solana,
    kycEnabled: Boolean(data.settings?.kycEnabled),
    convertEnabled: Boolean(data.settings?.convertEnabled),
    autoPayoutEnabled: Boolean(data.settings?.autoPayoutEnabled),
    ready: Boolean(
      kycRuntimeReady()
      && solana.enabled
      && solana.valid
      && data.settings?.kycEnabled
      && data.settings?.convertEnabled
      && data.settings?.autoPayoutEnabled
    ),
  };
}

function publicPayout(payout) {
  if (!payout) return null;
  const {
    signedTransactionBase64,
    blockhash,
    ...safe
  } = payout;
  return safe;
}

const payoutLocks = new Set();
async function processPayout(payoutId, trigger = 'automatic') {
  if (payoutLocks.has(payoutId)) return { skipped: true, reason: 'already_processing' };
  payoutLocks.add(payoutId);
  try {
    let data = readData();
    const runtime = conversionRuntimeStatus(data);
    if (!runtime.ready) throw new Error('Automatic Solana payout is not fully enabled.');
    let payout = (data.payouts || []).find((item) => item.id === payoutId);
    if (!payout) throw new Error('Payout not found.');
    if (payout.status === 'completed') return publicPayout(payout);
    const request = (data.convertRequests || []).find((item) => item.id === payout.requestId);
    const user = data.users?.[payout.userId];
    if (!request || !user) throw new Error('Payout user or conversion request is missing.');
    if (String(user.kyc?.status || '').toLowerCase() !== 'approved') throw new Error('KYC is not approved.');
    if (!user.walletVerifiedAt || user.verifiedSolanaWallet !== payout.wallet) throw new Error('Wallet ownership is not verified.');
    if (!validateSolanaAddress(payout.wallet)) throw new Error('Recipient wallet is invalid.');

    if (payout.status === 'broadcasting' && payout.txSignature) {
      const inspection = await inspectSignedPayout(payout);
      if (inspection.state === 'confirmed') {
        data = readData();
        payout = data.payouts.find((item) => item.id === payoutId);
        payout.status = 'completed';
        payout.confirmedAt = now();
        payout.updatedAt = now();
        payout.lastError = '';
        const latestRequest = data.convertRequests.find((item) => item.id === payout.requestId);
        latestRequest.status = 'completed';
        latestRequest.txSignature = payout.txSignature;
        latestRequest.completedAt = payout.confirmedAt;
        latestRequest.updatedAt = now();
        data.events.push({ type: 'solana_payout_completed', payoutId, userId: payout.userId, txSignature: payout.txSignature, trigger, at: now() });
        writeData(data);
        return publicPayout(payout);
      }
      if (inspection.state === 'expired' || inspection.state === 'failed') {
        data = readData();
        payout = data.payouts.find((item) => item.id === payoutId);
        payout.status = 'needs_review';
        payout.lastError = inspection.state === 'expired' ? 'Signed transaction expired before confirmation.' : inspection.error;
        payout.updatedAt = now();
        data.events.push({ type: 'solana_payout_review', payoutId, state: inspection.state, trigger, at: now() });
        writeData(data);
        return publicPayout(payout);
      }
      if (inspection.state === 'pending') return publicPayout(payout);
    }

    if (payout.status === 'queued' || payout.status === 'retry') {
      const prepared = await prepareSignedPayout({
        payoutId: payout.id,
        recipientAddress: payout.wallet,
        tokenAmount: payout.tokenAmount,
      });
      data = readData();
      payout = data.payouts.find((item) => item.id === payoutId);
      if (!payout || !['queued', 'retry'].includes(payout.status)) return publicPayout(payout);
      Object.assign(payout, prepared, {
        status: 'broadcasting',
        attempts: Number(payout.attempts || 0) + 1,
        updatedAt: now(),
        lastError: '',
      });
      data.events.push({ type: 'solana_payout_prepared', payoutId, userId: payout.userId, txSignature: payout.txSignature, trigger, at: now() });
      writeData(data); // Persist the signed transaction before network broadcast.
    }

    const result = await broadcastSignedPayout(payout);
    data = readData();
    payout = data.payouts.find((item) => item.id === payoutId);
    payout.status = 'completed';
    payout.confirmedAt = result.confirmedAt;
    payout.updatedAt = now();
    payout.lastError = '';
    const latestRequest = data.convertRequests.find((item) => item.id === payout.requestId);
    latestRequest.status = 'completed';
    latestRequest.txSignature = result.signature;
    latestRequest.completedAt = result.confirmedAt;
    latestRequest.updatedAt = now();
    data.events.push({ type: 'solana_payout_completed', payoutId, userId: payout.userId, txSignature: result.signature, trigger, at: now() });
    writeData(data);
    return publicPayout(payout);
  } catch (error) {
    const data = readData();
    const payout = (data.payouts || []).find((item) => item.id === payoutId);
    if (payout && payout.status !== 'completed') {
      payout.lastError = String(error.message || error).slice(0, 500);
      payout.updatedAt = now();
      payout.attempts = Number(payout.attempts || 0) + (payout.status === 'queued' ? 1 : 0);
      if (Number(payout.attempts || 0) >= 3 && payout.status === 'queued') payout.status = 'needs_review';
      data.events.push({ type: 'solana_payout_error', payoutId, error: payout.lastError, trigger, at: now() });
      writeData(data);
    }
    throw error;
  } finally {
    payoutLocks.delete(payoutId);
  }
}

function gameRewardSignatureValid(req, user) {
  const secret = process.env.GAME_REWARD_SECRET;
  if (!secret) return !IS_PRODUCTION;
  const eventId = String(req.body?.eventId || '');
  const score = Math.max(0, Number(req.body?.score || 0));
  const reward = Math.max(0, Number(req.body?.reward || 0));
  const rewardType = String(req.body?.rewardType || '');
  const completedAt = Number(req.body?.completedAt || 0);
  if (!eventId || !completedAt || Math.abs(now() - completedAt) > 10 * 60 * 1000) return false;
  const payload = `${user.id}:${eventId}:${rewardType}:${score}:${reward}:${completedAt}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return safeEqual(req.headers['x-spnx-game-signature'] || '', expected);
}

function gameRewardWindowKey(timestamp = Date.now()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date(timestamp)).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  if (Number(parts.hour) >= 6) return `${parts.year}-${parts.month}-${parts.day}`;
  const previous = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) - 1));
  return previous.toISOString().slice(0, 10);
}

function fleetCaptainId(data, user) {
  return user.referredBy && data.users[user.referredBy] ? user.referredBy : user.id;
}

function fleetMembers(data, captainId) {
  const captain = data.users[captainId];
  if (!captain) return [];
  const ids = [captainId, ...(captain.referrals || []).slice(0, Number(data.settings?.fleetMaxMembers || 1000))];
  return ids.map((id) => data.users[id]).filter(Boolean);
}

function weekWindow(offset = 0) {
  const date = new Date();
  const day = (date.getUTCDay() + 6) % 7;
  const start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - day + offset * 7);
  return { start, end: start + 7 * 86400000, key: new Date(start).toISOString().slice(0, 10) };
}

function fleetScore(data, captainId, window = weekWindow(0)) {
  const memberIds = new Set(fleetMembers(data, captainId).map((member) => member.id));
  return (data.events || [])
    .filter((event) => event.type === 'game_reward' && event.at >= window.start && event.at < window.end && memberIds.has(event.userId))
    .reduce((sum, event) => sum + Number(event.score || 0), 0);
}

function fleetRanking(data, window = weekWindow(0)) {
  return Object.values(data.users || {})
    .filter((user) => (user.referrals || []).length > 0)
    .map((captain) => ({
      captainId: captain.id,
      captainName: captain.firstName || 'Captain',
      fleetCode: captain.referralCode || makeReferralCode(captain.id),
      members: fleetMembers(data, captain.id).length,
      score: fleetScore(data, captain.id, window)
    }))
    .filter((fleet) => fleet.score > 0)
    .sort((a, b) => b.score - a.score || b.members - a.members);
}

function settlePreviousFleetWeek(data) {
  const window = weekWindow(-1);
  if (data.fleetWeeklySettlements?.[window.key]) return;
  const ranking = fleetRanking(data, window);
  if (!ranking.length) return;
  const rewards = [10, 5, 3];
  const winners = ranking.slice(0, 3).map((fleet, index) => {
    const reward = rewards[index];
    const members = fleetMembers(data, fleet.captainId);
    for (const member of members) {
      const ledgerEntry = appendLedger(data, member, {
        type: 'fleet_weekly_reward',
        amount: reward,
        idempotencyKey: `fleet-week:${window.key}:${fleet.captainId}:${member.id}`,
        reference: window.key,
        metadata: { captainId: fleet.captainId, rank: index + 1 }
      });
      data.events.push({ type: 'fleet_weekly_reward', userId: member.id, captainId: fleet.captainId, rank: index + 1, reward, week: window.key, ledgerId: ledgerEntry?.id, at: now() });
    }
    return { ...fleet, rank: index + 1, reward, recipients: members.length };
  });
  data.fleetWeeklySettlements[window.key] = { week: window.key, settledAt: now(), winners };
}

app.use(express.json({
  limit: '2mb',
  verify(req, res, buffer) {
    req.rawBody = Buffer.from(buffer);
  }
}));
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), geolocation=(), payment=()');
  next();
});

const IS_PRODUCTION = process.env.NODE_ENV === 'production' || Boolean(process.env.RENDER);
const ADMIN_ID = process.env.ADMIN_ID || (IS_PRODUCTION ? '' : 'admin');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || (IS_PRODUCTION ? '' : 'ChangeMe123!');
const ADMIN_TOKEN_SECRET = process.env.SESSION_SECRET || process.env.JWT_SECRET || crypto.randomBytes(48).toString('hex');
const ADMIN_SESSION_MS = 12 * 60 * 60 * 1000;
const adminLoginAttempts = new Map();

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function signAdminToken(payload) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + ADMIN_SESSION_MS })).toString('base64url');
  const sig = crypto.createHmac('sha256', ADMIN_TOKEN_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyAdminToken(token = '') {
  const [body, sig] = String(token).split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', ADMIN_TOKEN_SECRET).update(body).digest('base64url');
  if (!safeEqual(sig, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function getAdminToken(req) {
  const auth = req.headers.authorization || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : '';
}

function requireAdmin(req, res, next) {
  const payload = verifyAdminToken(getAdminToken(req));
  if (!payload) return res.status(401).json({ ok: false, message: 'Admin login required' });
  req.admin = payload;
  next();
}


app.post('/api/session', (req, res) => {
  const data = readData();
  const user = getSessionUser(req, data);
  data.events.push({ type: 'session', userId: user.id, at: now() });
  writeData(data);
  res.json({ ok: true, user: publicUser(data, user) });
});

app.post('/api/ledger', (req, res) => {
  const data = readData();
  const user = getSessionUser(req, data);
  const entries = (data.ledger || [])
    .filter((entry) => entry.userId === user.id)
    .slice(-50)
    .reverse()
    .map(({ id, sequence, type, amount, balanceAfter, reference, metadata, at, hash }) => ({
      id, sequence, type, amount, balanceAfter, reference, metadata, at, hash
    }));
  res.json({ ok: true, entries });
});

app.post('/api/fleet/dashboard', (req, res) => {
  const data = readData();
  settlePreviousFleetWeek(data);
  const user = getSessionUser(req, data);
  const captainId = fleetCaptainId(data, user);
  const captain = data.users[captainId];
  const members = fleetMembers(data, captainId);
  const cutoff = now() - 7 * 86400000;
  const ranking = fleetRanking(data).slice(0, 20);
  const ownRank = ranking.findIndex((fleet) => fleet.captainId === captainId) + 1;
  const messages = (data.fleetMessages || []).filter((message) => message.captainId === captainId).slice(-80);
  writeData(data);
  res.json({
    ok: true,
    fleet: {
      captainId,
      captainName: captain?.firstName || 'Captain',
      code: captain?.referralCode || makeReferralCode(captainId),
      link: `https://t.me/SpaceNovaXBot?start=${captain?.referralCode || makeReferralCode(captainId)}`,
      total: Math.max(0, members.length - 1),
      active: members.filter((member) => member.id !== captainId && Number(member.lastMiningAt || 0) >= cutoff).length,
      kycVerified: members.filter((member) => member.id !== captainId && String(member.kyc?.status || '').toLowerCase() === 'approved').length,
      grade: fleetGrade(Math.max(0, members.length - 1)),
      bonusPerMember: Number(data.settings?.fleetBonusPerActiveReferral || 5),
      maxMembers: Number(data.settings?.fleetMaxMembers || 1000),
      members: members.filter((member) => member.id !== captainId).map((member) => ({
        id: member.id,
        firstName: member.firstName || 'Captain',
        username: member.username || '',
        active: Number(member.lastMiningAt || 0) >= cutoff,
        kycVerified: String(member.kyc?.status || '').toLowerCase() === 'approved',
        inSecurityCircle: (user.securityCircle || []).includes(member.id),
        lastMiningAt: Number(member.lastMiningAt || 0),
        gameScore: Number(member.gameReward?.bestScore || 0)
      })),
      weeklyScore: fleetScore(data, captainId),
      weeklyRank: ownRank || null,
      ranking,
      messages,
      previousSettlement: Object.values(data.fleetWeeklySettlements || {}).sort((a, b) => b.settledAt - a.settledAt)[0] || null
    },
    user: publicUser(data, user)
  });
});

app.post('/api/fleet/security-circle', (req, res) => {
  const data = readData();
  const user = getSessionUser(req, data);
  if (!requireVerifiedCaptain(user, res)) return;
  if (!data.settings?.kycEnabled) return res.status(409).json({ ok: false, message: 'KYC and Security Circle activation are coming soon.' });
  const member = data.users[String(req.body?.userId || '')];
  if (!member || member.referredBy !== user.id) return res.status(403).json({ ok: false, message: 'Select a member from your direct fleet.' });
  if (String(member.kyc?.status || '').toLowerCase() !== 'approved') return res.status(409).json({ ok: false, message: 'Security Circle requires a KYC-approved member.' });
  user.securityCircle ||= [];
  const removing = user.securityCircle.includes(member.id);
  if (!removing && user.securityCircle.length >= 5) return res.status(409).json({ ok: false, message: 'Security Circle is limited to five members.' });
  user.securityCircle = removing ? user.securityCircle.filter((id) => id !== member.id) : [...user.securityCircle, member.id];
  data.events.push({ type: removing ? 'security_circle_remove' : 'security_circle_add', userId: user.id, memberId: member.id, at: now() });
  writeData(data);
  res.json({ ok: true, message: removing ? 'Member removed from Security Circle.' : 'KYC member added to Security Circle.', user: publicUser(data, user) });
});

app.post('/api/fleet/join', (req, res) => {
  const data = readData();
  const user = getSessionUser(req, data);
  if (!requireVerifiedCaptain(user, res)) return;
  const code = String(req.body?.code || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ ok: false, message: 'Enter a referral code.' });
  if (user.referredBy) return res.status(409).json({ ok: false, message: 'A referral code is already registered.' });
  const captain = findUserByReferralCode(data, code);
  if (!captain || captain.id === user.id) return res.status(404).json({ ok: false, message: 'Valid fleet code not found.' });
  captain.referrals ||= [];
  const maxMembers = Number(data.settings?.fleetMaxMembers || 1000);
  if (captain.referrals.length >= maxMembers) return res.status(409).json({ ok: false, message: 'This fleet has reached 1,000 members.' });
  user.referredBy = captain.id;
  if (!captain.referrals.includes(user.id)) captain.referrals.push(user.id);
  data.events.push({ type: 'fleet_join', userId: user.id, captainId: captain.id, code, at: now() });
  writeData(data);
  res.json({ ok: true, message: `Joined ${captain.firstName || 'Captain'}'s fleet.`, user: publicUser(data, user) });
});

app.post('/api/fleet/chat', (req, res) => {
  const data = readData();
  const user = getSessionUser(req, data);
  if (!requireVerifiedCaptain(user, res)) return;
  const text = String(req.body?.message || '').trim().slice(0, 500);
  if (!text) return res.status(400).json({ ok: false, message: 'Message is empty.' });
  const recent = (data.fleetMessages || []).filter((message) => message.userId === user.id && message.at > now() - 60000);
  if (recent.length >= 10) return res.status(429).json({ ok: false, message: 'Please wait before sending more messages.' });
  const captainId = fleetCaptainId(data, user);
  const message = { id: crypto.randomUUID(), captainId, userId: user.id, firstName: user.firstName || 'Captain', message: text, at: now() };
  data.fleetMessages.push(message);
  data.fleetMessages = data.fleetMessages.slice(-5000);
  writeData(data);
  res.json({ ok: true, message });
});

app.post('/api/fleet/remind', async (req, res) => {
  const data = readData();
  const captain = getSessionUser(req, data);
  const target = data.users[String(req.body?.userId || '')];
  if (!target || target.referredBy !== captain.id) return res.status(403).json({ ok: false, message: 'Only your direct fleet members can be notified.' });
  if (Number(target.lastMiningAt || 0) >= now() - 7 * 86400000) return res.status(409).json({ ok: false, message: 'This member is already active.' });
  const prior = (data.fleetNotifications || []).find((notice) => notice.from === captain.id && notice.to === target.id && notice.at > now() - 86400000);
  if (prior) return res.status(429).json({ ok: false, message: 'A reminder was already sent in the last 24 hours.' });
  const notice = { id: crypto.randomUUID(), from: captain.id, to: target.id, type: 'mining_reminder', at: now() };
  data.fleetNotifications.push(notice);
  data.events.push({ type: 'fleet_mining_reminder', userId: captain.id, targetId: target.id, at: notice.at });
  writeData(data);
  if (process.env.TELEGRAM_BOT_TOKEN && target.telegramId) {
    try {
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: target.telegramId, text: `🚀 ${captain.firstName || 'Your fleet captain'} is calling you back to SpaceNovaX. Restart your 24-hour mining cycle now.` })
      });
    } catch {}
  }
  res.json({ ok: true, message: 'Mining reminder recorded and sent when Telegram delivery is available.' });
});

app.post('/api/community/feed', (req, res) => {
  const data = readData();
  const user = getSessionUser(req, data);
  const category = String(req.body?.category || 'all').toLowerCase();
  const posts = (data.communityPosts || [])
    .filter((post) => post.status === 'published' && (category === 'all' || post.category === category))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 100)
    .map((post) => publicCommunityPost(data, post, user.id));
  res.json({ ok: true, posts, permission: communityPostPermission(data, user) });
});

app.post('/api/community/dashboard', (req, res) => {
  const data = readData();
  const user = getSessionUser(req, data);
  const fleets = fleetRanking(data).slice(0, 20);
  const fleetRankIndex = fleets.findIndex((fleet) => fleet.captainId === user.id);
  const gameRanking = Object.values(data.users || {})
    .map((captain) => ({ id: captain.id, firstName: captain.firstName || 'Captain', score: Number(captain.gameReward?.bestScore || 0) }))
    .filter((captain) => captain.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 100);
  const gameRankIndex = gameRanking.findIndex((captain) => captain.id === user.id);
  const activeFleet = getActiveFleetCount(data, user.id);
  res.json({
    ok: true,
    dashboard: {
      referralCode: user.referralCode || makeReferralCode(user.id),
      referralLink: `https://t.me/SpaceNovaXBot?start=${user.referralCode || makeReferralCode(user.id)}`,
      totalInvites: (user.referrals || []).length,
      activeFleet,
      fleetBonus: fleetBonusPercent(activeFleet, data),
      fleetRank: fleetRankIndex >= 0 ? fleetRankIndex + 1 : null,
      fleetScore: fleetRankIndex >= 0 ? Number(fleets[fleetRankIndex].score || 0) : 0,
      gameRank: gameRankIndex >= 0 ? gameRankIndex + 1 : null,
      gameScore: Number(user.gameReward?.bestScore || 0),
      fleetTop: fleets.map((fleet, index) => ({ rank: index + 1, captainName: fleet.captainName, members: fleet.members, score: fleet.score })),
      gameTop: gameRanking.slice(0, 20).map((captain, index) => ({ rank: index + 1, firstName: captain.firstName, score: captain.score })),
    }
  });
});

app.post('/api/community/post', (req, res) => {
  const data = readData();
  const user = getSessionUser(req, data);
  const permission = communityPostPermission(data, user);
  if (!permission.allowed) return res.status(403).json({ ok: false, message: `Posting requires five KYC-approved Security Circle members (${permission.circleCount}/5).` });
  const title = String(req.body?.title || '').trim().slice(0, 120);
  const body = String(req.body?.body || '').trim().slice(0, 5000);
  const categories = new Set(['nova-ai', 'game', 'mining', 'guide', 'community']);
  const category = categories.has(String(req.body?.category || '')) ? String(req.body.category) : 'community';
  if (title.length < 4 || body.length < 10) return res.status(400).json({ ok: false, message: 'Add a clear title and at least 10 characters of useful information.' });
  const recent = (data.communityPosts || []).filter((post) => post.authorId === user.id && post.createdAt > now() - 3600000);
  if (recent.length >= 5) return res.status(429).json({ ok: false, message: 'Posting limit reached. Try again later.' });
  let imageUrl = '';
  const imageData = String(req.body?.imageData || '');
  if (imageData) {
    const match = imageData.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
    if (!match) return res.status(400).json({ ok: false, message: 'Only PNG, JPEG, and WebP images are supported.' });
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > 1_500_000) return res.status(413).json({ ok: false, message: 'Image must be 1.5 MB or smaller.' });
    fs.mkdirSync(COMMUNITY_MEDIA_DIR, { recursive: true });
    const extension = match[1] === 'jpeg' ? 'jpg' : match[1];
    const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${extension}`;
    fs.writeFileSync(path.join(COMMUNITY_MEDIA_DIR, filename), buffer);
    imageUrl = `/community-media/${filename}`;
  }
  const post = { id: crypto.randomUUID(), authorId: user.id, authorName: user.firstName || 'Captain', category, title, body, imageUrl, likes: [], comments: [], reports: 0, status: 'published', createdAt: now() };
  data.communityPosts.push(post);
  data.events.push({ type: 'community_post', userId: user.id, postId: post.id, hasImage: Boolean(imageUrl), at: now() });
  writeData(data);
  res.json({ ok: true, post: publicCommunityPost(data, post, user.id) });
});

app.post('/api/community/like', (req, res) => {
  const data = readData();
  const user = getSessionUser(req, data);
  const post = (data.communityPosts || []).find((item) => item.id === String(req.body?.postId || '') && item.status !== 'removed');
  if (!post) return res.status(404).json({ ok: false, message: 'Post not found.' });
  post.likes ||= [];
  post.likes = post.likes.includes(user.id) ? post.likes.filter((id) => id !== user.id) : [...post.likes, user.id];
  writeData(data);
  res.json({ ok: true, liked: post.likes.includes(user.id), likes: post.likes.length });
});

app.post('/api/community/report', (req, res) => {
  const data = readData();
  const user = getSessionUser(req, data);
  const post = (data.communityPosts || []).find((item) => item.id === String(req.body?.postId || ''));
  if (!post) return res.status(404).json({ ok: false, message: 'Post not found.' });
  if ((data.communityReports || []).some((report) => report.postId === post.id && report.userId === user.id)) return res.status(409).json({ ok: false, message: 'You already reported this post.' });
  const report = { id: crypto.randomUUID(), postId: post.id, userId: user.id, reason: String(req.body?.reason || 'community_review').slice(0, 200), at: now() };
  data.communityReports.push(report);
  post.reports = Number(post.reports || 0) + 1;
  if (post.reports >= 5) post.status = 'review';
  data.events.push({ type: 'community_report', userId: user.id, postId: post.id, at: now() });
  writeData(data);
  res.json({ ok: true, message: 'Report submitted for administrator review.' });
});

app.get('/api/admin/community/reports', requireAdmin, (req, res) => {
  const data = readData();
  const posts = (data.communityPosts || [])
    .filter((post) => post.status === 'review' || Number(post.reports || 0) > 0)
    .sort((a, b) => Number(b.reports || 0) - Number(a.reports || 0))
    .map((post) => ({
      ...post,
      author: publicUser(data, data.users.find((user) => user.id === post.authorId) || { id: post.authorId, firstName: post.authorName }),
      reportItems: (data.communityReports || []).filter((report) => report.postId === post.id),
    }));
  res.json({ ok: true, posts });
});

app.post('/api/admin/community/moderate', requireAdmin, (req, res) => {
  const data = readData();
  const post = (data.communityPosts || []).find((item) => item.id === String(req.body?.postId || ''));
  if (!post) return res.status(404).json({ ok: false, message: 'Post not found.' });
  const action = String(req.body?.action || '');
  if (!['publish', 'remove'].includes(action)) return res.status(400).json({ ok: false, message: 'Action must be publish or remove.' });
  post.status = action === 'publish' ? 'published' : 'removed';
  post.moderatedAt = now();
  post.moderatedBy = req.admin.id;
  data.events.push({ type: 'admin_community_moderate', adminId: req.admin.id, postId: post.id, action, at: now() });
  writeData(data);
  res.json({ ok: true, post });
});

app.post('/api/mining/start', (req, res) => {
  const data = readData();
  const user = getSessionUser(req, data);
  if (!requireVerifiedCaptain(user, res)) return;
  const status = calculateMining(data, user);

  if (status.active) return res.json({ ok: true, message: 'Mining already active.', user: publicUser(data, user) });

  user.mining = { active: true, startedAt: now(), engineVersion: data.settings?.miningEngineVersion || '1.0.0', sandbox: Boolean(data.settings?.miningSandboxEnabled) };
  user.lastMiningAt = now();
  data.events.push({ type: 'mining_start', userId: user.id, at: now() });
  writeData(data);

  res.json({ ok: true, message: 'Mining started.', user: publicUser(data, user) });
});

app.post('/api/mining/claim', (req, res) => {
  const data = readData();
  const user = getSessionUser(req, data);
  if (!requireVerifiedCaptain(user, res)) return;
  const status = calculateMining(data, user);

  if (user.banned) return res.status(403).json({ ok: false, message: 'Account is restricted.' });

  if (!status.claimable) {
    return res.status(400).json({ ok: false, message: 'Mining is not ready to claim yet.' });
  }

  const amount = Number(status.reward || 0);
  const cycleStartedAt = Number(user.mining?.startedAt || 0);
  const ledgerEntry = appendLedger(data, user, {
    type: 'mining_reward',
    amount,
    idempotencyKey: `mining:${user.id}:${cycleStartedAt}`,
    reference: `cycle-${cycleStartedAt}`,
    metadata: {
      phase: status.phase,
      fleetBonus: status.fleetBonus,
      securityBonus: status.securityBonus,
      missionBonus: status.missionBonus
    }
  });
  user.totalMined = Number(user.totalMined || 0) + amount;
  user.mining = null;
  user.lastMiningAt = now();
  user.updatedAt = now();

  data.events.push({ type: 'mining_claim', userId: user.id, amount, ledgerId: ledgerEntry?.id, phase: status.phase, fleetBonus: status.fleetBonus, engineVersion: status.engineVersion, sandbox: status.sandbox, at: now() });
  writeData(data);

  res.json({ ok: true, message: `Claimed ${amount} SPNX Point.`, user: publicUser(data, user) });
});

app.get('/api/legacy/missions', (req, res) => {
  const data = readData();
  res.json({ ok: true, missions: data.missions.filter((m) => m.enabled !== false) });
});

app.post('/api/legacy/missions/claim', (req, res) => {
  res.status(410).json({ ok: false, message: 'Legacy mission claiming has been retired.' });
});

app.get('/api/ranking', (req, res) => {
  const data = readData();
  const users = Object.values(data.users)
    .map((u) => publicUser(data, u))
    .sort((a, b) => Number(b.balance || 0) - Number(a.balance || 0));

  res.json({ ok: true, top: users.slice(0, 100), totalUsers: users.length });
});

app.post('/api/ranking/me', (req, res) => {
  const data = readData();
  const user = getSessionUser(req, data);
  const users = Object.values(data.users)
    .map((u) => ({ id: u.id, balance: Number(u.balance || 0) }))
    .sort((a, b) => b.balance - a.balance);

  const rank = users.findIndex((u) => u.id === user.id) + 1;
  res.json({ ok: true, rank, totalUsers: users.length, user: publicUser(data, user) });
});

app.post('/api/legacy/wallet/save', (req, res) => {
  const data = readData();
  const user = getSessionUser(req, data);
  const wallet = String(req.body?.wallet || '').trim();

  if (wallet.length < 32) return res.status(400).json({ ok: false, message: 'Invalid Solana wallet address.' });

  user.solanaWallet = wallet;
  user.updatedAt = now();
  data.events.push({ type: 'wallet_saved', userId: user.id, wallet, at: now() });
  writeData(data);

  res.json({ ok: true, user: publicUser(data, user) });
});



function calculateRiskProfile(data, user) {
  const users = Object.values(data.users || {});
  const events = data.events || [];
  const flags = [];
  let riskScore = 10;
  let trustScore = 50;
  const wallet = String(user.solanaWallet || '').trim();

  if (!wallet) { riskScore += 5; flags.push('wallet_missing'); }
  if (wallet && users.some((u) => u.id !== user.id && String(u.solanaWallet || '').trim() === wallet)) {
    riskScore += 45; trustScore -= 30; flags.push('duplicate_wallet');
  }
  const userEvents = events.filter((e) => e.userId === user.id);
  const miningStarts = userEvents.filter((e) => e.type === 'mining_start').length;
  const claims = userEvents.filter((e) => e.type === 'mining_claim').length;
  const missions = userEvents.filter((e) => e.type === 'mission_claim').length;
  trustScore += Math.min(15, miningStarts * 3) + Math.min(15, claims * 4) + Math.min(10, missions * 2);

  if (Date.now() - Number(user.createdAt || Date.now()) < 10 * 60 * 1000) {
    riskScore += 8; flags.push('new_account');
  } else {
    trustScore += 5;
  }
  if (Number(user.balance || 0) > 100000 && claims < 2) {
    riskScore += 20; flags.push('high_balance_low_activity');
  }
  const referrals = user.referrals || [];
  if (referrals.length >= 50 && getActiveFleetCount(data, user.id) < 5) {
    riskScore += 20; flags.push('inactive_mass_referrals');
  }
  const kycStatus = user.kyc?.status || 'not_submitted';
  if (kycStatus === 'approved') { trustScore += 25; riskScore -= 20; }
  if (kycStatus === 'rejected') { riskScore += 50; trustScore -= 40; flags.push('kyc_rejected'); }

  riskScore = Math.max(0, Math.min(100, riskScore));
  trustScore = Math.max(0, Math.min(100, trustScore));

  return {
    riskScore,
    trustScore,
    riskLevel: riskScore >= 70 ? 'high' : riskScore >= 40 ? 'review' : riskScore <= 20 ? 'low' : 'normal',
    trustLevel: trustScore >= 80 ? 'trusted' : trustScore >= 60 ? 'normal' : trustScore >= 40 ? 'review' : 'suspended',
    flags,
    kycStatus
  };
}

function publicAdminUser(data, user) {
  return {
    ...publicUser(data, user),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastMiningAt: user.lastMiningAt,
    kyc: user.kyc || { status: 'not_submitted' },
    banned: Boolean(user.banned),
    risk: calculateRiskProfile(data, user)
  };
}

app.post('/api/admin/login', (req, res) => {
  const id = String(req.body?.id || '').trim();
  const password = String(req.body?.password || '');
  const attemptKey = String(req.ip || 'unknown');
  const attempt = adminLoginAttempts.get(attemptKey) || { count: 0, resetAt: 0 };
  if (attempt.resetAt > now() && attempt.count >= 5) {
    return res.status(429).json({ ok: false, message: 'Too many login attempts. Try again later.' });
  }
  if (!ADMIN_ID || !ADMIN_PASSWORD) {
    return res.status(503).json({ ok: false, message: 'Admin credentials are not configured on the server.' });
  }

  const data = readData();
  if (!safeEqual(id, ADMIN_ID) || !safeEqual(password, ADMIN_PASSWORD)) {
    adminLoginAttempts.set(attemptKey, {
      count: attempt.resetAt > now() ? attempt.count + 1 : 1,
      resetAt: attempt.resetAt > now() ? attempt.resetAt : now() + 15 * 60 * 1000,
    });
    data.events.push({ type: 'admin_login_failed', id, at: now() });
    writeData(data);
    return res.status(401).json({ ok: false, message: 'Invalid admin ID or password' });
  }

  adminLoginAttempts.delete(attemptKey);
  const token = signAdminToken({ id, role: 'super_admin' });
  data.events.push({ type: 'admin_login_success', id, at: now() });
  writeData(data);
  res.json({ ok: true, token, admin: { id, role: 'super_admin' } });
});

app.get('/api/admin/me', requireAdmin, (req, res) => {
  res.json({ ok: true, admin: req.admin });
});

app.post('/api/admin/logout', requireAdmin, (req, res) => {
  const data = readData();
  data.events.push({ type: 'admin_logout', id: req.admin.id, at: now() });
  writeData(data);
  res.json({ ok: true });
});

app.get('/api/admin/logs', requireAdmin, (req, res) => {
  const data = readData();
  const logs = (data.events || []).filter((e) => String(e.type || '').startsWith('admin_')).slice(-100).reverse();
  res.json({ ok: true, logs });
});


app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const data = readData();
  const users = Object.values(data.users || {});
  const events = data.events || [];
  const dayAgo = now() - 24 * 60 * 60 * 1000;
  const today = events.filter((event) => event.at >= dayAgo);
  const totalBalance = users.reduce((sum, user) => sum + Number(user.balance || 0), 0);
  const activeMining = users.filter((user) => calculateMining(data, user).active).length;
  const phase = miningPhase(data);

  res.json({ ok: true, stats: {
    totalUsers: users.length,
    activeMining,
    totalBalance,
    todaySessions: today.filter((event) => event.type === 'session').length,
    todayMiningStarts: today.filter((event) => event.type === 'mining_start').length,
    todayClaims: today.filter((event) => event.type === 'mining_claim').length,
    todayMissions: today.filter((event) => event.type === 'mission_claim').length,
    totalEvents: events.length,
    phase: phase.phase,
    miningPoolUsed: phase.used,
    miningPoolRatio: phase.ratio
  }});
});

app.get('/api/admin/users', requireAdmin, (req, res) => {
  const data = readData();
  const users = Object.values(data.users || {})
    .sort((a, b) => Number(b.balance || 0) - Number(a.balance || 0))
    .slice(0, 200)
    .map((user) => publicAdminUser(data, user));
  res.json({ ok: true, users });
});

app.get('/api/admin/missions', requireAdmin, (req, res) => {
  const data = readData();
  res.json({ ok: true, missions: data.missions });
});

app.post('/api/admin/points', requireAdmin, (req, res) => {
  const data = readData();
  const userId = String(req.body?.userId || '');
  const amount = Number(req.body?.amount || 0);
  const reason = req.body?.reason || 'manual';

  if (!userId || !Number.isFinite(amount)) return res.status(400).json({ ok: false, message: 'userId and amount are required' });

  const user = data.users?.[userId];
  if (!user) return res.status(404).json({ ok: false, message: 'User not found' });

  const ledgerEntry = appendLedger(data, user, {
    type: 'admin_adjustment',
    amount,
    idempotencyKey: `admin:${req.admin?.id || 'admin'}:${crypto.randomUUID()}`,
    reference: String(reason),
    metadata: { adminId: req.admin?.id || 'admin' }
  });
  data.events.push({ type: 'admin_points', adminId: req.admin?.id || 'admin', userId, amount, reason, ledgerId: ledgerEntry?.id, at: now() });
  writeData(data);

  res.json({ ok: true, user: publicUser(data, user) });
});


app.get('/api/admin/users/search', requireAdmin, (req, res) => {
  const data = readData();
  const q = String(req.query.q || '').toLowerCase().trim();
  const users = Object.values(data.users || {})
    .filter((u) => !q || [u.id,u.telegramId,u.username,u.firstName,u.solanaWallet,u.kyc?.status].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)))
    .sort((a,b) => Number(b.balance || 0) - Number(a.balance || 0))
    .slice(0,200)
    .map((u) => publicAdminUser(data, u));
  res.json({ ok: true, users });
});

app.get('/api/admin/risk', requireAdmin, (req, res) => {
  const data = readData();
  const users = Object.values(data.users || {}).map((u) => publicAdminUser(data, u))
    .sort((a,b) => Number(b.risk.riskScore || 0) - Number(a.risk.riskScore || 0));
  res.json({
    ok: true,
    highRisk: users.filter((u) => u.risk.riskLevel === 'high'),
    review: users.filter((u) => u.risk.riskLevel === 'review'),
    trusted: users.filter((u) => u.risk.trustLevel === 'trusted'),
    all: users.slice(0,200)
  });
});

app.post('/api/admin/user/update', requireAdmin, (req, res) => {
  const data = readData();
  const userId = String(req.body?.userId || '');
  const user = data.users?.[userId];
  if (!user) return res.status(404).json({ ok: false, message: 'User not found' });
  if (req.body?.balance !== undefined) {
    const requestedBalance = roundPoints(req.body.balance);
    if (!Number.isFinite(requestedBalance) || requestedBalance < 0) {
      return res.status(400).json({ ok: false, message: 'Invalid balance' });
    }
    const adjustment = roundPoints(requestedBalance - Number(user.balance || 0));
    if (adjustment !== 0) {
      appendLedger(data, user, {
        type: 'admin_adjustment',
        amount: adjustment,
        idempotencyKey: `admin:${req.admin.id}:${user.id}:${crypto.randomUUID()}`,
        reference: req.admin.id,
        metadata: { reason: String(req.body?.reason || 'Admin balance correction').slice(0, 160) }
      });
    }
  }
  if (req.body?.solanaWallet !== undefined) user.solanaWallet = String(req.body.solanaWallet || '').trim();
  if (req.body?.banned !== undefined) user.banned = Boolean(req.body.banned);
  user.updatedAt = now();
  data.events.push({ type: 'admin_user_update', adminId: req.admin.id, userId, at: now() });
  writeData(data);
  res.json({ ok: true, user: publicAdminUser(data, user) });
});

app.post('/api/admin/kyc/update', requireAdmin, (req, res) => {
  res.status(410).json({
    ok: false,
    message: 'KYC is coming soon. Manual approval is disabled; future approval will require a signed provider webhook.'
  });
});

app.get('/api/admin/live-monitor', requireAdmin, (req, res) => {
  const data = readData();
  const users = Object.values(data.users || {});
  const events = data.events || [];
  const nowMs = now();
  const last10m = nowMs - 10 * 60 * 1000;
  const last24h = nowMs - 24 * 60 * 60 * 1000;
  const today = events.filter((e) => e.at >= last24h);
  const online = new Set(events.filter((e) => e.at >= last10m && e.userId).map((e) => e.userId));
  const risks = users.map((u) => calculateRiskProfile(data, u));
  res.json({ ok: true, monitor: {
    onlineUsers: online.size,
    todayNewUsers: today.filter((e) => e.type === 'user_created').length,
    todayMiningStarts: today.filter((e) => e.type === 'mining_start').length,
    todayClaims: today.filter((e) => e.type === 'mining_claim').length,
    todayMissions: today.filter((e) => e.type === 'mission_claim').length,
    highRisk: risks.filter((r) => r.riskLevel === 'high').length,
    review: risks.filter((r) => r.riskLevel === 'review').length,
    trusted: risks.filter((r) => r.trustLevel === 'trusted').length,
    totalUsers: users.length
  }});
});


app.post('/api/kyc/provider/webhook', (req, res) => {
  if (!kycRuntimeReady()) return res.status(503).json({ ok: false, message: 'KYC provider webhook is not enabled.' });
  const supplied = String(req.headers['x-spnx-kyc-signature'] || '');
  const expected = crypto.createHmac('sha256', process.env.KYC_WEBHOOK_SECRET).update(req.rawBody || Buffer.from('')).digest('hex');
  if (!safeEqual(supplied, expected)) return res.status(401).json({ ok: false, message: 'Invalid KYC webhook signature.' });
  const eventId = String(req.body?.eventId || '').trim();
  const userId = String(req.body?.externalReference || req.body?.userId || '').trim();
  const applicantId = String(req.body?.applicantId || '').trim();
  const incomingStatus = String(req.body?.status || '').toLowerCase();
  const allowed = new Set(['pending', 'approved', 'rejected', 'expired']);
  if (!eventId || !userId || !applicantId || !allowed.has(incomingStatus)) {
    return res.status(400).json({ ok: false, message: 'KYC webhook payload is incomplete.' });
  }
  const data = readData();
  if ((data.events || []).some((event) => event.type === 'kyc_webhook' && event.eventId === eventId)) {
    return res.json({ ok: true, duplicate: true });
  }
  const user = data.users?.[userId];
  if (!user) return res.status(404).json({ ok: false, message: 'Captain account not found.' });
  user.kyc = {
    status: incomingStatus,
    available: true,
    providerApplicantId: applicantId,
    providerEventId: eventId,
    reviewedAt: now(),
  };
  data.events.push({ type: 'kyc_webhook', eventId, userId, applicantId, status: incomingStatus, at: now() });
  writeData(data);
  res.json({ ok: true });
});

app.post('/api/convert/request', (req, res) => {
  const data = readData();
  const user = getSessionUser(req, data);
  const amount = Number(req.body?.amount || 0);
  if (!requireVerifiedCaptain(user, res)) return;
  const runtime = conversionRuntimeStatus(data);
  if (!runtime.ready) return res.status(400).json({ ok: false, message: 'Automatic SPNX conversion is not active.' });
  if (String(user.kyc?.status || '').toLowerCase() !== 'approved') return res.status(403).json({ ok: false, message: 'Approved KYC is required.' });
  if (!user.walletVerifiedAt || !user.verifiedSolanaWallet || user.verifiedSolanaWallet !== user.solanaWallet) {
    return res.status(403).json({ ok: false, message: 'Signed Solana wallet ownership verification is required.' });
  }
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ ok: false, message: 'Invalid amount.' });
  if (amount < Number(data.settings?.minConvert || 5000)) return res.status(400).json({ ok: false, message: 'Minimum convert amount not reached.' });
  if (amount > Number(user.balance || 0)) return res.status(400).json({ ok: false, message: 'Insufficient SPNX Point.' });
  data.convertRequests ||= [];
  const activeRequest = data.convertRequests.find((item) => item.userId === user.id && ['queued', 'broadcasting'].includes(item.status));
  if (activeRequest) return res.status(409).json({ ok: false, message: 'An SPNX payout is already in progress.' });
  const requestId = `cv-${crypto.randomBytes(10).toString('hex')}`;
  const pointToTokenRate = Number(data.settings?.pointToTokenRate || 1);
  const tokenAmount = roundPoints(amount * pointToTokenRate);
  const hold = appendLedger(data, user, {
    type: 'conversion_hold',
    amount: -amount,
    idempotencyKey: `conversion-hold:${requestId}`,
    reference: requestId,
    metadata: { wallet: user.verifiedSolanaWallet, tokenAmount, pointToTokenRate },
  });
  const request = {
    id: requestId,
    userId: user.id,
    pointAmount: amount,
    tokenAmount,
    pointToTokenRate,
    wallet: user.verifiedSolanaWallet,
    status: 'queued',
    holdLedgerId: hold.id,
    createdAt: now(),
    updatedAt: now(),
  };
  data.convertRequests.push(request);
  const payout = {
    id: `po-${crypto.randomBytes(10).toString('hex')}`,
    requestId,
    userId: user.id,
    pointAmount: amount,
    tokenAmount,
    wallet: user.verifiedSolanaWallet,
    status: 'queued',
    attempts: 0,
    createdAt: now(),
    updatedAt: now(),
  };
  data.payouts.push(payout);
  data.payoutKeys[requestId] = payout.id;
  data.events.push({ type: 'convert_request', userId: user.id, requestId, payoutId: payout.id, amount, tokenAmount, at: now() });
  writeData(data);
  setImmediate(() => processPayout(payout.id, 'conversion_request').catch((error) => console.error('SPNX payout error', payout.id, error.message)));
  res.json({ ok: true, request, payout: publicPayout(payout) });
});

app.get('/api/admin/settings', requireAdmin, (req, res) => {
  const data = readData();
  res.json({ ok: true, settings: data.settings || {}, conversionRuntime: conversionRuntimeStatus(data) });
});

app.post('/api/admin/settings/update', requireAdmin, (req, res) => {
  const data = readData();
  data.settings ||= {};
  ['minConvert','pointToTokenRate','fleetMaxMembers','activeFleetDays','gameRewardsEnabled','novaAiEnabled','maintenanceMode'].forEach((key) => {
    if (req.body?.[key] !== undefined) data.settings[key] = req.body[key];
  });
  data.settings.novaDailyMessageLimit = NOVA_DAILY_LIMIT;
  const requestedKyc = req.body?.kycEnabled;
  const requestedConvert = req.body?.convertEnabled;
  const requestedAuto = req.body?.autoPayoutEnabled;
  if (requestedKyc !== undefined) {
    if (requestedKyc && !kycRuntimeReady()) return res.status(409).json({ ok: false, message: 'Configure the signed KYC provider webhook before enabling KYC.' });
    data.settings.kycEnabled = Boolean(requestedKyc);
  }
  if (requestedConvert !== undefined || requestedAuto !== undefined) {
    const solana = solanaPayoutConfig();
    if ((requestedConvert || requestedAuto) && (!solana.enabled || !solana.valid || !data.settings.kycEnabled)) {
      return res.status(409).json({ ok: false, message: `KYC and Solana payout runtime must be ready first. ${solana.error || ''}`.trim() });
    }
    if (requestedConvert !== undefined) data.settings.convertEnabled = Boolean(requestedConvert);
    if (requestedAuto !== undefined) data.settings.autoPayoutEnabled = Boolean(requestedAuto);
  }
  if (!data.settings.kycEnabled) {
    data.settings.convertEnabled = false;
    data.settings.autoPayoutEnabled = false;
  }
  if (!data.settings.convertEnabled) data.settings.autoPayoutEnabled = false;
  data.settings.fleetBonusPerActiveReferral = 5;
  data.settings.gameDailyLimit = GAME_DAILY_LIMIT;
  data.events.push({ type: 'admin_settings_update', adminId: req.admin.id, settings: data.settings, at: now() });
  writeData(data);
  res.json({ ok: true, settings: data.settings, conversionRuntime: conversionRuntimeStatus(data) });
});

app.get('/api/admin/convert-queue', requireAdmin, (req, res) => {
  const data = readData();
  const queue = (data.convertRequests || []).map((request) => {
    const payoutId = data.payoutKeys?.[request.id];
    const payout = (data.payouts || []).find((item) => item.id === payoutId);
    return { ...request, payout: publicPayout(payout), user: data.users?.[request.userId] ? publicAdminUser(data, data.users[request.userId]) : null };
  }).reverse();
  res.json({ ok: true, queue, runtime: conversionRuntimeStatus(data) });
});

app.post('/api/admin/convert/update', requireAdmin, async (req, res) => {
  const data = readData();
  const request = (data.convertRequests || []).find((item) => item.id === String(req.body?.id || ''));
  if (!request) return res.status(404).json({ ok: false, message: 'Conversion request not found.' });
  const payout = (data.payouts || []).find((item) => item.id === data.payoutKeys?.[request.id]);
  if (!payout) return res.status(404).json({ ok: false, message: 'Payout job not found.' });
  const action = String(req.body?.action || '');
  if (action === 'process') {
    try {
      const processed = await processPayout(payout.id, `admin:${req.admin.id}`);
      return res.json({ ok: true, payout: processed });
    } catch (error) {
      return res.status(409).json({ ok: false, message: error.message });
    }
  }
  if (action === 'retry' && payout.status === 'needs_review' && !payout.txSignature) {
    payout.status = 'retry';
    payout.lastError = '';
    payout.updatedAt = now();
    data.events.push({ type: 'admin_payout_retry', adminId: req.admin.id, payoutId: payout.id, at: now() });
    writeData(data);
    return res.json({ ok: true, payout: publicPayout(payout) });
  }
  if (action === 'cancel') {
    if (payout.status === 'completed' || payout.txSignature || ['prepared', 'broadcasting'].includes(payout.status)) {
      return res.status(409).json({ ok: false, message: 'A signed or broadcast payout cannot be cancelled. Review its on-chain status first.' });
    }
    if (payout.status === 'cancelled') return res.json({ ok: true, payout: publicPayout(payout), duplicate: true });
    const user = data.users?.[payout.userId];
    if (!user) return res.status(404).json({ ok: false, message: 'Captain account not found.' });
    const release = appendLedger(data, user, {
      type: 'conversion_release',
      amount: Number(payout.pointAmount || request.pointAmount || 0),
      idempotencyKey: `conversion-release:${request.id}`,
      reference: request.id,
      metadata: { payoutId: payout.id, reason: String(req.body?.reason || 'admin_cancelled_before_signing').slice(0, 200) },
    });
    payout.status = 'cancelled';
    payout.cancelledAt = now();
    payout.updatedAt = now();
    payout.lastError = '';
    request.status = 'cancelled';
    request.cancelledAt = payout.cancelledAt;
    request.updatedAt = now();
    request.releaseLedgerId = release.id;
    data.events.push({ type: 'admin_payout_cancel', adminId: req.admin.id, payoutId: payout.id, requestId: request.id, releaseLedgerId: release.id, at: now() });
    writeData(data);
    return res.json({ ok: true, payout: publicPayout(payout) });
  }
  return res.status(400).json({ ok: false, message: 'Unsupported payout action.' });
});

app.get('/api/admin/distribution-simulator', requireAdmin, (req, res) => {
  const data = readData();
  const pending = (data.convertRequests || []).filter((r) => ['queued', 'broadcasting', 'needs_review'].includes(r.status));
  const totalAmount = pending.reduce((sum, r) => sum + Number(r.tokenAmount || 0), 0);
  const completed = (data.convertRequests || []).filter((r) => r.status === 'completed');
  res.json({ ok: true, simulator: {
    recipients: pending.length,
    totalAmount,
    completed: completed.length,
    completedAmount: completed.reduce((sum, r) => sum + Number(r.tokenAmount || 0), 0),
    estimatedSolFee: Number((pending.length * 0.00001).toFixed(6)),
    mode: conversionRuntimeStatus(data).ready ? 'automatic_payout_ready' : 'locked',
    note: 'Actual payout requires KYC approval, signed wallet ownership, an enabled conversion window, and a configured Solana treasury.'
  } });
});

app.get('/api/admin/ranking/full', requireAdmin, (req, res) => {
  const data = readData();
  const users = Object.values(data.users || {}).map((u) => publicAdminUser(data, u));
  res.json({ ok: true, ranking: { global: [...users].sort((a,b)=>Number(b.balance||0)-Number(a.balance||0)).slice(0,100), fleet: [...users].sort((a,b)=>Number(b.activeFleet||0)-Number(a.activeFleet||0)).slice(0,100), trusted: [...users].sort((a,b)=>Number(b.risk?.trustScore||0)-Number(a.risk?.trustScore||0)).slice(0,100) } });
});

app.post('/api/admin/mission/update', requireAdmin, (req, res) => {
  const data = readData();
  const mission = (data.missions || []).find((m) => m.id === String(req.body?.id || ''));
  if (!mission) return res.status(404).json({ ok: false, message: 'Mission not found' });
  if (req.body?.reward !== undefined) {
    const reward = Number(req.body.reward);
    if (!Number.isFinite(reward) || reward < 0 || reward > 100000) return res.status(400).json({ ok: false, message: 'Mission reward is invalid.' });
    mission.reward = reward;
  }
  if (req.body?.enabled !== undefined) mission.enabled = Boolean(req.body.enabled);
  if (req.body?.title !== undefined) {
    const title = String(req.body.title).trim().slice(0, 100);
    if (!title) return res.status(400).json({ ok: false, message: 'Mission title is required.' });
    mission.title = title;
  }
  if (req.body?.url !== undefined) {
    try {
      const url = new URL(String(req.body.url));
      if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Unsupported protocol');
      mission.url = url.toString();
    } catch {
      return res.status(400).json({ ok: false, message: 'Mission URL must be a valid HTTP or HTTPS address.' });
    }
  }
  data.events.push({ type: 'admin_mission_update', adminId: req.admin.id, missionId: mission.id, mission, at: now() });
  writeData(data);
  res.json({ ok: true, mission });
});


app.get('/api/admin/mining/engine', requireAdmin, (req, res) => {
  const data = readData();
  const users = Object.values(data.users || {});
  const phase = miningPhase(data);
  const active = users.filter((u) => calculateMining(data, u).active).map((u) => ({ user: publicAdminUser(data, u), mining: calculateMining(data, u) }));
  const events = data.events || [];
  const dayAgo = now() - 24 * 60 * 60 * 1000;
  const today = events.filter((e) => e.at >= dayAgo);
  const todayClaims = today.filter((e) => e.type === 'mining_claim');
  const todayMined = todayClaims.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  res.json({ ok: true, engine: { version: data.settings?.miningEngineVersion || '1.0.0', sandbox: Boolean(data.settings?.miningSandboxEnabled), sandboxMinutes: data.settings?.miningSandboxMinutes || 5, eventMultiplier: data.settings?.eventMultiplier || 1, activeMiners: active.length, todayMiningStarts: today.filter((e) => e.type === 'mining_start').length, todayClaims: todayClaims.length, todayMined, poolUsed: phase.used, poolRemaining: getMiningPoolRemaining(data), pool: phase.pool, poolRatio: phase.ratio, phase: phase.phase, phaseReward: phase.reward, active } });
});
app.post('/api/admin/mining/settings', requireAdmin, (req, res) => {
  const data = readData();
  data.settings ||= {};
  if (req.body?.miningSandboxEnabled !== undefined) data.settings.miningSandboxEnabled = Boolean(req.body.miningSandboxEnabled);
  if (req.body?.miningSandboxMinutes !== undefined) data.settings.miningSandboxMinutes = Math.max(1, Number(req.body.miningSandboxMinutes));
  if (req.body?.eventMultiplier !== undefined) data.settings.eventMultiplier = Math.max(0, Number(req.body.eventMultiplier));
  data.events.push({ type: 'admin_mining_settings_update', adminId: req.admin.id, settings: data.settings, at: now() });
  writeData(data);
  res.json({ ok: true, settings: data.settings });
});
app.post('/api/admin/mining/force-reset', requireAdmin, (req, res) => {
  const data = readData();
  const userId = String(req.body?.userId || '');
  const user = data.users?.[userId];
  if (!user) return res.status(404).json({ ok: false, message: 'User not found' });
  user.mining = null;
  user.updatedAt = now();
  data.events.push({ type: 'admin_mining_force_reset', adminId: req.admin.id, userId, at: now() });
  writeData(data);
  res.json({ ok: true, user: publicAdminUser(data, user) });
});

app.get('/api/admin/operations', requireAdmin, (req, res) => {
  const data = readData();
  const since = now() - 24 * 60 * 60 * 1000;
  const events = (data.events || []).filter((event) => Number(event.at || 0) >= since);
  const users = Object.values(data.users || {});
  const gameEvents = events.filter((event) => event.type === 'game_reward');
  const novaEvents = events.filter((event) => event.type === 'nova_chat');
  res.json({
    ok: true,
    operations: {
      system: {
        maintenanceMode: Boolean(data.settings?.maintenanceMode),
        telegramUsers: users.filter((user) => user.telegramId).length,
        guestUsers: users.filter((user) => !user.telegramId).length,
        ledgerIntegrity: verifyLedgerIntegrity(data),
      },
      game: {
        enabled: Boolean(data.settings?.gameRewardsEnabled),
        dailyLimit: Number(data.settings?.gameDailyLimit || GAME_DAILY_LIMIT),
        sessions24h: gameEvents.length,
        rewards24h: gameEvents.reduce((sum, event) => sum + Number(event.reward || 0), 0),
        uniquePlayers24h: new Set(gameEvents.map((event) => event.userId).filter(Boolean)).size,
        topScore24h: Math.max(0, ...gameEvents.map((event) => Number(event.score || 0))),
      },
      nova: {
        enabled: Boolean(data.settings?.novaAiEnabled),
        dailyMessageLimit: NOVA_DAILY_LIMIT,
        requests24h: novaEvents.length,
        uniqueCaptains24h: new Set(novaEvents.map((event) => event.userId).filter(Boolean)).size,
        configured: Boolean(process.env.GEMINI_API_KEY),
        model: NOVA_PUBLIC_MODEL_NAME,
      },
      conversion: {
        ...conversionRuntimeStatus(data),
        queued: (data.payouts || []).filter((payout) => ['queued', 'retry'].includes(payout.status)).length,
        broadcasting: (data.payouts || []).filter((payout) => payout.status === 'broadcasting').length,
        needsReview: (data.payouts || []).filter((payout) => payout.status === 'needs_review').length,
        completed: (data.payouts || []).filter((payout) => payout.status === 'completed').length,
      },
    },
  });
});


// V8 Unified Platform API helpers
function v8TodayKey() {
  return new Date(Date.now()).toISOString().slice(0, 10);
}

function v8EnsureMissions(data) {
  data.missions ||= [
    { id: 'website', icon: '🌐', title: 'Website', type: 'one_time', reward: 100, url: 'https://spacenovax.com', action: 'OPEN', enabled: true },
    { id: 'telegram', icon: '📢', title: 'Join SpaceNovaX Telegram Channel', type: 'one_time', reward: 300, url: 'https://t.me/spacenovaxteam', action: 'JOIN CHANNEL', enabled: true },
    { id: 'x', icon: '𝕏', title: 'X Twitter', type: 'one_time', reward: 300, url: 'https://x.com/spacenovaxteam', action: 'FOLLOW', enabled: true },
    { id: 'discord', icon: '💬', title: 'Discord', type: 'one_time', reward: 300, url: 'https://discord.gg/rxVNWMC8e8', action: 'JOIN', enabled: true },
    { id: 'youtube_subscribe', icon: '▶️', title: 'YouTube Subscribe', type: 'one_time', reward: 300, url: 'https://youtube.com/@spacenovaxteam', action: 'SUBSCRIBE', enabled: true }
  ];
}

function v8MissionStatus(user, mission) {
  user.missionClaims ||= {};
  user.missionOpens ||= {};
  const claim = user.missionClaims[mission.id];
  if (!claim) {
    const openedAt = Number(user.missionOpens[mission.id]?.at || 0);
    return {
      completed: false,
      openedAt: openedAt || null,
      verificationReadyAt: openedAt ? openedAt + 15_000 : null
    };
  }
  if (mission.type === 'daily') return { completed: claim.date === v8TodayKey(), claimedAt: claim.at || null };
  return { completed: true, claimedAt: claim.at || null };
}

app.post('/api/missions/open', (req, res) => {
  const data = readData();
  v8EnsureMissions(data);
  const user = getSessionUser(req, data);
  if (!requireVerifiedCaptain(user, res)) return;
  const mission = data.missions.find((item) => item.id === String(req.body?.missionId || '') && item.enabled !== false);
  if (!mission) return res.status(404).json({ ok: false, message: 'Mission not found.' });
  user.missionOpens ||= {};
  user.missionOpens[mission.id] ||= { at: now() };
  data.events.push({ type: 'mission_open', userId: user.id, missionId: mission.id, at: now() });
  writeData(data);
  res.json({ ok: true, status: v8MissionStatus(user, mission), url: mission.url });
});

app.get('/api/missions', (req, res) => {
  const data = readData();
  v8EnsureMissions(data);
  const user = getSessionUser(req, data);
  const missions = data.missions.filter((m) => m.enabled !== false).map((m) => ({ ...m, status: v8MissionStatus(user, m) }));
  writeData(data);
  res.json({ ok: true, missions });
});

app.post('/api/missions/claim', (req, res) => {
  const data = readData();
  v8EnsureMissions(data);
  const user = getSessionUser(req, data);
  if (!requireVerifiedCaptain(user, res)) return;
  const mission = data.missions.find((m) => m.id === String(req.body?.missionId || '') && m.enabled !== false);
  if (!mission) return res.status(404).json({ ok: false, message: 'Mission not found' });
  if (v8MissionStatus(user, mission).completed) {
    return res.status(400).json({ ok: false, message: mission.type === 'daily' ? 'Daily already claimed today.' : 'One-time mission already completed.' });
  }
  const openedAt = Number(user.missionOpens?.[mission.id]?.at || 0);
  if (!openedAt) return res.status(409).json({ ok: false, message: 'Open the official channel before requesting verification.' });
  if (now() - openedAt < 15_000) return res.status(409).json({ ok: false, message: 'Return after reviewing the official channel to verify this mission.' });
  const reward = Number(mission.reward || 0);
  user.missionClaims ||= {};
  user.missionClaims[mission.id] = { at: Date.now(), date: v8TodayKey(), reward, type: mission.type };
  const ledgerEntry = appendLedger(data, user, {
    type: 'mission_reward',
    amount: reward,
    idempotencyKey: `mission:${user.id}:${mission.id}`,
    reference: mission.id
  });
  data.events.push({ type: 'mission_claim', userId: user.id, missionId: mission.id, reward, ledgerId: ledgerEntry?.id, at: Date.now() });
  writeData(data);
  res.json({ ok: true, reward, user: publicUser(data, user) });
});


// Server-signed game rewards. The browser can never authorize its own score or reward.
app.post('/api/game/reward', (req, res) => {
  const data = readData();
  if (!data.settings?.gameRewardsEnabled) return res.status(503).json({ ok: false, message: 'Game rewards are temporarily disabled.' });
  const user = getSessionUser(req, data);
  if (!requireVerifiedCaptain(user, res)) return;
  if (!gameRewardSignatureValid(req, user)) {
    return res.status(401).json({ ok: false, message: 'Game reward could not be verified by the SpaceNovaX game server.' });
  }
  const today = gameRewardWindowKey();
  const eventId = String(req.body?.eventId || '');
  const rewardType = String(req.body?.rewardType || '');
  const requested = Math.max(0, Number(req.body?.reward || 0));
  const score = Math.max(0, Number(req.body?.score || 0));
  if (!eventId || !['diamonds','supply','boss'].includes(rewardType) || !Number.isFinite(score) || !Number.isFinite(requested) || score > 1_000_000_000) {
    return res.status(400).json({ ok: false, message: 'Invalid game reward payload.' });
  }
  if (data.ledgerKeys?.[`game:${user.id}:${eventId}`]) {
    return res.status(409).json({ ok: false, message: 'This game result was already processed.' });
  }

  user.gameReward ||= { date: today, earnedToday: 0, bestScore: 0, breakdown: {} };
  if (user.gameReward.date !== today) {
    user.gameReward = { date: today, earnedToday: 0, bestScore: user.gameReward.bestScore || 0, breakdown: {} };
  }
  user.gameReward.breakdown ||= {};
  const used = Number(user.gameReward.breakdown[rewardType] || 0);
  const validReward = rewardType === 'diamonds'
    ? requested === 10 && used < 2
    : rewardType === 'supply'
      ? requested >= 1 && requested <= 5 && used < 1
      : requested === 5 && used < 1;
  if (!validReward) {
    return res.status(400).json({ ok: false, message: 'This reward type, value, or daily frequency is not allowed.' });
  }

  const dailyLimit = GAME_DAILY_LIMIT;
  const remaining = Math.max(0, dailyLimit - Number(user.gameReward.earnedToday || 0));
  const reward = Math.min(requested, remaining);

  if (reward <= 0) {
    user.gameReward.bestScore = Math.max(Number(user.gameReward.bestScore || 0), score);
    writeData(data);
    return res.json({ ok: true, reward: 0, message: 'Daily game reward cap reached.', user: publicUser(data, user) });
  }

  const ledgerEntry = appendLedger(data, user, {
    type: 'game_reward',
    amount: reward,
    idempotencyKey: `game:${user.id}:${eventId}`,
    reference: eventId,
    metadata: { score, date: today, rewardType }
  });
  user.gameReward.earnedToday = Number(user.gameReward.earnedToday || 0) + reward;
  user.gameReward.breakdown[rewardType] = used + 1;
  user.gameReward.bestScore = Math.max(Number(user.gameReward.bestScore || 0), score);
  user.updatedAt = Date.now();

  data.events.push({ type: 'game_reward', rewardType, userId: user.id, reward, score, eventId, ledgerId: ledgerEntry?.id, date: today, at: Date.now() });
  writeData(data);

  res.json({ ok: true, reward, user: publicUser(data, user) });
});


// Legacy V8.2 conversion route retained only for migration compatibility.
app.post('/api/legacy/conversion/request', (req, res) => {
  res.status(410).json({ ok: false, message: 'SPNX conversion is not open. KYC and conversion will launch after community activation.' });
});


// V9 Ultimate KYC API
app.post('/api/kyc/submit', (req, res) => {
  res.status(410).json({
    ok: false,
    message: 'KYC is coming soon. SpaceNovaX does not currently collect identity documents or personal KYC forms.'
  });
});

// V9 Ultimate Wallet API
app.post('/api/wallet/challenge', (req, res) => {
  const data = readData();
  const user = getSessionUser(req, data);
  if (!requireVerifiedCaptain(user, res)) return;
  const wallet = String(req.body?.wallet || '').trim();
  if (!validateSolanaAddress(wallet)) return res.status(400).json({ ok: false, message: 'Invalid Solana wallet address.' });
  const duplicate = Object.values(data.users || {}).find((candidate) => candidate.id !== user.id && candidate.verifiedSolanaWallet === wallet);
  if (duplicate) return res.status(409).json({ ok: false, message: 'This verified wallet is already linked to another Captain.' });
  const challenge = {
    nonce: crypto.randomBytes(24).toString('hex'),
    wallet,
    createdAt: now(),
    expiresAt: now() + 10 * 60 * 1000,
  };
  data.walletChallenges[user.id] = challenge;
  data.events.push({ type: 'wallet_challenge_created', userId: user.id, wallet, at: now() });
  writeData(data);
  res.json({ ok: true, wallet, message: walletVerificationMessage(user.id, challenge), expiresAt: challenge.expiresAt });
});

app.post('/api/wallet/verify', (req, res) => {
  const data = readData();
  const user = getSessionUser(req, data);
  if (!requireVerifiedCaptain(user, res)) return;
  const wallet = String(req.body?.wallet || '').trim();
  const signatureText = String(req.body?.signature || '').trim();
  const challenge = data.walletChallenges?.[user.id];
  if (!challenge || challenge.wallet !== wallet || challenge.expiresAt < now()) {
    return res.status(400).json({ ok: false, message: 'Wallet verification challenge is missing or expired.' });
  }
  if (!validateSolanaAddress(wallet)) return res.status(400).json({ ok: false, message: 'Invalid Solana wallet address.' });
  let signature;
  try {
    signature = signatureText.startsWith('base64:')
      ? Buffer.from(signatureText.slice(7), 'base64')
      : bs58.decode(signatureText);
  } catch {
    return res.status(400).json({ ok: false, message: 'Wallet signature encoding is invalid.' });
  }
  const valid = nacl.sign.detached.verify(
    Buffer.from(walletVerificationMessage(user.id, challenge), 'utf8'),
    signature,
    bs58.decode(wallet),
  );
  if (!valid) return res.status(401).json({ ok: false, message: 'Wallet ownership signature is invalid.' });
  const duplicate = Object.values(data.users || {}).find((candidate) => candidate.id !== user.id && candidate.verifiedSolanaWallet === wallet);
  if (duplicate) return res.status(409).json({ ok: false, message: 'This verified wallet is already linked to another Captain.' });
  user.solanaWallet = wallet;
  user.verifiedSolanaWallet = wallet;
  user.walletVerifiedAt = now();
  user.walletUpdatedAt = now();
  delete data.walletChallenges[user.id];
  data.events.push({ type: 'wallet_verified', userId: user.id, wallet, at: now() });
  writeData(data);
  res.json({ ok: true, user: publicUser(data, user) });
});

app.post('/api/wallet/save', (req, res) => {
  const data = readData();
  const user = getSessionUser(req, data);
  const wallet = String(req.body?.wallet || '').trim();

  if (!validateSolanaAddress(wallet)) return res.status(400).json({ ok: false, message: 'Invalid Solana wallet address.' });

  const duplicate = Object.values(data.users || {}).find((u) => u.id !== user.id && String(u.verifiedSolanaWallet || '').trim() === wallet);
  if (duplicate) return res.status(400).json({ ok: false, message: 'This wallet is already registered to another account.' });

  user.solanaWallet = wallet;
  if (user.verifiedSolanaWallet !== wallet) {
    user.verifiedSolanaWallet = '';
    user.walletVerifiedAt = 0;
  }
  user.walletUpdatedAt = Date.now();
  user.updatedAt = Date.now();
  data.events.push({ type: 'wallet_candidate_saved', userId: user.id, wallet, verified: false, at: Date.now() });
  writeData(data);
  res.json({ ok: true, verificationRequired: true, user: publicUser(data, user) });
});

// V9 Ultimate Token Conversion API
app.post('/api/conversion/request', (req, res) => {
  res.status(409).json({
    ok: false,
    message: 'SPNX Points conversion is coming soon and will open only after professional KYC integration.'
  });
});

// Legacy game route retained only for migration compatibility.
app.post('/api/legacy/game/reward', (req, res) => {
  res.status(410).json({ ok: false, message: 'Legacy client-authorized game rewards have been retired.' });
});

app.post('/api/nova/chat', async (req, res) => {
  const data = readData();
  if (!data.settings?.novaAiEnabled) {
    return res.status(503).json({ ok: false, message: 'NOVA AI is temporarily disabled by Command.' });
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ ok: false, message: 'NOVA AI core is not configured.' });
  }

  const message = String(req.body?.message || '').trim().slice(0, 2000);
  const history = Array.isArray(req.body?.history) ? req.body.history.slice(-10) : [];
  const captain = req.body?.captainContext || {};
  const sessionUser = getSessionUser(req, data);
  const userId = sessionUser.id;
  const language = String(req.body?.language || 'en').toLowerCase();
  const dayKey = new Date(now()).toISOString().slice(0, 10);
  const recentUsage = (data.events || []).filter((event) =>
    event.type === 'nova_chat' &&
    event.userId === userId &&
    (event.dayKey || new Date(Number(event.at || 0)).toISOString().slice(0, 10)) === dayKey
  ).length;
  const pendingUsage = (data.events || []).filter((event) =>
    event.type === 'nova_chat_pending' &&
    event.userId === userId &&
    event.dayKey === dayKey &&
    now() - Number(event.at || 0) < 2 * 60 * 1000
  ).length;
  if (recentUsage + pendingUsage >= NOVA_DAILY_LIMIT) {
    const message = language === 'ko'
      ? 'NOVA AI는 현재 베타 개발 단계입니다.\n\n안정적인 서비스 제공을 위해 계정당 하루 10회까지 이용할 수 있습니다.\n\n내일 다시 이용해 주세요.\n\nSpaceNovaX를 응원해 주셔서 감사합니다.'
      : 'NOVA AI is currently in the Beta development stage.\n\nTo ensure stable service for all community members, each account can use NOVA AI up to 10 times per day.\n\nPlease come back tomorrow.\n\nThank you for supporting SpaceNovaX.';
    return res.status(429).json({
      ok: false,
      code: 'NOVA_DAILY_LIMIT',
      message,
      limit: NOVA_DAILY_LIMIT,
      used: recentUsage,
    });
  }
  if (!message) return res.status(400).json({ ok: false, message: 'Message is required.' });
  const requestId = `nova-${crypto.randomUUID()}`;
  data.events.push({ type: 'nova_chat_pending', requestId, userId, dayKey, at: now() });
  writeData(data);
  const releaseReservation = () => {
    const latestData = readData();
    latestData.events = (latestData.events || []).filter((event) => !(event.type === 'nova_chat_pending' && event.requestId === requestId));
    writeData(latestData);
  };

  const systemInstruction = [
    'You are NOVA AI, the official SpaceNovaX AI commander.',
    'Always identify yourself only as NOVA AI. Never mention the underlying model provider, model family, or internal implementation.',
    'Help community Captains with SpaceNovaX, mining, missions, game strategy, Web3 education, and general questions.',
    'Be concise, calm, futuristic, and useful. Reply in the language used by the Captain.',
    'Never request passwords, seed phrases, wallet private keys, or Telegram login codes.',
    'Do not claim that SPNX Points are guaranteed money or promise investment returns.',
    `Captain context: level=${Number(sessionUser.level || captain.level || 1)}, balance=${Number(sessionUser.balance || 0)}, miningActive=${Boolean(sessionUser.mining?.active)}, gameRewardToday=${Number(sessionUser.gameReward?.earnedToday || 0)}.`,
  ].join('\n');

  const contents = [
    ...history
      .filter((item) => item && ['user', 'assistant'].includes(item.role))
      .map((item) => ({
        role: item.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(item.text || '').slice(0, 2000) }],
      })),
    {
      role: 'user',
      parts: [{ text: message }],
    },
  ];

  try {
    const model = process.env.GEMINI_MODEL || NOVA_DEFAULT_MODEL;
    const apiBase = String(process.env.GEMINI_API_BASE_URL || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '');
    const endpoint = `${apiBase}/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents,
        generationConfig: {
          maxOutputTokens: 700,
          temperature: 0.7,
        },
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      console.error('NOVA AI upstream error', response.status, result?.error?.message || 'unknown');
      releaseReservation();
      return res.status(502).json({ ok: false, message: 'NOVA AI is temporarily unavailable.' });
    }
    const reply = (result.candidates?.[0]?.content?.parts || [])
      .map((part) => String(part?.text || ''))
      .join('')
      .trim();
    if (!reply) {
      releaseReservation();
      return res.status(502).json({ ok: false, message: 'NOVA AI returned no response.' });
    }
    const latestData = readData();
    const reservation = latestData.events.find((event) => event.type === 'nova_chat_pending' && event.requestId === requestId);
    if (reservation) {
      reservation.type = 'nova_chat';
      reservation.model = NOVA_PUBLIC_MODEL_NAME;
      reservation.completedAt = now();
    } else {
      latestData.events.push({ type: 'nova_chat', requestId, userId, dayKey, model: NOVA_PUBLIC_MODEL_NAME, at: now() });
    }
    writeData(latestData);
    res.json({ ok: true, reply, usage: { used: recentUsage + 1, limit: NOVA_DAILY_LIMIT } });
  } catch (error) {
    console.error('NOVA AI connection error', error);
    releaseReservation();
    res.status(502).json({ ok: false, message: 'NOVA AI connection failed.' });
  }
});

app.post('/api/nova/speech', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ ok: false, message: 'NOVA voice core is not configured.' });
  }

  const text = String(req.body?.text || '').trim().slice(0, NOVA_TTS_MAX_TEXT_LENGTH);
  const language = String(req.body?.language || 'en').toLowerCase().slice(0, 8);
  if (!text) return res.status(400).json({ ok: false, message: 'Speech text is required.' });

  const clientKey = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
  const cutoff = now() - NOVA_TTS_RATE_WINDOW;
  const recent = (novaTtsUsage.get(clientKey) || []).filter((timestamp) => timestamp > cutoff);
  if (recent.length >= NOVA_TTS_RATE_LIMIT) {
    return res.status(429).json({ ok: false, message: 'NOVA voice limit reached. Please try again later.' });
  }
  recent.push(now());
  novaTtsUsage.set(clientKey, recent);

  const cacheKey = crypto.createHash('sha256').update(`${language}\n${text}`).digest('hex');
  const cached = novaTtsCache.get(cacheKey);
  if (cached) {
    res.set({ 'Content-Type': 'audio/wav', 'Cache-Control': 'private, max-age=86400', 'X-NOVA-Voice': 'cache' });
    return res.send(cached);
  }

  const languageName = language === 'ko' ? 'Korean' : 'English';
  const prompt = [
    `Generate speech in ${languageName} using a calm, confident female AI commander voice.`,
    'Read only the transcript between the markers. Do not read these instructions.',
    '--- TRANSCRIPT ---',
    text,
    '--- END TRANSCRIPT ---',
  ].join('\n');

  try {
    const primaryModel = process.env.NOVA_TTS_MODEL || NOVA_TTS_DEFAULT_MODEL;
    const fallbackModel = process.env.NOVA_TTS_FALLBACK_MODEL || NOVA_TTS_FALLBACK_MODEL;
    const apiBase = String(process.env.GEMINI_API_BASE_URL || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '');
    const attempts = [primaryModel, primaryModel];
    if (fallbackModel && fallbackModel !== primaryModel) attempts.push(fallbackModel);

    let audio = null;
    let selectedModel = primaryModel;
    let lastFailure = { status: 502, message: 'No audio returned.' };
    for (const model of attempts) {
      const result = await requestNovaSpeech({ apiBase, apiKey, model, prompt });
      if (result.ok && result.audio?.data) {
        audio = result.audio;
        selectedModel = model;
        break;
      }
      lastFailure = { status: result.status, message: result.message || 'No audio returned.' };
      console.error('NOVA voice upstream attempt failed', model, lastFailure.status, lastFailure.message);
    }

    if (!audio?.data) {
      console.error('NOVA voice exhausted all models', lastFailure.status, lastFailure.message);
      return res.status(502).json({ ok: false, message: 'NOVA voice returned no audio.' });
    }

    const decoded = Buffer.from(audio.data, 'base64');
    const mimeType = String(audio.mime_type || audio.mimeType || 'audio/l16').toLowerCase();
    const sampleRate = Number(audio.sample_rate || audio.sampleRate || 24000);
    const wave = mimeType === 'audio/wav' ? decoded : pcmToWave(decoded, sampleRate);
    novaTtsCache.set(cacheKey, wave);
    if (novaTtsCache.size > 100) novaTtsCache.delete(novaTtsCache.keys().next().value);
    res.set({
      'Content-Type': 'audio/wav',
      'Cache-Control': 'private, max-age=86400',
      'X-NOVA-Voice': 'generated',
      'X-NOVA-Voice-Model': selectedModel === primaryModel ? 'primary' : 'fallback',
    });
    res.send(wave);
  } catch (error) {
    console.error('NOVA voice connection error', error);
    res.status(502).json({ ok: false, message: 'NOVA voice connection failed.' });
  }
});

app.get('/api/nova/status', (req, res) => {
  const data = readData();
  res.json({
    ok: true,
    enabled: Boolean(data.settings?.novaAiEnabled),
    configured: Boolean(process.env.GEMINI_API_KEY),
    model: NOVA_PUBLIC_MODEL_NAME,
    dailyLimit: NOVA_DAILY_LIMIT,
  });
});

async function runAutomaticPayoutWorker() {
  const data = readData();
  if (!conversionRuntimeStatus(data).ready) return;
  const payout = (data.payouts || []).find((item) => ['queued', 'retry', 'broadcasting'].includes(item.status));
  if (!payout) return;
  try {
    await processPayout(payout.id, 'scheduled_worker');
  } catch (error) {
    console.error('Scheduled SPNX payout failed', payout.id, error.message);
  }
}

const distPath = path.join(__dirname, 'dist');
fs.mkdirSync(COMMUNITY_MEDIA_DIR, { recursive: true });
app.use('/community-media', express.static(COMMUNITY_MEDIA_DIR, { fallthrough: false, maxAge: '7d', immutable: false }));
app.use(express.static(distPath));

app.use((req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`SpaceNovaX V15 Command Network running on port ${PORT}`);
  const payoutTimer = setInterval(runAutomaticPayoutWorker, 30_000);
  payoutTimer.unref();
  setTimeout(runAutomaticPayoutWorker, 5_000).unref();
});
