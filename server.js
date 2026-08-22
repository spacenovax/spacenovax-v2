Warning: truncated output (original token count: 74252)
Total output lines: 5479

import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import pg from 'pg';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import {
  broadcastSignedPayout,
  inspectSignedPayout,
  prepareSignedPayout,
  solanaPayoutConfig,
  validateSolanaAddress,
} from './lib/solanaPayout.js';
import { tonPayoutConfig } from './lib/tonPayout.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// The official NOVA-X game is hosted separately. Only its verified origin may
// send a signed short-lived game session back to this API for reward settlement.
const GAME_ALLOWED_ORIGINS = new Set([
  'https://nova-x1-genesis-defense.kit372002.chatgpt.site',
  'https://game.spacenovax.com',
]);
const PUBLIC_WEB_ORIGINS = new Set([
  'https://spacenovax.com',
  'https://www.spacenovax.com',
]);
app.use((req, res, next) => {
  const origin = String(req.headers.origin || '');
  if (GAME_ALLOWED_ORIGINS.has(origin) || (PUBLIC_WEB_ORIGINS.has(origin) && req.path === '/api/ecosystem-stats')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
const PORT = process.env.PORT || 3000;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'spacenovax-data.json');
// Public share links must resolve to this server so KakaoTalk and Telegram can
// read the Open Graph card before a Captain opens the Telegram Mini App.
const PUBLIC_APP_ORIGIN = String(process.env.PUBLIC_APP_ORIGIN || 'https://app.spacenovax.com').replace(/\/$/, '');
// Changing this creates a new Open Graph URL, so Telegram/Kakao fetch a fresh
// invitation preview instead of reusing an older card cached for the same code.
const REFERRAL_SHARE_VERSION = 'join-fleet-20260814';
const TELEGRAM_BOT_USERNAME = String(process.env.TELEGRAM_BOT_USERNAME || 'SpaceNovaXAdminBot').replace(/^@/, '').replace(/[^A-Za-z0-9_]/g, '') || 'SpaceNovaXAdminBot';
const WEBAUTHN_RP_ID = String(process.env.WEBAUTHN_RP_ID || new URL(PUBLIC_APP_ORIGIN).hostname).toLowerCase();
const WEBAUTHN_ORIGIN = String(process.env.WEBAUTHN_ORIGIN || PUBLIC_APP_ORIGIN).replace(/\/$/, '');
const WEBAUTHN_CHALLENGE_TTL_MS = 5 * 60 * 1000;
const REFERRAL_HARD_LIMIT = 1000;
const COMMUNITY_MEDIA_DIR = process.env.COMMUNITY_MEDIA_DIR || path.join(__dirname, 'community-media');
const DATABASE_URL = String(process.env.DATABASE_URL || '').trim();
const { Pool } = pg;
const databasePool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL }) : null;
let databaseState = null;
let databaseWriteQueue = Promise.resolve();
let databaseRevision = 0;

const MINING_DURATION = 24 * 60 * 60 * 1000;
const BASE_MINING_REWARD = 30;
const GAME_DAILY_LIMIT = 30;
const GAME_SESSION_TTL_MS = 10 * 60 * 1000;
const NOVA_DAILY_LIMIT = 10;
const NOVA_PUBLIC_MODEL_NAME = 'NOVA Beta';
const NOVA_GROQ_DEFAULT_MODEL = 'llama-3.1-8b-instant';
const NOVA_GEMINI_DEFAULT_MODEL = 'gemini-2.5-flash';
// NOVA is intentionally concise during the beta stage.  This reduces latency
// and makes the shared free provider quota last for more Captains.
const NOVA_RESPONSE_MAX_TOKENS = Math.max(96, Math.min(320, Number(process.env.NOVA_RESPONSE_MAX_TOKENS || 220)));
const novaChatQueues = new Map();
const OFFICIAL_MISSION_IDS = ['website', 'telegram', 'discord', 'x', 'youtube_subscribe'];
const COMMUNITY_NODE_LIMIT = 1000;
const COMMUNITY_NODE_BONUS_PERCENT = 25;
const COMMUNITY_NODE_PAIRING_TTL_MS = 10 * 60 * 1000;
const COMMUNITY_NODE_TOKEN_TTL_MS = 15 * 60 * 1000;
const COMMUNITY_NODE_HEARTBEAT_GRACE_MS = 2 * 60 * 1000;
const COMMUNITY_NODE_MAX_CREDIT_GAP_MS = 2 * 60 * 1000;
const COMMUNITY_NODE_MINIMUM_CONTRIBUTION_MS = 24 * 60 * 60 * 1000;
const COMMUNITY_NODE_MINIMUM_AVAILABILITY = 0.90;
const COMMUNITY_NODE_MINIMUM_WORK_SUCCESS_RATE = 0.98;
const COMMUNITY_NODE_MINIMUM_HEARTBEAT_SUCCESS_RATE = 0.95;
const COMMUNITY_NODE_MAX_AVERAGE_LATENCY_MS = 1500;
const COMMUNITY_NODE_WORK_TYPES = new Set([
  'spnx-public-ranking-cache', 'spnx-public-missions-cache', 'spnx-i18n-cache',
  'navigation-satellite-cache', 'navigation-weather-status', 'navigation-route-gateway-status',
  'nova-ai-public-help-cache', 'nova-ai-service-health',
  'nova-x-game-gateway-status', 'nova-x-public-ranking-cache', 'nova-x-asset-integrity',
]);
const GLOBAL_CHAT_MAX_ROOM_MODERATORS = 10;
const GLOBAL_CHAT_MAX_MESSAGE_LENGTH = 400;
const GLOBAL_CHAT_MAX_IMAGE_BYTES = 700_000;
const GLOBAL_CHAT_SEND_WINDOW_MS = 60 * 1000;
const GLOBAL_CHAT_MAX_MESSAGES_PER_WINDOW = 8;
// Keep the global chat useful without allowing unbounded database or media growth.
// These values can be overridden at deployment time without changing the app.
const GLOBAL_CHAT_ROOM_MESSAGE_LIMIT = Math.max(200, Math.min(5000, Number(process.env.GLOBAL_CHAT_ROOM_MESSAGE_LIMIT || 1200)));
const GLOBAL_CHAT_TOTAL_MESSAGE_LIMIT = Math.max(GLOBAL_CHAT_ROOM_MESSAGE_LIMIT, Math.min(60000, Number(process.env.GLOBAL_CHAT_TOTAL_MESSAGE_LIMIT || GLOBAL_CHAT_ROOM_MESSAGE_LIMIT * 12)));
const GLOBAL_CHAT_ROOM_MEDIA_LIMIT = Math.max(50, Math.min(1000, Number(process.env.GLOBAL_CHAT_ROOM_MEDIA_LIMIT || 150)));
const NAVIGATION_REPORT_DAILY_LIMIT = 8;
const NAVIGATION_REPORT_RETENTION = 5000;
const GLOBAL_CHAT_ROOMS = [
  { id: 'global-en', flag: '🌐', name: 'Global (English)', nativeName: 'Global', language: 'English' },
  { id: 'korea', flag: '🇰🇷', name: 'Korea', nativeName: '한국어', language: 'Korean' },
  { id: 'japan', flag: '🇯🇵', name: 'Japan', nativeName: '日本語', language: 'Japanese' },
  { id: 'china', flag: '🇨🇳', name: 'China', nativeName: '中文', language: 'Chinese' },
  { id: 'vietnam', flag: '🇻🇳', name: 'Vietnam', nativeName: 'Tiếng Việt', language: 'Vietnamese' },
  { id: 'spain', flag: '🇪🇸', name: 'Spanish Community', nativeName: 'Español', language: 'Spanish' },
  { id: 'brazil', flag: '🇧🇷', name: 'Brazil & Portugal', nativeName: 'Português', language: 'Portuguese' },
  { id: 'russia', flag: '🇷🇺', name: 'Russia', nativeName: 'Русский', language: 'Russian' },
  { id: 'india', flag: '🇮🇳', name: 'India', nativeName: 'हिन्दी', language: 'Hindi' },
  { id: 'turkiye', flag: '🇹🇷', name: 'Türkiye', nativeName: 'Türkçe', language: 'Turkish' },
  { id: 'indonesia', flag: '🇮🇩', name: 'Indonesia', nativeName: 'Bahasa Indonesia', language: 'Indonesian' },
  { id: 'arabic', flag: '🌍', name: 'Arabic Region', nativeName: 'العربية', language: 'Arabic' },
];
const GLOBAL_CHAT_ROOM_BY_ID = new Map(GLOBAL_CHAT_ROOMS.map((room) => [room.id, room]));
const MAX_SPONSORED_PARTNERS = 5;
const MAX_SPONSORED_BANNER_IMAGE_BYTES = 900_000;
const SPONSORED_BANNER_PLACEMENTS = new Set(['mining-top', 'global-chat', 'navigation-explore']);

const DEFAULT_MISSIONS = [
  { id: 'website', title: 'Visit SpaceNovaX Website', icon: '🌐', reward: 100, type: 'one_time', url: 'https://spacenovax.com', action: 'OPEN', enabled: true },
  { id: 'telegram', title: 'Join SpaceNovaX Telegram Channel', icon: '✈️', reward: 300, type: 'one_time', url: 'https://t.me/spacenovaxteam', action: 'JOIN CHANNEL', enabled: true },
  { id: 'discord', title: 'Join Discord', icon: '💬', reward: 300, type: 'one_time', url: 'https://discord.gg/pChzTUcm2t', action: 'JOIN', enabled: true },
  { id: 'x', title: 'Follow X', icon: '𝕏', reward: 300, type: 'one_time', url: 'https://x.com/spacenovaxteam', action: 'FOLLOW', enabled: true },
  { id: 'youtube_subscribe', title: 'Subscribe YouTube', icon: '📺', reward: 300, type: 'one_time', url: 'https://youtube.com/@spacenovaxteam', action: 'SUBSCRIBE', enabled: true }
];

function now() {
  return Date.now();
}

function enqueueNovaChat(userId, job) {
  const previous = novaChatQueues.get(userId) || Promise.resolve();
  const task = previous.catch(() => undefined).then(job);
  // Keep the next request queue alive after an upstream failure.  Returning
  // the original task still lets the current request handle that failure.
  const tracked = task.catch(() => undefined).finally(() => {
    if (novaChatQueues.get(userId) === tracked) novaChatQueues.delete(userId);
  });
  novaChatQueues.set(userId, tracked);
  return task;
}

function createInitialData() {
  return {
      users: {},
      events: [],
      ledger: [],
      ledgerKeys: {},
      walletChallenges: {},
      tonTestnetConnections: {},
      tonProofChallenges: {},
      conversionBatches: [],
      vestingClaims: [],
      stakingPositions: [],
      webauthnChallenges: {},
      convertRequests: [],
      payouts: [],
      payoutKeys: {},
      distributions: [],
      fleetMessages: [],
      securityInvites: [],
      securityMessages: [],
      fleetNotifications: [],
      fleetWeeklySettlements: {},
      communityPosts: [],
      communityReports: [],
      globalChatMessages: [],
      globalChatReports: [],
      globalChatModeratorApplications: [],
      globalChatModerators: [],
      globalChatMutes: [],
      sponsoredBanners: [],
      sponsoredBannerClicks: {},
      developerGithubConnections: [],
      developerSecurityReports: [],
      communityNodes: {},
      nodePairings: {},
      personalMessages: [],
      announcements: [],
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
        miningPool: 3500000000,
        communityNodeLimit: COMMUNITY_NODE_LIMIT,
        communityNodeBonusPercent: COMMUNITY_NODE_BONUS_PERCENT,
        sponsoredBannersEnabled: false,
        tonTestnetEnabled: true,
        tonTestnetPointsEnabled: true,
        tonMainnetEnabled: false,
        tonProofEnabled: false,
        vestingClaimsEnabled: false,
        stakingEnabled: false
      }
    };
}

function normalizeData(data) {
  data ||= createInitialData();
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
    reward: defaults.reward,
    type: defaults.type,
    enabled: true,
    url: defaults.id === 'discord' && existingMissions[defaults.id]?.url === 'https://discord.gg/rxVNWMC8e8'
      ? defaults.url
      : (existingMissions[defaults.id]?.url || defaults.url),
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
  data.settings.sponsoredBannersEnabled ??= false;
  data.walletChallenges ||= {};
  // TON state is prepared separately from the legacy wallet records. Testnet
  // connections are not asset ownership and no live action is enabled here.
  data.tonTestnetConnections ||= {};
  data.tonProofChallenges ||= {};
  data.conversionBatches ||= [];
  data.vestingClaims ||= [];
  data.stakingPositions ||= [];
  data.testnetPointTransfers ||= [];
  data.settings.tonTestnetEnabled ??= true;
  data.settings.tonTestnetPointsEnabled ??= true;
  data.settings.tonMainnetEnabled ??= false;
  data.settings.tonProofEnabled ??= false;
  data.settings.vestingClaimsEnabled ??= false;
  data.settings.stakingEnabled ??= false;
  data.webauthnChallenges ||= {};
  for (const [challengeId, challenge] of Object.entries(data.webauthnChallenges)) {
    if (!challenge || Number(challenge.expiresAt || 0) < now()) delete data.webauthnChallenges[challengeId];
  }
  data.payouts ||= [];
  data.payoutKeys ||= {};
  data.fleetMessages ||= [];
  data.securityInvites ||= [];
  data.securityMessages ||= [];
  data.securityInvites = data.securityInvites.filter((invite) => invite?.status === 'pending' && Number(invite.expiresAt || 0) > now());
  data.securityMessages = data.securityMessages.slice(-2000);
  data.fleetNotifications ||= [];
  data.fleetWeeklySettlements ||= {};
  data.communityPosts ||= [];
  data.communityReports ||= [];
  data.globalChatMessages ||= [];
  data.globalChatMessages = data.globalChatMessages.slice(-GLOBAL_CHAT_TOTAL_MESSAGE_LIMIT);
  data.globalChatReports ||= [];
  data.globalChatReports = data.globalChatReports.slice(-5000);
  data.globalChatModeratorApplications ||= [];
  data.globalChatModeratorApplications = data.globalChatModeratorApplications.slice(-5000);
  data.globalChatModerators ||= [];
  data.globalChatMutes ||= [];
  data.globalChatMutes = data.globalChatMutes.slice(-5000);
  data.sponsoredBanners ||= [];
  data.sponsoredBanners = data.sponsoredBanners.slice(-50);
  data.sponsoredBannerClicks ||= {};
  data.developerGithubConnections ||= [];
  data.developerGithubConnections = data.developerGithubConnections.slice(-5000);
  data.developerSecurityReports ||= [];
  data.developerSecurityReports = data.developerSecurityReports.slice(-5000);
  data.communityNodes ||= {};
  data.nodePairings ||= {};
  data.personalMessages ||= [];
  data.personalMessages = data.personalMessages.slice(-10000);
  data.messageReports ||= [];
  data.messageReports = data.messageReports.slice(-5000);
  data.announcements ||= [];
  data.announcements = data.announcements.slice(-500);
  // Map issue reports never need an indefinite, precise location history.
  // Coordinates are rounded again at write time and retention is bounded.
  data.navigationReports ||= [];
  data.navigationReports = data.navigationReports.slice(-NAVIGATION_REPORT_RETENTION);
  data.settings.communityNodeLimit ??= COMMUNITY_NODE_LIMIT;
  data.settings.communityNodeBonusPercent ??= COMMUNITY_NODE_BONUS_PERCENT;
  for (const [pairingHash, pairing] of Object.entries(data.nodePairings)) {
    if (!pairing || Number(pairing.expiresAt || 0) < now() || pairing.usedAt) delete data.nodePairings[pairingHash];
  }
  for (const user of Object.values(data.users || {})) {
    user.messageBlocks ||= [];
    user.globalChatBlocks ||= [];
    user.referralCode ||= makeReferralCode(user.id);
    user.referrals ||= [];
    user.securityCircle ||= [];
    user.missionOpens ||= {};
    user.kyc ||= { status: 'not_available', available: false };
    user.communityNodeId ||= '';
    user.announcementReads ||= {};
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

function readFileData() {
  if (!fs.existsSync(DATA_FILE)) {
    const initial = normalizeData(createInitialData());
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
  return normalizeData(JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')));
}

function readData() {
  if (databasePool) {
    if (!databaseState) throw new Error('PostgreSQL state is not initialized.');
    return structuredClone(databaseState);
  }
  return readFileData();
}

function writeData(data) {
  const normalized = normalizeData(structuredClone(data));
  if (databasePool) {
    databaseState = normalized;
    databaseRevision += 1;
    const revision = databaseRevision;
    const snapshot = JSON.stringify(normalized);
    databaseWriteQueue = databaseWriteQueue.catch((error) => {
      console.error('Recovering PostgreSQL persistence queue after failure', error);
    }).then(async () => {
      await databasePool.query(
        `UPDATE spacenovax_state
         SET state = $1::jsonb, revision = $2, updated_at = NOW()
         WHERE id = 1`,
        [snapshot, revision]
      );
    });
    databaseWriteQueue.catch((error) => {
      console.error('PostgreSQL state persistence failed', error);
    });
    return databaseWriteQueue;
  }
  const tempFile = `${DATA_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(normalized, null, 2));
  fs.renameSync(tempFile, DATA_FILE);
  return Promise.resolve();
}

async function initializeStateStorage() {
  if (!databasePool) {
    readFileData();
    console.log(`State storage: JSON file (${DATA_FILE})`);
    return;
  }

  await databasePool.query(`
    CREATE TABLE IF NOT EXISTS spacenovax_state (
      id SMALLINT PRIMARY KEY CHECK (id = 1),
      state JSONB NOT NULL,
      revision BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const existing = await databasePool.query(
    'SELECT state, revision FROM spacenovax_state WHERE id = 1'
  );
  if (existing.rowCount) {
    databaseState = normalizeData(existing.rows[0].state);
    databaseRevision = Number(existing.rows[0].revision || 0);
  } else {
    const seed = readFileData();
    const inserted = await databasePool.query(
      `INSERT INTO spacenovax_state (id, state, revision)
       VALUES (1, $1::jsonb, 1)
       ON CONFLICT (id) DO UPDATE SET state = EXCLUDED.state
       RETURNING state, revision`,
      [JSON.stringify(seed)]
    );
    databaseState = normalizeData(inserted.rows[0].state);
    databaseRevision = Number(inserted.rows[0].revision || 1);
  }
  console.log(`State storage: PostgreSQL (revision ${databaseRevision})`);
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

function securityCircleProgress(data, user) {
  const linked = [...new Set(user?.securityCircle || [])].filter((id) => Boolean(data.users?.[id])).slice(0, 5).length;
  return { linked, verified: securityCircleCount(data, user), percent: linked * 20, maximum: 5 };
}

function communityPostPermission(data, user) {
  const completedMissionIds = OFFICIAL_MISSION_IDS.filter((id) => Boolean(user.missionClaims?.[id]));
  return {
    allowed: completedMissionIds.length === OFFICIAL_MISSION_IDS.length && !user.banned,
    completed: completedMissionIds.length,
    required: OFFICIAL_MISSION_IDS.length,
    missionIds: OFFICIAL_MISSION_IDS,
    missionPassportComplete: completedMissionIds.length === OFFICIAL_MISSION_IDS.length,
  };
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
    author: { id: post.authorId, firstName: author?.firstName || post.authorName || 'Captain', avatarUrl: author?.avatarUrl || '', fleetGrade: fleetGrade(getActiveFleetCount(data, post.authorId)) },
    likes: (post.likes || []).length,
    liked: (post.likes || []).includes(viewerId),
    comments: (post.comments || []).slice(-30),
    status: post.status || 'published'
  };
}

function globalChatRoom(roomId) {
  return GLOBAL_CHAT_ROOM_BY_ID.get(String(roomId || '')) || null;
}

function globalChatModeratorRecord(data, userId, roomId) {
  return (data.globalChatModerators || []).find((record) => (
    record?.status === 'active' && record.userId === userId && record.roomId === roomId
  )) || null;
}

function globalChatRoomModerators(data, roomId) {
  return (data.globalChatModerators || [])
    .filter((record) => record?.status === 'active' && record.roomId === roomId)
    .sort((a, b) => Number(a.appointedAt || 0) - Number(b.appointedAt || 0));
}

function globalChatMutedUntil(data, userId, roomId) {
  const activeMute = (data.globalChatMutes || [])
    .filter((mute) => mute?.status === 'active' && mute.userId === userId && mute.roomId === roomId && Number(mute.until || 0) > now())
    .sort((a, b) => Number(b.until || 0) - Number(a.until || 0))[0];
  return activeMute || null;
}

function canModerateGlobalChatRoom(data, userId, roomId) {
  return Boolean(globalChatModeratorRecord(data, userId, roomId));
}

function globalChatDisplayName(user, fallback = 'Captain') {
  // Global Chat identifies a Captain by the linked Telegram profile first.
  // A separately chosen community nickname remains a fallback for members
  // whose Telegram profile did not provide a display name.
  return String(user?.firstName || user?.communityNickname || fallback).trim().slice(0, 40) || fallback;
}

function publicGlobalChatModerator(data, record) {
  const room = globalChatRoom(record.roomId);
  const user = data.users?.[record.userId];
  return {
    id: record.id,
    userId: record.userId,
    firstName: globalChatDisplayName(user, 'Captain'),
    avatarUrl: user?.avatarUrl || '',
    badge: `${room?.flag || '✦'} ✦ MOD`,
    appointedAt: Number(record.appointedAt || 0),
  };
}

function publicGlobalChatMessage(data, message) {
  const author = data.users?.[message.authorId];
  const room = globalChatRoom(message.roomId);
  const moderator = canModerateGlobalChatRoom(data, message.authorId, message.roomId);
  return {
    id: message.id,
    roomId: message.roomId,
    body: message.body || '',
    imageUrl: message.imageUrl || '',
    imageExpired: Boolean(message.imageExpired),
    createdAt: Number(message.createdAt || 0),
    author: {
      id: message.authorId,
      firstName: globalChatDisplayName(author, message.authorName || 'Captain'),
      avatarUrl: author?.avatarUrl || message.authorAvatarUrl || '',
      isModerator: moderator,
      badge: moderator ? `${room?.flag || '✦'} ✦ MOD` : '',
    },
  };
}

function publicGlobalChatRoom(data, room) {
  const latest = (data.globalChatMessages || [])
    .filter((message) => message.roomId === room.id && message.status === 'published')
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))[0];
  const moderators = globalChatRoomModerators(data, room.id).map((record) => publicGlobalChatModerator(data, record));
  return {
    ...room,
    messageCount: (data.globalChatMessages || []).filter((message) => message.roomId === room.id && message.status === 'published').length,
    moderatorCount: moderators.length,
    moderatorLimit: GLOBAL_CHAT_MAX_ROOM_MODERATORS,
    moderators,
    lastMessage: latest ? {
      body: latest.body || (latest.imageUrl ? '📷 Photo' : ''),
      authorName: globalChatDisplayName(data.users?.[latest.authorId], latest.authorName || 'Captain'),
      createdAt: Number(latest.createdAt || 0),
      hasImage: Boolean(latest.imageUrl),
    } : null,
  };
}

function globalChatViewerState(data, user, roomId) {
  const room = globalChatRoom(roomId);
  const role = room ? globalChatModeratorRecord(data, user.id, room.id) : null;
  const mute = room ? globalChatMutedUntil(data, user.id, room.id) : null;
  const application = room ? (data.globalChatModeratorApplications || [])
    .filter((item) => item.userId === user.id && item.roomId === room.id)
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))[0] : null;
  return {
    isModerator: Boolean(role),
    canModerate: Boolean(role),
    moderatorBadge: role ? `${room.flag} ✦ MOD` : '',
    muteUntil: Number(mute?.until || 0),
    mutedReason: mute?.reason || '',
    blockedUserIds: user.globalChatBlocks || [],
    application: application ? {
      id: application.id,
      status: application.status,
      createdAt: Number(application.createdAt || 0),
      reviewedAt: Number(application.reviewedAt || 0),
    } : null,
  };
}

function normalizeGlobalChatText(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\r\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, GLOBAL_CHAT_MAX_MESSAGE_LENGTH);
}

function globalChatContentBlocked(text) {
  const normalized = text.normalize('NFKC').toLowerCase();
  const prohibitedPatterns = [
    /(seed phrase|recovery phrase|private key|wallet password|시드\s*문구|복구\s*문구|개인\s*키|지갑\s*비밀번호)/i,
    /(send|transfer|deposit|송금|입금).{0,30}(usdt|sol|spnx|coin|token|코인|토큰)/i,
    /(admin|administrator|operator|support|운영자|관리자|고객센터).{0,20}(입니다|공식|official|payment|송금)/i,
    /https?:\/\/(?!([a-z0-9-]+\.)?(spacenovax\.com|t\.me|discord\.gg|youtube\.com|x\.com)(\/|$))[^\s]+/i,
  ];
  return prohibitedPatterns.some((pattern) => pattern.test(normalized));
}

function saveGlobalChatImage(imageData) {
  const match = String(imageData || '').match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error('Only JPEG, PNG, and WebP images are supported.');
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > GLOBAL_CHAT_MAX_IMAGE_BYTES) throw new Error('Chat photo must be 700 KB or smaller.');
  fs.mkdirSync(COMMUNITY_MEDIA_DIR, { recursive: true });
  const extension = match[1] === 'jpeg' ? 'jpg' : match[1];
  const filename = `global-chat-${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${extension}`;
  fs.writeFileSync(path.join(COMMUNITY_MEDIA_DIR, filename), buffer);
  return `/community-media/${filename}`;
}

function removeGlobalChatImage(imageUrl) {
  if (!String(imageUrl || '').startsWith('/community-media/global-chat-')) return;
  try {
    const file = path.join(COMMUNITY_MEDIA_DIR, path.basename(imageUrl));
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch {}
}

function trimGlobalChatHistory(data) {
  const messages = data.globalChatMessages || [];
  const removeIds = new Set();
  for (const room of GLOBAL_CHAT_ROOMS) {
    const roomMessages = messages
      .filter((message) => message.roomId === room.id)
      .sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
    for (const message of roomMessages.slice(0, Math.max(0, roomMessages.length - GLOBAL_CHAT_ROOM_MESSAGE_LIMIT))) removeIds.add(message.id);
  }
  const remaining = messages
    .filter((message) => !removeIds.has(message.id))
    .sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
  for (const message of remaining.slice(0, Math.max(0, remaining.length - GLOBAL_CHAT_TOTAL_MESSAGE_LIMIT))) removeIds.add(message.id);
  const removed = messages.filter((message) => removeIds.has(message.id));
  for (const message of removed) removeGlobalChatImage(message.imageUrl);
  data.globalChatMessages = messages.filter((message) => !removeIds.has(message.id));
  data.globalChatReports = (data.globalChatReports || []).filter((report) => !removeIds.has(report.messageId));

  for (const room of GLOBAL_CHAT_ROOMS) {
    const media = data.globalChatMessages
      .filter((message) => message.roomId === room.id && message.imageUrl)
      .sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
    for (const message of media.slice(0, Math.max(0, media.length - GLOBAL_CHAT_ROOM_MEDIA_LIMIT))) {
      removeGlobalChatImage(message.imageUrl);
      message.imageUrl = '';
      message.imageExpired = true;
    }
  }
}

function normalizeSponsoredBannerText(value, limit) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}

function normalizeSponsoredBannerUrl(value) {
  try {
    const raw = String(value || '').trim();
    if (!raw || raw.length > 2048) return '';
    const url = new URL(raw);
    if (url.protocol !== 'https:') return '';
    return url.toString();
  } catch {
    return '';
  }
}

function saveSponsoredBannerImage(imageData) {
  const match = String(imageData || '').match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error('Only JPEG, PNG, and WebP banner images are supported.');
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > MAX_SPONSORED_BANNER_IMAGE_BYTES) throw new Error('Banner image must be 900 KB or smaller.');
  fs.mkdirSync(COMMUNITY_MEDIA_DIR, { recursive: true });
  const extension = match[1] === 'jpeg' ? 'jpg' : match[1];
  const filename = `sponsor-banner-${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${extension}`;
  fs.writeFileSync(path.join(COMMUNITY_MEDIA_DIR, filename), buffer);
  return `/community-media/${filename}`;
}

function removeSponsoredBannerImage(imageUrl) {
  if (!String(imageUrl || '').startsWith('/community-media/sponsor-banner-')) return;
  try {
    const file = path.join(COMMUNITY_MEDIA_DIR, path.basename(imageUrl));
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch {}
}

function isSponsoredBannerVisible(data, banner, placement = '') {
  const timestamp = now();
  return Boolean(
    data.settings?.sponsoredBannersEnabled
    && banner?.active
    && SPONSORED_BANNER_PLACEMENTS.has(banner.placement)
    && (!placement || banner.placement === placement)
    && (!Number(banner.startsAt || 0) || Number(banner.startsAt) <= timestamp)
    && (!Number(banner.endsAt || 0) || Number(banner.endsAt) > timestamp)
  );
}

function publicSponsoredBanner(data, banner) {
  return {
    id: banner.id,
    partnerName: banner.partnerName,
    label: banner.label || 'SPONSORED PARTNER',
    title: banner.title,
    body: banner.body,
    imageUrl: banner.imageUrl || '',
    destinationUrl: banner.destinationUrl,
    placement: banner.placement,
    disclosure: banner.disclosure || 'Sponsored partner information. Terms, KYC requirements, and availability vary by region.',
    order: Number(banner.order || 0),
  };
}

function sponsoredBannersForPlacement(data, placement) {
  return (data.sponsoredBanners || [])
    .filter((banner) => isSponsoredBannerVisible(data, banner, placement))
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0) || Number(b.createdAt || 0) - Number(a.createdAt || 0))
    .slice(0, MAX_SPONSORED_PARTNERS)
    .map((banner) => publicSponsoredBanner(data, banner));
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

function publicReferralLink(code = '') {
  const normalized = String(code).trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 32);
  return `${PUBLIC_APP_ORIGIN}/join/${encodeURIComponent(normalized)}?v=${encodeURIComponent(REFERRAL_SHARE_VERSION)}`;
}

function telegramReferralLink(code = '') {
  const normalized = String(code).trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 32);
  return `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${encodeURIComponent(normalized)}`;
}

function findUserByReferralCode(data, code = '') {
  const normalized = String(code).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return Object.values(data.users || {}).find((user) => String(user.referralCode || makeReferralCode(user.id)).toUpperCase() === normalized);
}

function fleetReferralLimit(data) {
  // The program policy is a hard cap: configuration must never raise it above 1,000.
  const configured = Number(data?.settings?.fleetMaxMembers ?? REFERRAL_HARD_LIMIT);
  return Math.max(0, Math.min(REFERRAL_HARD_LIMIT, Math.floor(configured)));
}

function fleetBonusPercent(activeFleet, data) {
  const perMember = Math.max(0, Number(data?.settings?.fleetBonusPerActiveReferral ?? 5));
  return Math.max(0, Math.min(fleetReferralLimit(data), Number(activeFleet || 0))) * perMember;
}

// A referral contributes to mining speed only while its own 24-hour mining
// session is genuinely running. A past mining start (or an expired cycle
// waiting to be claimed) must never keep contributing to the Captain's rate.
function hasLiveMiningSession(data, user, at = now()) {
  const startedAt = Number(user?.mining?.startedAt || 0);
  return Boolean(user?.mining?.active)
    && startedAt > 0
    && startedAt + getMiningDuration(data) > Number(at);
}

function fleetReferralStats(data, userId) {
  const limit = fleetReferralLimit(data);
  const members = Object.values(data.users || {}).filter((user) => user.referredBy === userId);
  return {
    total: Math.min(limit, members.length),
    active: Math.min(limit, members.filter((member) => hasLiveMiningSession(data, member)).length),
  };
}

function verifiedReferralCount(data, user) {
  return (user?.referrals || []).filter((userId) => Boolean(data.users?.[userId]?.telegramId)).length;
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
  return fleetReferralStats(data, userId).active;
}

const HALVING_CAPTAINS_PER_STEP = 10_000;
const HALVING_REDUCTION_PER_STEP = 0.10;

function miningPhase(data) {
  // Mining reductions are based on all registered Captain accounts, not KYC approvals.
  const totalCaptains = Object.keys(data.users || {}).length;
  const reductionSteps = Math.floor(totalCaptains / HALVING_CAPTAINS_PER_STEP);
  const multiplier = Number(Math.pow(1 - HALVING_REDUCTION_PER_STEP, reductionSteps).toFixed(12));
  const reward = Number((BASE_MINING_REWARD * multiplier).toFixed(8));
  const used = getMiningPoolUsed(data);
  const pool = Number(data.settings?.miningPool || 3500000000);
  const ratio = pool > 0 ? used / pool : 0;

  return {
    phase: reductionSteps + 1,
    reward,
    used,
    pool,
    ratio,
    multiplier,
    totalCaptains,
    reductionSteps,
    captainsPerStep: HALVING_CAPTAINS_PER_STEP,
    reductionPerStepPercent: HALVING_REDUCTION_PER_STEP * 100,
  };
}

function ensureUser(data, telegramUser, referralCode = '') {
  const tUser = normalizeTelegramUser(telegramUser);
  const userId = tUser.id;

  if (!data.users[userId]) {
    const referralOwner = referralCode ? findUserByReferralCode(data, referralCode) : null;
    const referralAtCapacity = Boolean(referralOwner && verifiedReferralCount(data, referralOwner) >= fleetReferralLimit(data));
    // A referral is assigned once, only for a new Captain, never to oneself,
    // and never after the inviter reaches the policy cap.
    const referrer = referralOwner && referralOwner.id !== userId && !referralAtCapacity ? referralOwner.id : null;
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

    data.events.push({
      type: referralAtCapacity ? 'user_created_referral_capacity_reached' : 'user_created',
      userId,
      referredBy: referrer,
      referralCode: referralCode ? String(referralCode).toUpperCase().slice(0, 32) : '',
      at: now()
    });
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

function communityNodeSigningKey() {
  return String(process.env.COMMUNITY_NODE_TOKEN_SECRET || process.env.SESSION_SECRET || 'spacenovax-community-node-development-key');
}

function nodeSecretHash(secret) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(String(secret), salt, 64).toString('hex')}`;
}

function nodeSecretMatches(secret, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(String(secret), salt, 64).toString('hex');
  return safeEqual(candidate, hash);
}

function signCommunityNodeToken(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', communityNodeSigningKey()).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function verifyCommunityNodeToken(token) {
  const [encoded, signature] = String(token || '').split('.');
  if (!encoded || !signature) return null;
  const expected = crypto.createHmac('sha256', communityNodeSigningKey()).update(encoded).digest('base64url');
  if (!safeEqual(signature, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    return Number(claims.exp || 0) > now() ? claims : null;
  } catch { return null; }
}

function isCommunityNodeOnline(node) {
  return Boolean(node && !node.revoked && Number(node.lastHeartbeatAt || 0) > 0 && now() - Number(node.lastHeartbeatAt) <= COMMUNITY_NODE_HEARTBEAT_GRACE_MS);
}

function createPersonalMessage(data, user, { type = 'system', title, body, dedupeKey = '' }) {
  if (!user) return null;
  if (dedupeKey && data.personalMessages.some((item) => item.userId === user.id && item.dedupeKey === dedupeKey)) return null;
  const message = { id: crypto.randomUUID(), userId: user.id, type, title: String(title).slice(0, 100), body: String(body).slice(0, 500), readAt: 0, createdAt: now(), dedupeKey };
  data.personalMessages.push(message);
  return message;
}

function sendTelegramNotice(user, text) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !user?.telegramId) return;
  void fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: user.telegramId, text }),
  }).catch((error) => console.error('Telegram node notice failed', error.message));
}

function notifyNodeState(data, node, state, timestamp = now()) {
  const owner = data.users?.[node.ownerId];
  if (!owner || node.lastNotifiedState === state) return false;
  node.lastNotifiedState = state;
  node.lastStateNoticeAt = timestamp;
  const copy = state === 'online'
    ? { title: '커뮤니티 노드 구동 중', body: 'SpaceNovaX 커뮤니티 노드가 정상 구동 중입니다. 채굴 속도 +25%가 즉시 활성화되었습니다.', telegram: '🟢 SpaceNovaX 커뮤니티 노드가 구동 중입니다. 채굴 속도 +25%가 활성화되었습니다.' }
    : { title: '커뮤니티 노드 연결 중단', body: '노드 Heartbeat가 중단되었습니다. 채굴 속도 +25% 보너스가 일시 중지되었습니다.', telegram: '🔴 SpaceNovaX 커뮤니티 노드 연결이 중단되었습니다. 채굴 속도 +25%가 일시 중지되었습니다.' };
  createPersonalMessage(data, owner, { type: `node_${state}`, title: copy.title, body: copy.body, dedupeKey: `${node.nodeId}:${state}:${timestamp}` });
  sendTelegramNotice(owner, copy.telegram);
  return true;
}

function monitorCommunityNodeOfflineStates() {
  const data = readData();
  let changed = false;
  for (const node of Object.values(data.communityNodes || {})) {
    if (node.revoked || !node.lastHeartbeatAt || node.lastNotifiedState !== 'online' || isCommunityNodeOnline(node)) continue;
    node.status = 'offline';
    changed = notifyNodeState(data, node, 'offline') || changed;
    data.events.push({ type: 'community_node_offline', userId: node.ownerId, nodeId: node.nodeId, at: now() });
  }
  if (changed) writeData(data);
}

function communityNodeVerification(node) {
  if (!node || node.revoked) return { qualified: false, reason: 'not_registered', availability: 0, heartbeatSuccessRate: 0, workSuccessRate: 0 };
  const timestamp = now();
  const firstHeartbeatAt = Number(node.firstHeartbeatAt || 0);
  const observedMs = Math.max(0, timestamp - firstHeartbeatAt);
  const availability = observedMs ? Math.min(1, Number(node.onlineMs || 0) / observedMs) : 0;
  const heartbeatAttempts = Number(node.heartbeatAttempts || 0);
  const heartbeatSuccessRate = heartbeatAttempts ? Number(node.heartbeatSuccesses || 0) / heartbeatAttempts : 0;
  const workAttempts = Number(node.workAttempts || 0);
  const workSuccessRate = workAttempts ? Number(node.workSuccesses || 0) / workAttempts : 0;
  const latencyAverage = Number(node.latencySamples || 0) ? Number(node.latencyTotalMs || 0) / Number(node.latencySamples || 0) : Infinity;
  const qualified = Boolean(
    isCommunityNodeOnline(node) &&
    observedMs >= COMMUNITY_NODE_MINIMUM_CONTRIBUTION_MS &&
    availability >= COMMUNITY_NODE_MINIMUM_AVAILABILITY &&
    heartbeatSuccessRate >= COMMUNITY_NODE_MINIMUM_HEARTBEAT_SUCCESS_RATE &&
    workAttempts >= 10 &&
    workSuccessRate >= COMMUNITY_NODE_MINIMUM_WORK_SUCCESS_RATE &&
    latencyAverage <= COMMUNITY_NODE_MAX_AVERAGE_LATENCY_MS &&
    !node.duplicateDetected &&
    !node.tamperDetected
  );
  let reason = 'qualified';
  if (!isCommunityNodeOnline(node)) reason = 'offline';
  else if (observedMs < COMMUNITY_NODE_MINIMUM_CONTRIBUTION_MS) reason = 'minimum_contribution_pending';
  else if (availability < COMMUNITY_NODE_MINIMUM_AVAILABILITY) reason = 'availability_below_threshold';
  else if (heartbeatSuccessRate < COMMUNITY_NODE_MINIMUM_HEARTBEAT_SUCCESS_RATE) reason = 'heartbeat_below_threshold';
  else if (workAttempts < 10 || workSuccessRate < COMMUNITY_NODE_MINIMUM_WORK_SUCCESS_RATE) reason = 'verification_work_pending';
  else if (latencyAverage > COMMUNITY_NODE_MAX_AVERAGE_LATENCY_MS) reason = 'latency_below_threshold';
  else if (node.duplicateDetected) reason = 'duplicate_node_detected';
  else if (node.tamperDetected) reason = 'tamper_detected';
  return { qualified, reason, observedMs, availability, heartbeatSuccessRate, workSuccessRate, latencyAverage: Number.isFinite(latencyAverage) ? latencyAverage : 0, workAttempts, heartbeatAttempts };
}

function communityNodeState(data, user) {
  const node = user?.communityNodeId ? data.communityNodes?.[user.communityNodeId] : null;
  const online = isCommunityNodeOnline(node);
  const verification = communityNodeVerification(node);
  return {
    registered: Boolean(node && !node.revoked),
    online,
    nodeId: node?.nodeId || '',
    label: node?.label || '',
    status: !node ? 'not_registered' : node.revoked ? 'revoked' : online ? (verification.qualified ? 'qualified' : 'online') : (node?.lastHeartbeatAt ? 'offline' : 'awaiting_heartbeat'),
    lastHeartbeatAt: Number(node?.lastHeartbeatAt || 0),
    bonusPercent: online ? Number(data.settings?.communityNodeBonusPercent || COMMUNITY_NODE_BONUS_PERCENT) : 0,
    configuredBonusPercent: Number(data.settings?.communityNodeBonusPercent || COMMUNITY_NODE_BONUS_PERCENT),
    verification,
  };
}

function communityNodeProgram(data) {
  const nodes = Object.values(data.communityNodes || {}).filter((node) => !node.revoked);
  return { registered: nodes.length, online: nodes.filter(isCommunityNodeOnline).length, limit: Number(data.settings?.communityNodeLimit || COMMUNITY_NODE_LIMIT) };
}

function miningSpeedPerHour(data, user) {
  const phase = miningPhase(data);
  const fleetStats = fleetReferralStats(data, user.id);
  const activeFleet = fleetStats.active;
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
  const rateWithoutNode = basePerHour * (1 + (fleetBonus + securityBonus + missionBonus) / 100) * eventMultiplier;
  const node = communityNodeState(data, user);
  const finalPerHour = rateWithoutNode * (1 + node.bonusPercent / 100);
  return { basePerHour, baseBeforeReductionPerHour: BASE_MINING_REWARD / 24, rateWithoutNode: Number(rateWithoutNode.toFixed(8)), finalPerHour: Number(finalPerHour.toFixed(8)), fleetBonus, securityBonus, securityCircleCount: securityCircle.length, missionBonus, missionPassportComplete, activeFleet, totalReferrals: fleetStats.total, phase: phase.phase, eventMultiplier, duration, nodeBonus: node.bonusPercent, nodeOnline: node.online, nodeStatus: node.status, nodeId: node.nodeId, reductionSteps: phase.reductionSteps, reductionMultiplier: phase.multiplier, reductionPerStepPercent: phase.reductionPerStepPercent };
}
function miningRewardForCycle(data, user) {
  const speed = miningSpeedPerHour(data, user);
  const hours = speed.duration / (60 * 60 * 1000);
  const amount = speed.finalPerHour * hours;
  const remaining = getMiningPoolRemaining(data);
  return Number(Math.max(0, Math.min(amount, remaining)).toFixed(8));
}

function calculateMining(data, user) {
  const calculatedAt = now();
  const speed = miningSpeedPerHour(data, user);
  const duration = speed.duration;
  const durationHours = duration / (60 * 60 * 1000);
  const remaining = getMiningPoolRemaining(data);
  const projectedReward = Number(Math.max(0, Math.min(speed.finalPerHour * durationHours, remaining)).toFixed(8));
  if (!user.mining?.active) {
    return { active: false, calculatedAt, reward: projectedReward, claimableReward: 0, baseReward: miningPhase(data).reward, speedPerHour: speed.finalPerHour, baseSpeedPerHour: speed.basePerHour, baseBeforeReductionPerHour: speed.baseBeforeReductionPerHour, fleetBonus: speed.fleetBonus, securityBonus: speed.securityBonus, securityCircleCount: speed.securityCircleCount, missionBonus: speed.missionBonus, missionPassportComplete: speed.missionPassportComplete, activeFleet: speed.activeFleet, phase: speed.phase, eventMultiplier: speed.eventMultiplier, nodeBonus: speed.nodeBonus, nodeOnline: speed.nodeOnline, nodeStatus: speed.nodeStatus, reductionSteps: speed.reductionSteps, reductionMultiplier: speed.reductionMultiplier, reductionPerStepPercent: speed.reductionPerStepPercent, nodeBonusQualifiedMs: 0, durationMs: duration, remainingMs: duration, progress: 0, minedSoFar: 0, claimable: false, sandbox: Boolean(data.settings?.miningSandboxEnabled), engineVersion: data.settings?.miningEngineVersion || '1.0.0' };
  }
  const startedAt = Number(user.mining.startedAt || now());
  const endsAt = startedAt + duration;
  const remainingMs = Math.max(0, endsAt - calculatedAt);
  const progress = Math.min(1, Math.max(0, (calculatedAt - startedAt) / duration));
  const elapsedMs = Math.min(duration, Math.max(0, calculatedAt - startedAt));
  const nodeBonusQualifiedMs = Math.min(elapsedMs, Math.max(0, Number(user.mining?.nodeBonusQualifiedMs || 0)));
  const baseCycleReward = speed.rateWithoutNode * durationHours;
  const nodeReward = speed.rateWithoutNode * (Number(data.settings?.communityNodeBonusPercent || COMMUNITY_NODE_BONUS_PERCENT) / 100) * (nodeBonusQualifiedMs / (60 * 60 * 1000));
  const claimableReward = Number(Math.max(0, Math.min(baseCycleReward + nodeReward, remaining)).toFixed(8));
  const minedSoFar = Number(Math.max(0, Math.min(speed.rateWithoutNode * (elapsedMs / (60 * 60 * 1000)) + nodeReward, claimableReward)).toFixed(8));
  return { active: remainingMs > 0, calculatedAt, startedAt, endsAt, remainingMs, progress, minedSoFar, reward: projectedReward, claimableReward, baseReward: miningPhase(data).reward, speedPerHour: speed.finalPerHour, baseSpeedPerHour: speed.basePerHour, baseBeforeReductionPerHour: speed.baseBeforeReductionPerHour, fleetBonus: speed.fleetBonus, securityBonus: speed.securityBonus, securityCircleCount: speed.securityCircleCount, missionBonus: speed.missionBonus, missionPassportComplete: speed.missionPassportComplete, activeFleet: speed.activeFleet, phase: speed.phase, eventMultiplier: speed.eventMultiplier, nodeBonus: speed.nodeBonus, nodeOnline: speed.nodeOnline, nodeStatus: speed.nodeStatus, reductionSteps: speed.reductionSteps, reductionMultiplier: speed.reductionMultiplier, reductionPerStepPercent: speed.reductionPerStepPercent, nodeBonusQualifiedMs, durationMs: duration, claimable: remainingMs <= 0, sandbox: Boolean(data.settings?.miningSandboxEnabled), engineVersion: data.settings?.miningEngineVersion || '1.0.0' };
}

function settleClaimableMiningCycle(data, user, status = calculateMining(data, user)) {
  if (!status.claimable || !user.mining?.startedAt) return null;
  const amount = Number(status.claimableReward || 0);
  const cycleStartedAt = Number(user.mining.startedAt);
  const idempotencyKey = `mining:${user.id}:${cycleStartedAt}`;
  const wasAlreadyCredited = Boolean(data.ledgerKeys?.[idempotencyKey]);
  const ledgerEntry = appendLedger(data, user, {
    type: 'mining_reward', amount, idempotencyKey,
    reference: `cycle-${cycleStartedAt}`,
    metadata: { phase: status.phase, fleetBonus: status.fleetBonus, securityBonus: status.securityBonus, missionBonus: status.missionBonus, nodeBonus: status.nodeBonus, nodeBonusQualifiedMs: status.nodeBonusQualifiedMs }
  });
  if (!wasAlreadyCredited) {
    user.totalMined = Number(user.totalMined || 0) + amount;
    data.events.push({ type: 'mining_claim', userId: user.id, amount, ledgerId: ledgerEntry?.id, phase: status.phase, fleetBonus: status.fleetBonus, nodeBonus: status.nodeBonus, engineVersion: status.engineVersion, sandbox: status.sandbox, automatic: true, at: now() });
  }
  user.mining = null;
  user.lastMiningAt = now();
  user.updatedAt = now();
  return { amount, ledgerEntry, newlyCredited: !wasAlreadyCredited };
}

function publicUser(data, user) {
  const fleetStats = fleetReferralStats(data, user.id);
  const activeFleet = fleetStats.active;
  const bonus = fleetBonusPercent(activeFleet, data);
  const mining = calculateMining(data, user);
  const settledBalance = Number(user.balance || 0);
  const personalMessages = data.personalMessages.filter((item) => item.userId === user.id && !item.senderId);
  const fleetDirectMessages = data.personalMessages.filter((item) => item.type === 'fleet_direct_message' && item.userId === user.id);
  const activeAnnouncements = data.announcements.filter((item) => item.active !== false).sort((a, b) => Number(b.publishedAt || b.createdAt || 0) - Number(a.publishedAt || a.createdAt || 0));
  const latestAnnouncement = activeAnnouncements[0] || null;

  return {
    id: user.id,
    telegramId: user.telegramId,
    username: user.username,
    firstName: user.firstName,
    avatarUrl: user.avatarUrl || '',
    isGuest: user.isGuest,
    // `balance` is the settled, ledger-backed balance.  The display field adds
    // only the server-calculated in-progress mining amount and is never used
    // for conversion, payout, or ledger mutations.
    balance: settledBalance,
    displayBalance: Number((settledBalance + Number(mining.minedSoFar || 0)).toFixed(8)),
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
    totalReferrals: fleetStats.total,
    securityCircle: user.securityCircle || [],
    securityCircleCount: (user.securityCircle || []).filter((id) => data.users[id] && String(data.users[id].kyc?.status || '').toLowerCase() === 'approved').slice(0, 5).length,
    securityCircleBonus: securityCircleCount(data, user),
    securityCircleProgress: securityCircleProgress(data, user),
    activeFleet,
    fleetBonus: bonus,
    fleetGrade: fleetGrade(activeFleet),
    fleetMaxMembers: Number(data.settings?.fleetMaxMembers || 1000),
    fleetBonusPerMember: Number(data.settings?.fleetBonusPerActiveReferral || 5),
    communityNode: communityNodeState(data, user),
    communityNodeProgram: communityNodeProgram(data),
    unreadMessageCount: personalMessages.filter((item) => !item.readAt).length,
    unreadFleetMessageCount: fleetDirectMessages.filter((item) => !item.readAt).length,
    unreadAnnouncementCount: activeAnnouncements.filter((item) => !user.announcementReads?.[item.id]).length,
    latestAnnouncement: latestAnnouncement ? {
      id: latestAnnouncement.id,
      title: latestAnnouncement.title,
      body: latestAnnouncement.body,
      priority: latestAnnouncement.priority,
      publishedAt: latestAnnouncement.publishedAt,
      showBanner: now() - Number(latestAnnouncement.publishedAt || 0) < 24 * 60 * 60 * 1000,
      read: Boolean(user.announcementReads?.[latestAnnouncement.id]),
    } : null,
    mining,
    gameReward: user.gameReward || { date: gameRewardWindowKey(), earnedToday: 0, bestScore: 0, breakdown: {} },
    solanaWallet: user.solanaWallet || '',
    walletVerified: Boolean(user.walletVerifiedAt && user.verifiedSolanaWallet === user.solanaWallet),
    walletVerifiedAt: Number(user.walletVerifiedAt || 0),
    kyc: user.kyc || { status: 'not_available', available: false },
    conversionAvailable: Boolean(data.settings?.convertEnabled && data.settings?.kycEnabled)
  };
}

function recoverGuestCaptain(data, telegramUser, clientId) {
  // A Captain can enter the Mini App before Telegram initData is available.
  // If the next verified request has the same local client ID, preserve that
  // one pre-verification profile instead of silently starting again at zero.
  if (!telegramUser?.id || !clientId) return null;
  const guestId = makeGuestUser(clientId).id;
  const guest = data.users?.[guestId];
  const captainId = `tg-${telegramUser.id}`;
  const existingCaptain = data.users?.[captainId];
  if (!guest || guestId === captainId) return null;
  if (Number(guest.balance || 0) <= 0 && !guest.mining?.active) return null;
  // Never combine two established financial profiles automatically.
  if (existingCaptain && Number(existingCaptain.balance || 0) > 0) return null;

  const verifiedIdentity = normalizeTelegramUser(telegramUser);
  const activeMining = existingCaptain?.mining?.active ? existingCaptain.mining : guest.mining;
  data.users[captainId] = {
    ...guest,
    ...existingCaptain,
    ...verifiedIdentity,
    balance: Math.max(Number(guest.balance || 0), Number(existingCaptain?.balance || 0)),
    totalMined: Math.max(Number(guest.totalMined || 0), Number(existingCaptain?.totalMined || 0)),
    mining: activeMining,
    migratedGuestId: guestId,
    updatedAt: now(),
  };
  delete data.users[guestId];
  for (const user of Object.values(data.users || {})) {
    if (user.referredBy === guestId) user.referredBy = captainId;
    if (Array.isArray(user.referrals)) user.referrals = user.referrals.map((id) => id === guestId ? captainId : id);
  }
  data.events.push({ type: 'captain_identity_recovered', userId: captainId, sourceUserId: guestId, at: now() });
  return data.users[captainId];
}

function verifiedTelegramStartParam(req, telegramUser) {
  if (!telegramUser?.id) return '';
  try {
    const startParam = new URLSearchParams(String(req.headers['x-telegram-init-data'] || '')).get('start_param') || '';
    return String(startParam).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 32);
  } catch {
    return '';
  }
}

function verifiedBotReferralTicket(req, telegramUser) {
  if (!telegramUser?.id) return '';
  const ticket = String(req.headers['x-spnx-referral-ticket'] || '').trim();
  const botToken = String(process.env.TELEGRAM_BOT_TOKEN || '');
  if (!ticket || !botToken) return '';
  const [code, userId, issuedAtRaw, signature] = ticket.split('.');
  const issuedAt = Number(issuedAtRaw || 0);
  const normalized = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 32);
  if (!normalized || String(telegramUser.id) !== String(userId) || !issuedAt || Math.abs(Math.floor(Date.now() / 1000) - issuedAt) > 30 * 60) return '';
  const payload = `${normalized}.${userId}.${issuedAt}`;
  const expected = crypto.createHmac('sha256', botToken).update(payload).digest('hex');
  return safeEqual(signature || '', expected) ? normalized : '';
}

function getSessionUser(req, data) {
  const telegramUser = verifiedTelegramUser(req);
  const clientId = String(req.headers['x-spnx-client-id'] || req.body?.clientId || '');
  const recoveredUser = recoverGuestCaptain(data, telegramUser, clientId);
  if (recoveredUser) return recoveredUser;
  const fallbackUser = IS_PRODUCTION ? { clientId } : (req.body?.telegramUser || { clientId });
  // In production, referral attribution accepts only Telegram's signed start
  // parameter. This prevents scripted guest requests from consuming a fleet's
  // 1,000-member capacity. Local previews may still pass ref explicitly.
  const referralCode = verifiedTelegramStartParam(req, telegramUser)
    || verifiedBotReferralTicket(req, telegramUser)
    || (!IS_PRODUCTION ? (req.body?.ref || req.query?.ref || '') : '');
  return ensureUser(data, telegramUser || fallbackUser, referralCode);
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
  const ton = tonPayoutConfig();
  return {
    kycRuntimeReady: kycRuntimeReady(),
    selectedNetwork: 'ton',
    ton,
    legacySolana: {
      retiredForNewPayouts: true,
      // Do not read its configuration or use it as a release gate.
      isolated: true,
    },
    kycEnabled: Boolean(data.settings?.kycEnabled),
    convertEnabled: Boolean(data.settings?.convertEnabled),
    autoPayoutEnabled: Boolean(data.settings?.autoPayoutEnabled),
    // Keep all payout paths closed until the reviewed TON transfer adapter is
    // available. This prevents a legacy Solana key from being used by mistake.
    ready: false,
    releaseBlocked: true,
    releaseBlockReason: ton.error,
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
  // The previous Solana implementation is retained only for audit/migration
  // reference. TON is the selected settlement network, and its transfer
  // adapter has not passed the testnet release gates yet.
  throw new Error('Automatic payouts are disabled pending TON testnet release gates.');
  /* c8 ignore next */
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

function gameLaunchSecret() {
  // Keep the signing key on the application server. The browser only receives
  // a short-lived session and never receives a reward signing secret.
  return String(process.env.GAME_LAUNCH_SECRET || process.env.GAME_REWARD_SECRET || (IS_PRODUCTION ? '' : 'spnx-local-game-session')).trim();
}

function createGameLaunchSession(user) {
  const secret = gameLaunchSecret();
  if (!secret) return null;
  const payload = Buffer.from(JSON.stringify({ userId: user.id, expiresAt: now() + GAME_SESSION_TTL_MS, nonce: crypto.randomBytes(12).toString('hex') })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function verifyGameLaunchSession(token) {
  const secret = gameLaunchSecret();
  const value = String(token || '');
  const separator = value.lastIndexOf('.');
  if (!secret || separator < 1) return null;
  const payload = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  if (!safeEqual(signature, expected)) return null;
  try {
    const gameSession = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!gameSession?.userId || !Number.isFinite(Number(gameSession.expiresAt)) || Number(gameSession.expiresAt) < now()) return null;
    return gameSession;
  } catch { return null; }
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
  const origin = String(req.headers.origin || '');
  const allowedOrigins = new Set(['https://game.spacenovax.com', 'https://nova-x1-genesis-defense.kit372002.chatgpt.site', String(process.env.GAME_ORIGIN || '').replace(/\/$/, '')].filter(Boolean));
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
  }
  return next();
});
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // The Orbit navigation screen requests the device position from this same
  // origin.  `geolocation=()` blocks that request before Android/Telegram can
  // display its permission prompt, so allow only this app origin instead.
  res.setHeader('Permissions-Policy', 'camera=(), geolocation=(self), payment=()');
  next();
});
app.use((req, res, next) => {
  if (!databasePool) return next();
  const revisionAtRequestStart = databaseRevision;
  const originalEnd = res.end.bind(res);
  let ending = false;
  res.end = (...args) => {
    if (ending) return res;
    ending = true;
    if (databaseRevision <= revisionAtRequestStart) {
      originalEnd(...args);
      return res;
    }
    databaseWriteQueue
      .then(() => originalEnd(...args))
      .catch((error) => {
        console.error('Request persistence barrier failed', error);
        if (!res.headersSent) res.statusCode = 503;
        originalEnd(...args);
      });
    return res;
  };
  next();
});

const IS_PRODUCTION = process.env.NODE_ENV === 'production' || Boolean(process.env.RENDER);
const ADMIN_ID = process.env.ADMIN_ID || (IS_PRODUCTION ? '' : 'admin');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || (IS_PRODUCTION ? '' : 'ChangeMe123!');
const ADMIN_TOKEN_SECRET = process.env.SESSION_SECRET || process.env.JWT_SECRET || crypto.randomBytes(48).toString('hex');
const ADMIN_SESSION_MS = 12 * 60 * 60 * 1000;
const adminLoginAttempts = new Map();
// External developer repositories are intentionally isolated from the official
// SpaceNovaX source and deployment.  The GitHub App must be configured with
// Metadata: Read-only and Contents: Read-only only.  This server never asks
// GitHub for a write scope and will reject an official repository even when a
// developer tries to submit its URL manually.
const GITHUB_APP_SLUG = String(process.env.GITHUB_DEVELOPER_APP_SLUG || '').trim();
const GITHUB_DEVELOPER_CONNECT_SECRET = String(process.env.GITHUB_DEVELOPER_CONNECT_SECRET || process.env.SESSION_SECRET || '').trim();
const GITHUB_DEVELOPER_STATE_TTL_MS = 10 * 60 * 1000;
const OFFICIAL_GITHUB_REPOSITORIES = new Set(['spacenovax/spacenovax-v2', 'spacenovax/spacenovax-server-v2']);

function githubConnectConfigured() {
  return Boolean(GITHUB_APP_SLUG && GITHUB_DEVELOPER_CONNECT_SECRET && IS_PRODUCTION);
}

function signDeveloperGithubState(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', GITHUB_DEVELOPER_CONNECT_SECRET).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function verifyDeveloperGithubState(state = '') {
  const [body, signature] = String(state).split('.');
  if (!body || !signature || !GITHUB_DEVELOPER_CONNECT_SECRET) return null;
  const expected = crypto.createHmac('sha256', GITHUB_DEVELOPER_CONNECT_SECRET).update(body).digest('base64url');
  if (!safeEqual(signature, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload?.userId || !payload?.expiresAt || Number(payload.expiresAt) < now()) return null;
    return payload;
  } catch { return null; }
}

function normalizeGithubRepository(value = '') {
  let url;
  try { url = new URL(String(value).trim()); } catch { return null; }
  if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'github.com') return null;
  const parts = url.pathname.replace(/^\/+|\/+$/g, '').split('/');
  if (parts.length !== 2 || !parts.every((part) => /^[A-Za-z0-9_.-]{1,100}$/.test(part))) return null;
  const fullName = `${parts[0]}/${parts[1]}`;
  if (OFFICIAL_GITHUB_REPOSITORIES.has(fullName.toLowerCase())) return null;
  return { owner: parts[0], repository: parts[1], fullName, url: `https://github.com/${fullName}` };
}

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

app.get('/api/health', async (req, res) => {
  try {
    if (databasePool) await databasePool.query('SELECT 1');
    res.json({
      ok: true,
      storage: databasePool ? 'postgresql' : 'json',
      persistent: Boolean(databasePool),
      revision: databasePool ? databaseRevision : null,
    });
  } catch (error) {
    console.error('Health check failed', error);
    res.status(503).json({ ok: false, storage: 'postgresql', persistent: false });
  }
});

// Privacy-safe public aggregate shared by the Telegram Mini App and the
// spacenovax.com ecosystem snapshot. No user identity, balance, wallet
// address, location or individual activity is exposed.
app.get('/api/ecosystem-stats', (req, res) => {
  const data = readData();
  const users = Object.values(data.users || {}).filter((user) => !user.isGuest && !user.banned);
  const events = data.events || [];
  const timestamp = now();
  const tenMinutesAgo = timestamp - 10 * 60 * 1000;
  const dayAgo = timestamp - 24 * 60 * 60 * 1000;
  const activeUserIds = new Set(events.filter((event) => event.type === 'session' && Number(event.at || 0) >= tenMinutesAgo).map((event) => event.userId));
  const newUsers24h = users.filter((user) => Number(user.createdAt || 0) >= dayAgo).length;
  const priorUsers = Math.max(0, users.length - newUsers24h);
  const communityGrowth = priorUsers ? Number((newUsers24h / priorUsers * 100).toFixed(2)) : (newUsers24h ? 100 : 0);
  const completedMissions = users.reduce((total, user) => total + OFFICIAL_MISSION_IDS.filter((id) => Boolean(user.missionClaims?.[id])).length, 0);
  const nodeProgram = communityNodeProgram(data);
  res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
  res.json({ ok: true, generatedAt: timestamp, stats: {
    activeUsers: activeUserIds.size,
    totalUsers: users.length,
    onlineNodes: nodeProgram.online,
    registeredNodes: nodeProgram.registered,
    miningSessions: users.filter((user) => calculateMining(data, user).active).length,
    walletsConnected: users.filter((user) => Boolean(user.solanaWallet)).length,
    walletsVerified: users.filter((user) => Boolean(user.walletVerifiedAt && user.verifiedSolanaWallet === user.solanaWallet)).length,
    completedMissions,
    missionPassports: users.filter((user) => OFFICIAL_MISSION_IDS.every((id) => Boolean(user.missionClaims?.[id]))).length,
    countries: null,
    languages: 12,
    communityGrowth,
    communityGrowthPeriod: '24h',
  }});
});


app.post('/api/session', (req, res) => {
  const data = readData();
  const user = getSessionUser(req, data);
  data.events.push({ type: 'session', userId: user.id, at: now() });
  writeData(data);
  res.json({ ok: true, user: publicUser(data, user) });
});

// Developer GitHub connection: GitHub App installation only.  This route
// deliberately does not use OAuth `repo` scope, Personal Access Tokens, or
// any official SpaceNovaX repository credentials.
app.post('/api/developer/github/connect', (req, res) => {
  const data = readData();
  const user = getSessionUser(req, data);
  if (!requireVerifiedCaptain(user, res)) return;
  if (!githubConnectConfigured()) {
    return res.status(503).json({ ok: false, code: 'GITHUB_APP_NOT_CONFIGURED', message: 'Developer GitHub Connect is awaiting administrator configuration.' });
  }
  const state = signDeveloperGithubState({ userId: user.id, nonce: crypto.randomBytes(16).toString('hex'), expiresAt: now() + GITHUB_DEVELOPER_STATE_TTL_MS });
  const installUrl = `https://github.com/apps/${encodeURIComponent(GITHUB_APP_SLUG)}/installations/new?state=${encodeURIComponent(state)}`;
  res.json({ ok: true, installUrl, permissions: ['metadata:read', 'contents:read'], officialRepositoryAccess: false, deploymentAccess: false });
});

app.get('/api/developer/github/callback', (req, res) => {
  const state = verifyDeveloperGithubState(req.query?.state);
  const installationId = String(req.query?.installation_id || '').replace(/[^0-9]/g, '').slice(0, 32);
  if (!state || !installationId) return res.status(400).type('html').send('<h1>GitHub connection could not be verified.</h1><p>Please return to the developer portal and try again.</p>');
  const data = readData();
  const user = data.users?.[state.userId];
  if (!user || user.banned) return res.status(403).type('html').send('<h1>Developer connection unavailable.</h1>');
  const existing = data.developerGithubConnections.find((item) => item.userId === user.id && item.installationId === installationId && item.status === 'pending_repository');
  if (!existing) data.developerGithubConnections.push({ id: crypto.randomUUID(), userId: user.id, installationId, status: 'pending_repository', permissions: ['metadata:read', 'contents:read'], createdAt: now(), updatedAt: now() });
  data.events.push({ type: 'developer_github_installation_connected', userId: user.id, at: now() });
  writeData(data);
  res.redirect(`${PUBLIC_APP_ORIGIN}/?developer=github-connected`);
});

app.get('/api/developer/github/connections', (req, res) => {
  const data = readData();
  const user = getSessionUser(req, data);
  if (!requireVerifiedCaptain(user, res)) return;
  const connections = data.developerGithubConnections.filter((item) => item.userId === user.id).map(({ installationId, ...safe }) => safe);
  res.json({ ok: true, githubAppConfigured: githubConnectConfigured(), permissions: ['metadata:read', 'contents:read'], connections });
});

app.post('/api/developer/github/repository', (req, res) => {
  const data = readData();
  const user = getSessionUser(req, data);
  if (!requireVerifiedCaptain(user, res)) return;
  const repository = normalizeGithubRepository(req.body?.repositoryUrl);
  if (!repository) return res.status(400).json({ ok: false, message: 'Use a valid non-official GitHub repository URL.' });
  const connection = data.developerGithubConnections.find((item) => item.userId === user.id && item.status === 'pending_repository');
  if (!connection) return res.status(409).json({ ok: false, message: 'Install the read-only SpaceNovaX Developer GitHub App first.' });
  connection.repository = repository;
  connection.status = 'pending_review';
  connection.updatedAt = now();
  data.events.push({ type: 'developer_repository_submitted', userId: user.id, connectionId: connection.id, at: now() });
  writeData(data);
  res.json({ ok: true, connection: { id: connection.id, repository, status: connection.status, permissions: connection.permissions } });
});

app.post('/api/developer/github/disconnect', (req, res) => {
  const data = readData();
  const user = getSessionUser(req, data);
  if (!requireVerifiedCaptain(user, res)) return;
  const id = String(req.body?.connectionId || '');
  const connection = data.developerGithubConnections.find((item) => item.id === id && item.userId === user.id && item.status !== 'revoked');
  if (!connection) return res.status(404).json({ ok: false, message: 'Developer connection not found.' });
  connection.status = 'revoked'; connection.revokedAt = now(); connection.updatedAt = now();
  data.events.push({ type: 'developer_github_disconnected', userId: user.id, connectionId: connection.id, at: now() });
  writeData(data);
  res.json({ ok: true });
});

app.get('/api/admin/developer/github', requireAdmin, (req, res) => {
  const data = readData();
  res.json({ ok: true, connections: data.developerGithubConnections.map((item) => ({ ...item, installationId: undefined, user: publicUser(data, data.users?.[item.userId] || { id: item.userId, firstName: 'Unknown' }) })) });
});

app.post('/api/admin/developer/github/review', requireAdmin, (req, res) => {
  const data = readData();
  const connection = data.developerGithubConnections.find((item) => item.id === String(req.body?.connectionId || ''));
  const action = String(req.body?.action || '');
  if (!connection || !['approve', 'reject', 'revoke'].includes(action)) return res.status(400).json({ ok: false, message: 'Invalid developer review request.' });
  connection.status = action === 'approve' ? 'verified' : action === 'revoke' ? 'revoked' : 'rejected';
  connection.reviewedAt = now(); connection.reviewedBy = req.admin.id; connection.updatedAt = now();
  data.events.push({ type: `admin_developer_repository_${action}`, adminId: req.admin.id, userId: connection.userId, connectionId: connection.id, at: now() });
  writeData(data);
  res.json({ ok: true, status: connection.status });
});

app.post('/api/messages', (req, res) => {
  const data = readData();
  const user = getSessionUser(req, data);
  const messages = data.personalMessages.filter((item) => item.userId === user.id && !item.senderId).slice(-100).reverse();
  res.json({ ok: true, messages, unreadCount: messages.filter((item) => !item.readAt).length });
});

app.post('/api/fleet/messages/members', (req, res) => {
  const data = readData();
  const user = getSessionUser(req, data);
  const query = String(req.body?.query || '').trim().toLowerCase().slice(0, 60);
  const captainId = fleetCaptainId(data, user);
  const members = fleetMembers(data, captainId).filter((member) => member.id !== user.id && !member.banned && (!query || String(member.firstName || '').toLowerCase().includes(query))).slice(0, 100).map((member) => ({ id: member.id, firstName: member.firstName || 'Captain', avatarUrl: member.avatarUrl || '', blocked: (user.messageBlocks || []).includes(member.id) }));
  res.json({ ok: true, members, captainId });
});

app.post('/api/fleet/messages', (req, res) => {
  const data = readData();
  const user = getSessionUser(req, data);
  const captainId = fleetCaptainId(data, user);
  const messages = data.personalMessages.filter((item) => item.type === 'fleet_direct_message' && item.captainId === captainId && (item.userId === user.id || item.senderId === user.id)).slice(-200).reverse().map((item) => ({ ...item, direction: item.senderId === user.id ? 'sent' : 'received', blocked: item.senderId ? (user.messageBlocks || []).includes(item.senderId) : false }));
  res.json({ ok: true, messages, unreadCount: messages.filter((item) => item.userId === user.id && !item.readAt).length });
});

app.post('/api/fleet/messages/send', (req, res) => {
  const data = readData();
  const sender = getSessionUser(req, data);
  const recipient = data.users[String(req.body?.recipientId || '')];
  const captainId = fleetCaptainId(data, sender);
  if (!recipient || recipient.id === sender.id || recipient.banned || fleetCaptainId(data, recipient) !== captainId) return res.status(403).json({ ok: false, message: 'Private messages are available only between members of the same fleet.' });
  if ((recipient.messageBlocks || []).includes(sender.id)) return res.status(403).json({ ok: false, message: 'This member is not accepting messages from you.' });
  const body = String(req.body?.body || '').trim().slice(0, 1500);
  const normalizedBody = body.normalize('NFKC').toLowerCase();
  const prohibitedPatterns = [/(seed phrase|recovery phrase|private key|wallet password|시드\s*문구|복구\s*문구|개인\s*키|지갑\s*비밀번호)/i, /(send|transfer|deposit|송금|입금).{0,30}(usdt|sol|spnx|coin|token|코인|토큰)/i, /(admin|administrator|operator|support|운영자|관리자|고객센터).{0,20}(입니다|공식|official|payment|송금)/i, /https?:\/\/(?!([a-z0-9-]+\.)?(spacenovax\.com|t\.me|discord\.gg|youtube\.com|x\.com)(\/|$))[^\s]+/i];
  if (prohibitedPatterns.some((pattern) => pattern.test(normalizedBody))) { data.events.push({ type:'member_message_blocked_security', userId:sender.id, recipientId:recipient.id, at:now() }); writeData(data); return res.status(403).json({ ok:false, message:'Message blocked by SpaceNovaX security. Fraud, impersonation, wallet-secret requests, payment requests, and unapproved links are prohibited.' }); }
  let imageUrl = '';
  const imageData = String(req.body?.imageData || '');
  if (!body && !imageData) return res.status(400).json({ ok: false, message: 'Write a message or attach a photo.' });
  const recent = data.personalMessages.filter((item) => item.senderId === sender.id && Number(item.createdAt || 0) > now() - 60000);
  if (recent.length >= 10) return res.status(429).json({ ok: false, message: 'Message rate limit reached. Please wait.' });
  if (imageData) {
    const match = imageData.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
    if (!match) return res.status(400).json({ ok: false, message: 'Only JPEG, PNG, and WebP photos are supported.' });
    const buffer = Buffer.from(match[2], 'base64');
    if (!buffer.length || buffer.length > 1_000_000) return res.status(413).json({ ok: false, message: 'Message photo must be 1 MB or smaller.' });
    fs.mkdirSync(COMMUNITY_MEDIA_DIR, { recursive: true });
    const extension = match[1] === 'jpeg' ? 'jpg' : match[1];
    const filename = `message-${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${extension}`;
    fs.writeFileSync(path.join(COMMUNITY_MEDIA_DIR, filename), buffer);
    imageUrl = `/community-media/${filename}`;
  }
  const replyTo = String(req.body?.replyTo || '');
  const referenced = replyTo ? data.personalMessages.find((item) => item.id === replyTo && ((item.userId === sender.id && item.senderId === recipient.id) || (item.userId === recipient.id && item.senderId === sender.id))) : null;
  const message = { id: crypto.randomUUID(), captainId, userId: recipient.id, senderId: sender.id, senderName: sender.firstName || 'Captain', senderAvatarUrl: sender.avatarUrl || '', recipientName: recipient.firstName || 'Captain', type: 'fleet_direct_message', title: replyTo ? 'Fleet reply' : 'Fleet direct message', body, imageUrl, replyTo: referenced?.id || '', replyPreview: referenced?.body?.slice(0, 120) || '', readAt: 0, createdAt: now() };
  data.personalMessages.push(message); data.events.push({ type: 'member_message_sent', userId: sender.id, recipientId: recipient.id, messageId: message.id, hasImage: Boolean(imageUrl), at: message.createdAt }); writeData(data);
  res.status(201).json({ ok: true, message: 'Message sent.' });
});

app.post('/api/fleet/messages/block', (req, res) => {
  const data = readData(); const user = getSessionUser(req, data); const targetId = String(req.body?.userId || ''); const action = String(req.body?.action || 'block');
  if (!data.users[targetId] || targetId === user.id || !['block','unblock'].includes(action)) return res.status(400).json({ ok: false, message: 'Invalid block request.' });
  user.messageBlocks ||= []; user.messageBlocks = action === 'block' ? [...new Set([...user.messageBlocks, targetId])] : user.messageBlocks.filter((id) => id !== targetId); writeData(data);
  res.json({ ok: true, blocked: action === 'block' });
});

app.post('/api/fleet/messages/report', (req, res) => {
  const data=readData(); const user=getSessionUser(req,data); const message=data.personalMessages.find((item)=>item.id===String(req.body?.messageId||'')&&item.userId===user.id&&item.senderId);
  if(!message)return res.status(404).json({ok:false,message:'Received member message not found.'});
  if(data.messageReports.some((item)=>item.messageId===message.id&&item.reporterId===user.id))return res.status(409).json({ok:false,message:'This message has already been reported.'});
  const report={id:crypto.randomUUID(),messageId:message.id,reporterId:user.id,reportedUserId:message.senderId,reason:String(req.body?.reason||'fraud_or_impersonation').slice(0,200),evidence:{senderName:message.senderName,body:message.body,imageUrl:message.imageUrl||'',createdAt:message.createdAt},status:'pending',createdAt:now()}; data.messageReports.push(report); user.messageBlocks=[...new Set([...(user.messageBlocks||[]),message.senderId])]; data.events.push({type:'member_message_reported',userId:user.id,reportedUserId:message.senderId,reportId:report.id,at:report.createdAt}); writeData(data); res.json({ok:true,message:'Report submitted. The sender has been blocked while administrators review the evidence.'});
});

app.post('/api/messages/read', (req, res) => {
  const data = readData();
  const user = getSessionUser(req, data);
  const messageId = String(req.body?.messageId || 'all');
  const timestamp = now();
  for (const item of data.personalMessages) {
    if (item.userId === user.id && !item.senderId && !item.readAt && (messageId === 'all' || item.id === messageId)) item.readAt = timestamp;
  }
  writeData(data);
  res.json({ ok: true });
});

app.post('/api/fleet/messages/read', (req, res) => {
  const data = readData(); const user = getSessionUser(req, data); const captainId = fleetCaptainId(data, user); const timestamp = now();
  for (const item of data.personalMessages) if (item.type === 'fleet_direct_message' && item.captainId === captainId && item.userId === user.id && !item.readAt) item.readAt = timestamp;
  writeData(data); res.json({ ok:true });
});

app.post('/api/announcements', (req, res) => {
  const data = readData();
  const user = getSessionUser(req, data);
  const announcements = data.announcements.filter((item) => item.active !== false).sort((a, b) => Number(b.publishedAt || 0) - Number(a.publishedAt || 0)).slice(0, 100);
  res.json({ ok: true, announcements: announcements.map((item) => ({ ...item, read: Boolean(user.announcementReads?.[item.id]), showBanner: now() - Number(item.publishedAt || 0) < 24 * 60 * 60 * 1000 })) });
});

app.post('/api/announcements/read', (req, res) => {
  const data = readData();
  const user = getSessionUser(req, data);
  const announcementId = String(req.body?.announcementId || 'all');
  user.announcementReads ||= {};
  const timestamp = now();
  for (const item of data.announcements) {
    if (item.active !== false && (announcementId === 'all' || item.id === announcementId)) user.announcementReads[item.id] = timestamp;
  }
  writeData(data);
  res.json({ ok: true });
});

// Partner banners are an opt-in presentation surface.  They deliberately
// contain no wallet connection, signature, or automatic redirect behaviour:
// the client renders an explicit outbound-link button only after the user taps.
app.post('/api/sponsored-banners', (req, res) => {
  const placement = String(req.body?.placement || 'mining-top');
  if (!SPONSORED_BANNER_PLACEMENTS.has(placement)) {
    return res.status(400).json({ ok: false, message: 'Invalid sponsored banner placement.' });
  }
 …24252 tokens truncated… user: publicAdminUser(data, u), mining: calculateMining(data, u) }));
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
    { id: 'discord', icon: '💬', title: 'Discord', type: 'one_time', reward: 300, url: 'https://discord.gg/pChzTUcm2t', action: 'JOIN', enabled: true },
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


app.post('/api/game/launch', (req, res) => {
  const data = readData();
  const user = getSessionUser(req, data);
  if (!requireVerifiedCaptain(user, res)) return;
  const session = createGameLaunchSession(user);
  if (!session) return res.status(503).json({ ok: false, message: 'Game session signing is not configured.' });
  res.json({ ok: true, session, expiresAt: now() + GAME_SESSION_TTL_MS });
});

// Reward totals, daily limits and duplicate event ids remain server-authoritative.
app.post('/api/game/reward', (req, res) => {
  const data = readData();
  if (!data.settings?.gameRewardsEnabled) return res.status(503).json({ ok: false, message: 'Game rewards are temporarily disabled.' });
  const gameSession = verifyGameLaunchSession(req.body?.session);
  const user = gameSession ? data.users?.[gameSession.userId] : getSessionUser(req, data);
  if (!user) return res.status(401).json({ ok: false, message: 'Game session is invalid or has expired.' });
  if (!requireVerifiedCaptain(user, res)) return;
  if (!gameSession && !gameRewardSignatureValid(req, user)) {
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


// Game scores are stored separately from point rewards. A browser session may
// record a score, but it cannot create a financial or SPNX ledger entry.
app.post('/api/game/result', (req, res) => {
  const data = readData();
  const gameSession = verifyGameLaunchSession(req.body?.session);
  if (!gameSession) return res.status(401).json({ ok: false, message: 'Game session is invalid or has expired.' });
  const user = data.users?.[gameSession.userId];
  if (!user) return res.status(401).json({ ok: false, message: 'Captain session was not found.' });

  const runId = String(req.body?.runId || '').trim().slice(0, 128);
  const score = Math.floor(Number(req.body?.score));
  const summary = {
    kills: Math.max(0, Math.floor(Number(req.body?.kills || 0))),
    rescued: Math.max(0, Math.floor(Number(req.body?.rescued || 0))),
    missionCleared: Boolean(req.body?.missionCleared),
    bossDefeated: Boolean(req.body?.bossDefeated),
  };
  if (!runId || !Number.isFinite(score) || score < 0 || score > 1_000_000_000) {
    return res.status(400).json({ ok: false, message: 'Invalid game score payload.' });
  }

  data.gameResultKeys ||= {};
  const key = `${user.id}:${runId}`;
  user.gameScore ||= { bestScore: 0, lastScore: 0, lastRunId: '', updatedAt: 0 };
  if (data.gameResultKeys[key]) {
    return res.json({ ok: true, duplicate: true, score: user.gameScore.lastScore, bestScore: user.gameScore.bestScore });
  }

  user.gameScore.bestScore = Math.max(Number(user.gameScore.bestScore || 0), score);
  user.gameScore.lastScore = score;
  user.gameScore.lastRunId = runId;
  user.gameScore.updatedAt = now();
  user.updatedAt = now();
  data.gameResultKeys[key] = now();
  data.events.push({ type: 'game_score_recorded', userId: user.id, runId, score, ...summary, at: now() });
  writeData(data);

  res.json({ ok: true, score, bestScore: user.gameScore.bestScore, reward: 0, user: publicUser(data, user) });
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
function novaWalletSecurity(user) {
  user.novaWalletSecurity ||= { pinHash: '', pinSalt: '', failedAttempts: 0, lockedUntil: 0, lastUnlockedAt: 0, webauthnCredentials: [] };
  user.novaWalletSecurity.webauthnCredentials ||= [];
  return user.novaWalletSecurity;
}
function walletBiometricCredentials(security) {
  security.webauthnCredentials ||= [];
  return security.webauthnCredentials.filter((credential) => credential?.id && credential?.publicKey);
}
function publicWalletSecurity(user) {
  const security = novaWalletSecurity(user);
  const credentials = walletBiometricCredentials(security);
  return {
    pinConfigured: Boolean(security.pinHash),
    failedAttempts: Number(security.failedAttempts || 0),
    lockedUntil: Number(security.lockedUntil || 0),
    lastUnlockedAt: Number(security.lastUnlockedAt || 0),
    biometricAvailable: credentials.length > 0,
    biometricCredentialCount: credentials.length,
  };
}
function validWalletPin(pin) { return /^\d{6}$/.test(String(pin || '')); }
function walletPinHash(pin, salt) { return crypto.scryptSync(String(pin), salt, 64).toString('hex'); }
function issueWebAuthnChallenge(data, user, purpose, challenge) {
  const challengeId = crypto.randomUUID();
  data.webauthnChallenges ||= {};
  data.webauthnChallenges[challengeId] = { userId: user.id, purpose, challenge, expiresAt: now() + WEBAUTHN_CHALLENGE_TTL_MS };
  return challengeId;
}
function consumeWebAuthnChallenge(data, user, challengeId, purpose) {
  const challenge = data.webauthnChallenges?.[String(challengeId || '')];
  delete data.webauthnChallenges?.[String(challengeId || '')];
  if (!challenge || challenge.userId !== user.id || challenge.purpose !== purpose || Number(challenge.expiresAt || 0) < now()) return null;
  return challenge;
}
function walletDisplayName(user) {
  return String(user.name || user.username || `Captain ${user.id}`).slice(0, 80);
}

const TESTNET_POINT_FAUCET_AMOUNT = 10000;
const TESTNET_POINT_FAUCET_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const TESTNET_POINT_TRANSFER_HISTORY_LIMIT = 12;
function testnetPointAddress(user) {
  return `TSPNX-${String(user?.id || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase()}`;
}
function normalizedTestnetPointAddress(value) {
  return String(value || '').trim().toUpperCase();
}
function publicTestnetPointTransfers(data, user) {
  return (data.testnetPointTransfers || [])
    .filter((item) => item.fromUserId === user.id || item.toUserId === user.id)
    .slice(-TESTNET_POINT_TRANSFER_HISTORY_LIMIT)
    .reverse()
    .map((item) => ({
      id: item.id,
      direction: item.fromUserId === user.id ? 'sent' : 'received',
      amount: item.amount,
      address: item.fromUserId === user.id ? item.toAddress : item.fromAddress,
      at: item.at,
    }));
}
function publicTestnetPointFaucet(user) {
  const lastClaimedAt = Number(user.testnetPointFaucetLastClaimedAt || 0);
  const nextClaimAt = lastClaimedAt ? lastClaimedAt + TESTNET_POINT_FAUCET_COOLDOWN_MS : 0;
  return {
    balance: Number(user.testnetPoints || 0),
    amountPerRequest: TESTNET_POINT_FAUCET_AMOUNT,
    virtualAddress: testnetPointAddress(user),
    lastClaimedAt,
    nextClaimAt,
    available: !nextClaimAt || nextClaimAt <= now(),
  };
}

app.post('/api/nova-wallet/status', (req, res) => {
  const data = readData(); const user = getSessionUser(req, data);
  if (!requireVerifiedCaptain(user, res)) return;
  res.json({ ok: true, security: publicWalletSecurity(user), testnetPoints: publicTestnetPointFaucet(user), testnetTransfers: publicTestnetPointTransfers(data, user), kycRequiredForTransfers: true, transfersEnabled: false });
});
app.post('/api/nova-wallet/testnet-points/request', (req, res) => {
  const data = readData(); const user = getSessionUser(req, data);
  if (!requireVerifiedCaptain(user, res)) return;
  if (!data.settings?.tonTestnetEnabled || !data.settings?.tonTestnetPointsEnabled) {
    return res.status(409).json({ ok: false, message: 'Testnet point faucet is currently unavailable.' });
  }
  const faucet = publicTestnetPointFaucet(user);
  if (!faucet.available) return res.status(429).json({ ok: false, message: 'Testnet point faucet is available once every 24 hours.', testnetPoints: faucet });
  user.testnetPoints = Number(user.testnetPoints || 0) + TESTNET_POINT_FAUCET_AMOUNT;
  user.testnetPointFaucetLastClaimedAt = now();
  user.updatedAt = now();
  const updated = publicTestnetPointFaucet(user);
  data.events.push({ type: 'ton_testnet_points_faucet_claimed', userId: user.id, amount: TESTNET_POINT_FAUCET_AMOUNT, at: now() });
  writeData(data);
  res.json({ ok: true, testnetPoints: updated, message: `${TESTNET_POINT_FAUCET_AMOUNT.toLocaleString()} test points were added.` });
});
app.post('/api/nova-wallet/testnet-points/transfer', (req, res) => {
  const data = readData(); const sender = getSessionUser(req, data);
  if (!requireVerifiedCaptain(sender, res)) return;
  if (!data.settings?.tonTestnetEnabled || !data.settings?.tonTestnetPointsEnabled) {
    return res.status(409).json({ ok: false, message: 'Testnet point transfers are currently unavailable.' });
  }
  const requestId = String(req.body?.requestId || '').trim();
  const amount = Number(req.body?.amount);
  const recipientAddress = normalizedTestnetPointAddress(req.body?.recipientAddress);
  const pin = String(req.body?.pin || '');
  if (!/^[a-zA-Z0-9_-]{12,100}$/.test(requestId)) return res.status(400).json({ ok: false, message: 'Invalid test transfer request.' });
  if (!Number.isSafeInteger(amount) || amount <= 0) return res.status(400).json({ ok: false, message: 'Enter a whole-number Test Point amount greater than zero.' });
  if (!/^TSPNX-[A-Z0-9_-]{1,80}$/.test(recipientAddress)) return res.status(400).json({ ok: false, message: 'Enter a valid TSPNX test address.' });
  const security = novaWalletSecurity(sender);
  if (!security.pinHash || !validWalletPin(pin) || !crypto.timingSafeEqual(Buffer.from(security.pinHash, 'hex'), Buffer.from(walletPinHash(pin, security.pinSalt), 'hex'))) {
    return res.status(401).json({ ok: false, message: 'Confirm your six-digit NOVA Wallet PIN to send Test Points.' });
  }
  data.testnetPointTransfers ||= [];
  const existing = data.testnetPointTransfers.find((item) => item.fromUserId === sender.id && item.requestId === requestId);
  if (existing) return res.json({ ok: true, idempotent: true, transfer: existing, testnetPoints: publicTestnetPointFaucet(sender), testnetTransfers: publicTestnetPointTransfers(data, sender) });
  const recipient = Object.values(data.users || {}).find((candidate) => normalizedTestnetPointAddress(testnetPointAddress(candidate)) === recipientAddress);
  if (!recipient || recipient.isGuest || recipient.banned) return res.status(404).json({ ok: false, message: 'The TSPNX test address was not found.' });
  if (recipient.id === sender.id) return res.status(400).json({ ok: false, message: 'You cannot send Test Points to your own test address.' });
  if (Number(sender.testnetPoints || 0) < amount) return res.status(409).json({ ok: false, message: 'Insufficient Test Points.' });
  sender.testnetPoints = Number(sender.testnetPoints || 0) - amount;
  recipient.testnetPoints = Number(recipient.testnetPoints || 0) + amount;
  sender.updatedAt = now(); recipient.updatedAt = now();
  const transfer = { id: crypto.randomUUID(), requestId, fromUserId: sender.id, toUserId: recipient.id, fromAddress: testnetPointAddress(sender), toAddress: testnetPointAddress(recipient), amount, at: now() };
  data.testnetPointTransfers.push(transfer);
  data.testnetPointTransfers = data.testnetPointTransfers.slice(-5000);
  data.events.push({ type: 'ton_testnet_points_transferred', userId: sender.id, recipientId: recipient.id, amount, transferId: transfer.id, at: transfer.at });
  writeData(data);
  res.json({ ok: true, transfer, testnetPoints: publicTestnetPointFaucet(sender), testnetTransfers: publicTestnetPointTransfers(data, sender), message: `${amount.toLocaleString()} Test Points were sent to ${transfer.toAddress}.` });
});
app.post('/api/nova-wallet/pin/setup', (req, res) => {
  const data = readData(); const user = getSessionUser(req, data);
  if (!requireVerifiedCaptain(user, res)) return;
  const pin = String(req.body?.pin || '');
  if (!validWalletPin(pin)) return res.status(400).json({ ok: false, message: 'Use a 6-digit PIN.' });
  const security = novaWalletSecurity(user);
  if (security.pinHash) return res.status(409).json({ ok: false, message: 'Wallet PIN is already configured.' });
  security.pinSalt = crypto.randomBytes(16).toString('hex');
  security.pinHash = walletPinHash(pin, security.pinSalt);
  security.failedAttempts = 0; security.lockedUntil = 0; security.lastUnlockedAt = now();
  data.events.push({ type: 'nova_wallet_pin_created', userId: user.id, at: now() });
  writeData(data); res.json({ ok: true, security: publicWalletSecurity(user) });
});
app.post('/api/nova-wallet/pin/unlock', (req, res) => {
  const data = readData(); const user = getSessionUser(req, data);
  if (!requireVerifiedCaptain(user, res)) return;
  const security = novaWalletSecurity(user); const pin = String(req.body?.pin || '');
  if (!security.pinHash) return res.status(400).json({ ok: false, message: 'Create a Wallet PIN first.' });
  if (Number(security.lockedUntil || 0) > now()) return res.status(429).json({ ok: false, message: 'Wallet is temporarily locked after failed PIN attempts.', lockedUntil: security.lockedUntil });
  const valid = validWalletPin(pin) && crypto.timingSafeEqual(Buffer.from(security.pinHash, 'hex'), Buffer.from(walletPinHash(pin, security.pinSalt), 'hex'));
  if (!valid) {
    security.failedAttempts = Number(security.failedAttempts || 0) + 1;
    if (security.failedAttempts >= 5) { security.lockedUntil = now() + 15 * 60 * 1000; security.failedAttempts = 0; }
    data.events.push({ type: 'nova_wallet_unlock_failed', userId: user.id, at: now() }); writeData(data);
    return res.status(401).json({ ok: false, message: 'Wallet PIN is incorrect.', security: publicWalletSecurity(user) });
  }
  security.failedAttempts = 0; security.lockedUntil = 0; security.lastUnlockedAt = now();
  data.events.push({ type: 'nova_wallet_unlocked', userId: user.id, at: now() }); writeData(data);
  res.json({ ok: true, security: publicWalletSecurity(user) });
});

// WebAuthn keeps fingerprint / Face ID material on the Captain's device. This
// server persists only credential public keys, counters and audit events.
app.post('/api/nova-wallet/biometric/register/options', async (req, res) => {
  const data = readData(); const user = getSessionUser(req, data);
  if (!requireVerifiedCaptain(user, res)) return;
  const security = novaWalletSecurity(user);
  if (!security.pinHash) return res.status(400).json({ ok: false, message: 'Create a Wallet PIN before registering device biometrics.' });
  const credentials = walletBiometricCredentials(security);
  try {
    const options = await generateRegistrationOptions({
      rpName: 'SpaceNovaX NOVA Wallet', rpID: WEBAUTHN_RP_ID,
      userID: Buffer.from(String(user.id)), userName: `captain-${user.id}`, userDisplayName: walletDisplayName(user),
      timeout: 60000, attestationType: 'none',
      excludeCredentials: credentials.map((credential) => ({ id: credential.id, transports: credential.transports || [] })),
      authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'preferred', userVerification: 'required' },
    });
    const challengeId = issueWebAuthnChallenge(data, user, 'register', options.challenge);
    data.events.push({ type: 'nova_wallet_biometric_registration_started', userId: user.id, at: now() });
    writeData(data); res.json({ ok: true, challengeId, options });
  } catch (error) {
    console.error('Wallet biometric registration options failed', error);
    res.status(503).json({ ok: false, message: 'Device biometric setup is not available right now.' });
  }
});

app.post('/api/nova-wallet/biometric/register/verify', async (req, res) => {
  const data = readData(); const user = getSessionUser(req, data);
  if (!requireVerifiedCaptain(user, res)) return;
  const challenge = consumeWebAuthnChallenge(data, user, req.body?.challengeId, 'register');
  if (!challenge) return res.status(400).json({ ok: false, message: 'The device biometric request expired. Start again.' });
  try {
    const verification = await verifyRegistrationResponse({ response: req.body?.response, expectedChallenge: challenge.challenge, expectedOrigin: WEBAUTHN_ORIGIN, expectedRPID: WEBAUTHN_RP_ID, requireUserVerification: true });
    if (!verification.verified || !verification.registrationInfo?.userVerified) throw new Error('Device verification was not confirmed.');
    const security = novaWalletSecurity(user);
    const credentials = walletBiometricCredentials(security);
    const registration = verification.registrationInfo;
    if (!credentials.some((credential) => credential.id === registration.credentialID)) {
      credentials.push({
        id: registration.credentialID,
        publicKey: Buffer.from(registration.credentialPublicKey).toString('base64url'),
        counter: registration.counter,
        transports: Array.isArray(req.body?.response?.response?.transports) ? req.body.response.response.transports : [],
        deviceType: registration.credentialDeviceType,
        backedUp: registration.credentialBackedUp,
        registeredAt: now(), lastUsedAt: 0,
      });
    }
    data.events.push({ type: 'nova_wallet_biometric_registered', userId: user.id, at: now() });
    writeData(data); res.json({ ok: true, security: publicWalletSecurity(user) });
  } catch (error) {
    data.events.push({ type: 'nova_wallet_biometric_registration_failed', userId: user.id, at: now() });
    writeData(data); console.error('Wallet biometric registration failed', error);
    res.status(400).json({ ok: false, message: 'Device biometric verification failed. Your Wallet was not changed.' });
  }
});

app.post('/api/nova-wallet/biometric/authenticate/options', async (req, res) => {
  const data = readData(); const user = getSessionUser(req, data);
  if (!requireVerifiedCaptain(user, res)) return;
  const security = novaWalletSecurity(user); const credentials = walletBiometricCredentials(security);
  if (!credentials.length) return res.status(400).json({ ok: false, message: 'No device biometric is registered for this Wallet.' });
  try {
    const options = await generateAuthenticationOptions({ rpID: WEBAUTHN_RP_ID, timeout: 60000, userVerification: 'required', allowCredentials: credentials.map((credential) => ({ id: credential.id, transports: credential.transports || [] })) });
    const challengeId = issueWebAuthnChallenge(data, user, 'authenticate', options.challenge);
    data.events.push({ type: 'nova_wallet_biometric_authentication_started', userId: user.id, at: now() });
    writeData(data); res.json({ ok: true, challengeId, options });
  } catch (error) {
    console.error('Wallet biometric authentication options failed', error);
    res.status(503).json({ ok: false, message: 'Device biometric authentication is not available right now.' });
  }
});

app.post('/api/nova-wallet/biometric/authenticate/verify', async (req, res) => {
  const data = readData(); const user = getSessionUser(req, data);
  if (!requireVerifiedCaptain(user, res)) return;
  const challenge = consumeWebAuthnChallenge(data, user, req.body?.challengeId, 'authenticate');
  if (!challenge) return res.status(400).json({ ok: false, message: 'The device biometric request expired. Start again.' });
  const security = novaWalletSecurity(user);
  const credential = walletBiometricCredentials(security).find((item) => item.id === String(req.body?.response?.id || ''));
  if (!credential) return res.status(401).json({ ok: false, message: 'This device credential is not registered for the Wallet.' });
  try {
    const verification = await verifyAuthenticationResponse({
      response: req.body?.response, expectedChallenge: challenge.challenge, expectedOrigin: WEBAUTHN_ORIGIN, expectedRPID: WEBAUTHN_RP_ID,
      authenticator: { credentialID: credential.id, credentialPublicKey: Buffer.from(credential.publicKey, 'base64url'), counter: Number(credential.counter || 0), transports: credential.transports || [] }, requireUserVerification: true,
    });
    if (!verification.verified || !verification.authenticationInfo?.userVerified) throw new Error('Device verification was not confirmed.');
    credential.counter = verification.authenticationInfo.newCounter;
    credential.lastUsedAt = now(); security.failedAttempts = 0; security.lockedUntil = 0; security.lastUnlockedAt = now();
    data.events.push({ type: 'nova_wallet_biometric_unlocked', userId: user.id, at: now() });
    writeData(data); res.json({ ok: true, security: publicWalletSecurity(user) });
  } catch (error) {
    data.events.push({ type: 'nova_wallet_biometric_unlock_failed', userId: user.id, at: now() });
    writeData(data); console.error('Wallet biometric authentication failed', error);
    res.status(401).json({ ok: false, message: 'Device biometric verification failed. Use your Wallet PIN.' });
  }
});

app.post('/api/nova-wallet/recovery/request', (req, res) => {
  const data = readData(); const user = getSessionUser(req, data);
  if (!requireVerifiedCaptain(user, res)) return;
  const security = novaWalletSecurity(user);
  if (!security.pinHash) return res.status(400).json({ ok: false, message: 'Create a Wallet PIN first.' });
  if (!security.recoveryAvailableAt) {
    security.recoveryRequestedAt = now();
    security.recoveryAvailableAt = now() + 24 * 60 * 60 * 1000;
    data.events.push({ type: 'nova_wallet_recovery_requested', userId: user.id, at: now(), availableAt: security.recoveryAvailableAt });
    writeData(data);
  }
  res.json({ ok: true, recoveryAvailableAt: security.recoveryAvailableAt, message: 'Recovery protection period has started.' });
});
app.post('/api/nova-wallet/recovery/confirm', (req, res) => {
  const data = readData(); const user = getSessionUser(req, data);
  if (!requireVerifiedCaptain(user, res)) return;
  const security = novaWalletSecurity(user);
  if (!security.recoveryAvailableAt || Number(security.recoveryAvailableAt) > now()) return res.status(403).json({ ok: false, message: 'Recovery protection period is not complete.', recoveryAvailableAt: security.recoveryAvailableAt || 0 });
  user.novaWalletSecurityArchives ||= [];
  user.novaWalletSecurityArchives.push({ archivedAt: now(), reason: 'pin_forgotten_new_wallet', profileId: crypto.randomUUID() });
  user.novaWalletSecurity = { pinHash: '', pinSalt: '', failedAttempts: 0, lockedUntil: 0, lastUnlockedAt: 0, recoveryRequestedAt: 0, recoveryAvailableAt: 0 };
  data.events.push({ type: 'nova_wallet_new_profile_created', userId: user.id, at: now() });
  writeData(data); res.json({ ok: true, security: publicWalletSecurity(user), message: 'New Wallet security profile created.' });
});

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
  const groqApiKey = String(process.env.GROQ_API_KEY || '').trim();
  const geminiApiKey = String(process.env.GEMINI_API_KEY || '').trim();
  if (!groqApiKey && !geminiApiKey) {
    return res.status(503).json({ ok: false, message: 'NOVA AI core is not configured.' });
  }

  const message = String(req.body?.message || '').trim().slice(0, 2000);
  const history = Array.isArray(req.body?.history) ? req.body.history.slice(-6) : [];
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
    'Reply in the language used by the Captain. Be calm, futuristic, and useful.',
    'During this beta, answer in 2 or 3 short sentences by default. Keep the answer under about 500 Korean characters or the equivalent length in the Captain language.',
    'Do not write an essay, a long guide, or repeat the question. If the Captain explicitly asks for a long, detailed, in-depth, or full explanation, do not provide it. Politely say in the Captain language that NOVA AI is currently in development and long-form answers are not supported yet, then ask for a shorter question.',
    'For Korean long-form requests, use this wording: "NOVA AI는 현재 개발 단계라 장문의 답변은 아직 지원하지 않습니다. 짧은 질문으로 다시 요청해 주세요."',
    'Never request passwords, seed phrases, wallet private keys, or Telegram login codes.',
    'Do not claim that SPNX Points are guaranteed money or promise investment returns.',
    `Captain context: level=${Number(sessionUser.level || captain.level || 1)}, balance=${Number(sessionUser.balance || 0)}, miningActive=${Boolean(sessionUser.mining?.active)}, gameRewardToday=${Number(sessionUser.gameReward?.earnedToday || 0)}.`,
    ...(String(req.body?.orbitContext || '').trim()
      ? [`Orbit Earth Navigation live context: ${String(req.body.orbitContext).trim().slice(0, 500)}`]
      : []),
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

  async function requestJson(endpoint, headers, body) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal });
      let result = {};
      try { result = await response.json(); } catch { /* keep a safe empty error object */ }
      if (!response.ok) throw Object.assign(new Error(result?.error?.message || `provider-${response.status}`), { status: response.status });
      return result;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function askGroq() {
    if (!groqApiKey) throw Object.assign(new Error('Groq is not configured.'), { code: 'GROQ_NOT_CONFIGURED' });
    const model = process.env.GROQ_MODEL || NOVA_GROQ_DEFAULT_MODEL;
    const apiBase = String(process.env.GROQ_API_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/+$/, '');
    const result = await requestJson(`${apiBase}/chat/completions`, {
      Authorization: `Bearer ${groqApiKey}`,
      'Content-Type': 'application/json',
    }, {
      model,
      messages: [
        { role: 'system', content: systemInstruction },
        ...contents.map((item) => ({ role: item.role === 'model' ? 'assistant' : 'user', content: item.parts[0].text })),
      ],
      max_tokens: NOVA_RESPONSE_MAX_TOKENS,
      temperature: 0.55,
    });
    const content = result?.choices?.[0]?.message?.content;
    const reply = Array.isArray(content) ? content.map((part) => String(part?.text || '')).join('') : String(content || '');
    if (!reply.trim()) throw new Error('Groq returned no response.');
    return reply.trim();
  }

  async function askGemini() {
    if (!geminiApiKey) throw Object.assign(new Error('Gemini is not configured.'), { code: 'GEMINI_NOT_CONFIGURED' });
    const model = process.env.GEMINI_MODEL || NOVA_GEMINI_DEFAULT_MODEL;
    const apiBase = String(process.env.GEMINI_API_BASE_URL || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '');
    const result = await requestJson(`${apiBase}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      'x-goog-api-key': geminiApiKey,
      'Content-Type': 'application/json',
    }, {
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents,
      generationConfig: {
        maxOutputTokens: NOVA_RESPONSE_MAX_TOKENS,
        temperature: 0.55,
      },
    });
    const reply = (result.candidates?.[0]?.content?.parts || [])
      .map((part) => String(part?.text || ''))
      .join('')
      .trim();
    if (!reply) throw new Error('Gemini returned no response.');
    return reply;
  }

  try {
    let reply = '';
    let provider = 'groq';
    try {
      reply = await enqueueNovaChat(userId, askGroq);
    } catch (groqError) {
      // Gemini is only a safety fallback.  It is not used for normal NOVA
      // requests, which keeps its free tier available during Groq incidents.
      if (!geminiApiKey) throw groqError;
      console.warn('NOVA Groq unavailable; trying Gemini fallback', groqError.status || groqError.code || groqError.name);
      provider = 'gemini';
      reply = await enqueueNovaChat(userId, askGemini);
    }
    if (!reply) {
      releaseReservation();
      return res.status(502).json({ ok: false, message: 'NOVA AI returned no response.' });
    }
    const latestData = readData();
    const reservation = latestData.events.find((event) => event.type === 'nova_chat_pending' && event.requestId === requestId);
    if (reservation) {
      reservation.type = 'nova_chat';
      reservation.model = NOVA_PUBLIC_MODEL_NAME;
      reservation.provider = provider;
      reservation.completedAt = now();
    } else {
      latestData.events.push({ type: 'nova_chat', requestId, userId, dayKey, model: NOVA_PUBLIC_MODEL_NAME, provider, at: now() });
    }
    writeData(latestData);
    res.json({ ok: true, reply, usage: { used: recentUsage + 1, limit: NOVA_DAILY_LIMIT } });
  } catch (error) {
    console.error('NOVA AI connection error', error);
    releaseReservation();
    res.status(502).json({ ok: false, message: 'NOVA AI connection failed.' });
  }
});

app.post('/api/nova/speech', (_req, res) => {
  // Kept as a clear migration response for older clients. Voice playback is
  // intentionally local/browser-only; no remote audio provider is used.
  res.status(410).json({ ok: false, code: 'NOVA_LOCAL_VOICE_ONLY', message: 'NOVA voice uses browser or local audio only.' });
});

app.get('/api/nova/status', (req, res) => {
  const data = readData();
  res.json({
    ok: true,
    enabled: Boolean(data.settings?.novaAiEnabled),
    configured: Boolean(process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY),
    model: NOVA_PUBLIC_MODEL_NAME,
    dailyLimit: NOVA_DAILY_LIMIT,
  });
});

// Public orbital data proxy. This keeps third-party CORS and rate-limit details
// out of the client while exposing a compact, real public cross-section of orbit:
// crewed stations, weather/NOAA, Earth-observation and navigation constellations.
const ORBIT_TLE_CACHE_MS = 6 * 60 * 60 * 1000;
const orbitTleCache = { at: 0, satellites: [] };
app.get('/api/orbit/satellites', async (req, res) => {
  try {
    if (orbitTleCache.satellites.length && now() - orbitTleCache.at < ORBIT_TLE_CACHE_MS) {
      return res.json({ ok: true, satellites: orbitTleCache.satellites, cached: true });
    }
    const groups = ['stations', 'weather', 'noaa', 'resource', 'gps-ops', 'galileo'];
    const responses = await Promise.allSettled(groups.map(async (group) => {
      const response = await fetch(`https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=tle`, {
        headers: { 'User-Agent': 'SpaceNovaX-Orbit/1.0 (public TLE relay)' },
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) throw new Error(`${group}: Celestrak responded ${response.status}`);
      return response.text();
    }));
    const lines = responses
      .filter((result) => result.status === 'fulfilled')
      .flatMap((result) => result.value.split('\n').map((line) => line.trimEnd()).filter(Boolean));
    if (!lines.length) throw new Error('Celestrak public TLE groups unavailable');
    const satellites = [];
    const seen = new Set();
    for (let index = 0; index + 2 < lines.length; index += 3) {
      const name = lines[index]?.trim();
      const line1 = lines[index + 1];
      const line2 = lines[index + 2];
      if (name && !seen.has(name) && line1?.startsWith('1 ') && line2?.startsWith('2 ')) {
        seen.add(name);
        satellites.push({ name, line1, line2 });
      }
    }
    // Keep the WebGL layer light, but provide enough real tracked objects for a
    // meaningful global constellation view on mobile.
    // Keep enough public objects to show a useful constellation on the visible
    // hemisphere while remaining light enough for mobile WebGL rendering.
    orbitTleCache.satellites = satellites.slice(0, 32);
    orbitTleCache.at = now();
    return res.json({ ok: true, satellites: orbitTleCache.satellites, cached: false });
  } catch (error) {
    console.error('Orbit TLE fetch failed', error.message);
    if (orbitTleCache.satellites.length) {
      return res.json({ ok: true, satellites: orbitTleCache.satellites, cached: true, stale: true });
    }
    return res.status(502).json({ ok: false, message: 'Satellite network temporarily unavailable.', satellites: [] });
  }
});

// NASA GIBS near-real-time true-colour imagery.  The image includes observed cloud
// cover and is intentionally fetched server-side: the browser receives a same-origin
// image with a short cache window instead of every Captain directly hitting NASA.
// We keep this to a small, bounded in-memory cache because it is a public visual layer,
// not user data.
const ORBIT_SATELLITE_CACHE_MS = 10 * 60 * 1000;
const ORBIT_SATELLITE_MAX_BYTES = 2_500_000;
const orbitSatelliteImageCache = new Map();
function orbitUtcDate(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * 86_400_000);
  return date.toISOString().slice(0, 10);
}
function validOrbitSatelliteDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null;
}
app.get('/api/orbit/satellite-imagery', async (req, res) => {
  const requestedDate = validOrbitSatelliteDate(req.query.date) || orbitUtcDate();
  const metadataOnly = String(req.query.meta || '') === '1';
  // Today's polar-orbit composite can still be assembling.  Try it first, then use
  // the latest complete day so the Satellite control always has a useful scene.
  const candidateDates = [requestedDate, orbitUtcDate(-1), orbitUtcDate(-2)]
    .filter((date, index, values) => values.indexOf(date) === index);
  try {
    for (const date of candidateDates) {
      const cached = orbitSatelliteImageCache.get(date);
      if (cached && now() - cached.at < ORBIT_SATELLITE_CACHE_MS) {
        if (metadataOnly) return res.json({ ok: true, date, source: 'NASA GIBS · MODIS Terra', cached: true, fetchedAt: new Date(cached.at).toISOString() });
        res.setHeader('Cache-Control', 'public, max-age=600, stale-while-revalidate=600');
        res.setHeader('X-Orbit-Satellite-Date', date);
        res.setHeader('X-Orbit-Satellite-Source', 'NASA-GIBS-MODIS-Terra');
        return res.type(cached.contentType).send(cached.body);
      }

      const sourceUrl = new URL('https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi');
      sourceUrl.search = new URLSearchParams({
        SERVICE: 'WMS', REQUEST: 'GetMap', VERSION: '1.1.1',
        LAYERS: 'MODIS_Terra_CorrectedReflectance_TrueColor', STYLES: '',
        SRS: 'EPSG:4326', BBOX: '-180,-90,180,90', WIDTH: '2048', HEIGHT: '1024',
        FORMAT: 'image/jpeg', TRANSPARENT: 'FALSE', TIME: date,
      }).toString();
      const response = await fetch(sourceUrl, {
        headers: { 'User-Agent': 'SpaceNovaX-Orbit/1.0 (NASA GIBS satellite imagery relay)' },
        signal: AbortSignal.timeout(18_000),
      });
      const contentType = String(response.headers.get('content-type') || '').toLowerCase().split(';')[0];
      if (!response.ok || !/^image\/(jpeg|png|webp)$/.test(contentType)) continue;
      const body = Buffer.from(await response.arrayBuffer());
      if (!body.length || body.length > ORBIT_SATELLITE_MAX_BYTES) continue;
      const entry = { at: now(), contentType, body };
      orbitSatelliteImageCache.set(date, entry);
      while (orbitSatelliteImageCache.size > 4) orbitSatelliteImageCache.delete(orbitSatelliteImageCache.keys().next().value);
      if (metadataOnly) return res.json({ ok: true, date, source: 'NASA GIBS · MODIS Terra', cached: false, fetchedAt: new Date(entry.at).toISOString() });
      res.setHeader('Cache-Control', 'public, max-age=600, stale-while-revalidate=600');
      res.setHeader('X-Orbit-Satellite-Date', date);
      res.setHeader('X-Orbit-Satellite-Source', 'NASA-GIBS-MODIS-Terra');
      return res.type(contentType).send(body);
    }
    throw new Error('NASA GIBS imagery is temporarily unavailable');
  } catch (error) {
    console.error('Orbit NASA satellite imagery failed', error.message);
    return res.status(502).json({ ok: false, message: 'Satellite imagery temporarily unavailable.' });
  }
});

// Destination and reverse-geocoding proxy for Earth Navigation.
const geocodeCache = new Map();
const GEOCODE_CACHE_MS = 30 * 60 * 1000;
// Korea uses Kakao's official Local REST API when a server-side key is set.
// The browser never receives this key; all requests remain behind this proxy.
const KAKAO_REST_API_KEY = String(process.env.KAKAO_REST_API_KEY || '').trim();
// Global place search is deliberately opt-in and hard-capped below the current
// paid tier. If the key, quota, or provider is unavailable, OSM remains active.
const GOOGLE_PLACES_API_KEY = String(process.env.GOOGLE_PLACES_API_KEY || '').trim();
const GOOGLE_PLACES_MONTHLY_LIMIT = Math.max(0, Math.min(4000, Number(process.env.GOOGLE_PLACES_MONTHLY_LIMIT || 4000)));
// Search map-visible POIs only around the Captain's supplied local area. This
// complements broad address geocoding without turning the service into tracking.
const GEOCODE_MAP_POI_RADIUS_METERS = 10_000;
// Known local landmark aliases let common Korean building names resolve even
// when the public map stores a Latin letter or an expanded road address.
const NAVIGATION_SEARCH_ALIASES = {
  '센텀큐시티': ['김해 센텀Q시티', '경상남도 김해시 주촌면 선지로 85'],
  '센텀q시티': ['김해 센텀Q시티', '경상남도 김해시 주촌면 선지로 85'],
  '센텀큐시티아파트': ['김해 센텀Q시티', '경상남도 김해시 주촌면 선지로 85'],
};

function consumeGooglePlacesSearchQuota() {
  if (!GOOGLE_PLACES_API_KEY || !GOOGLE_PLACES_MONTHLY_LIMIT) return false;
  const data = readData();
  const month = new Date().toISOString().slice(0, 7);
  data.googlePlacesUsage ||= { month, requests: 0 };
  if (data.googlePlacesUsage.month !== month) data.googlePlacesUsage = { month, requests: 0 };
  if (Number(data.googlePlacesUsage.requests || 0) >= GOOGLE_PLACES_MONTHLY_LIMIT) return false;
  data.googlePlacesUsage.requests = Number(data.googlePlacesUsage.requests || 0) + 1;
  writeData(data);
  return true;
}
app.get('/api/orbit/geocode', async (req, res) => {
  const query = String(req.query.q || '').normalize('NFKC').replace(/[，、;；]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
  const compactQuery = query.replace(/\s+/g, '');
  const latitude = req.query.lat !== undefined ? Number(req.query.lat) : null;
  const longitude = req.query.lon !== undefined ? Number(req.query.lon) : null;
  const nearLatitude = req.query.nearLat !== undefined ? Number(req.query.nearLat) : null;
  const nearLongitude = req.query.nearLon !== undefined ? Number(req.query.nearLon) : null;
  const language = String(req.query.lang || 'en').toLowerCase().replace(/[^a-z-]/g, '').slice(0, 5) || 'en';

  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      return res.status(400).json({ ok: false, message: 'Invalid coordinates.' });
    }
    const key = `reverse:${latitude.toFixed(2)},${longitude.toFixed(2)}:${language}`;
    const cached = geocodeCache.get(key);
    if (cached && now() - cached.at < GEOCODE_CACHE_MS) return res.json({ ok: true, place: cached.value, cached: true });
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&accept-language=${encodeURIComponent(language)}`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'SpaceNovaX-Orbit/1.0 (contact: business@spacenovax.com)' },
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) throw new Error(`Nominatim responded ${response.status}`);
      const item = await response.json();
      const place = {
        country: item.address?.country || '',
        city: item.address?.city || item.address?.town || item.address?.state || item.address?.village || '',
      };
      geocodeCache.set(key, { at: now(), value: place });
      return res.json({ ok: true, place, cached: false });
    } catch (error) {
      console.error('Orbit reverse geocode failed', error.message);
      return res.status(502).json({ ok: false, message: 'Reverse geocode temporarily unavailable.' });
    }
  }

  // Coordinates are a first-class destination format. This allows a Captain to
  // paste a pin shared from any map without relying on a provider-specific link.
  const coordinateMatch = query.match(/^\\s*([+-]?\\d{1,2}(?:\\.\\d+)?)\\s*[,/ ]\\s*([+-]?\\d{1,3}(?:\\.\\d+)?)\\s*$/);
  if (coordinateMatch) {
    const coordinateLat = Number(coordinateMatch[1]);
    const coordinateLon = Number(coordinateMatch[2]);
    if (Number.isFinite(coordinateLat) && Number.isFinite(coordinateLon) && Math.abs(coordinateLat) <= 90 && Math.abs(coordinateLon) <= 180) {
      return res.json({ ok: true, results: [{
        id: `coordinate:${coordinateLat.toFixed(6)},${coordinateLon.toFixed(6)}`,
        label: `좌표 ${coordinateLat.toFixed(6)}, ${coordinateLon.toFixed(6)}`,
        address: '입력한 위도·경도 좌표',
        lat: coordinateLat,
        lon: coordinateLon,
        country: '',
        type: 'coordinate',
        category: 'coordinate',
      }], cached: false });
    }
    return res.status(400).json({ ok: false, message: 'Invalid coordinate destination.', results: [] });
  }

  if (query.length < 2) return res.json({ ok: true, results: [] });
  const nearbyRequested = req.query.nearLat !== undefined || req.query.nearLon !== undefined;
  const nearbyValid = Number.isFinite(nearLatitude) && Number.isFinite(nearLongitude)
    && Math.abs(nearLatitude) <= 90 && Math.abs(nearLongitude) <= 180;
  if (nearbyRequested && !nearbyValid) return res.status(400).json({ ok: false, message: 'Invalid nearby search coordinates.' });

  // Keep the address exactly as supplied first.  When a Korean address is pasted
  // with its spaces removed, provide one conservative, suffix-aware alternative
  // (시·군·구·읍·면·동·리·로·길).  This broadens address matching without
  // inventing a location or silently changing the Captain's destination.
  const spacedAddressQuery = compactQuery.replace(
    /(특별자치시|특별시|광역시|자치도|도|시|군|구|읍|면|동|리|로|길)(?=[가-힣0-9])/g,
    '$1 ',
  ).replace(/\s+/g, ' ').trim();
  const landmarkKey = compactQuery.toLowerCase().replace(/\s+/g, '');
  const simplifiedPlaceQuery = compactQuery.replace(/(아파트|apt|apartments?|빌딩|건물|상가|센터)$/i, '').trim();
  const aliasTerms = NAVIGATION_SEARCH_ALIASES[landmarkKey] || [];
  const searchTerms = [...new Set([
    query,
    compactQuery !== query ? compactQuery : '',
    spacedAddressQuery !== query && spacedAddressQuery !== compactQuery ? spacedAddressQuery : '',
    simplifiedPlaceQuery && simplifiedPlaceQuery !== compactQuery ? simplifiedPlaceQuery : '',
    ...aliasTerms,
  ].filter(Boolean))].slice(0, 5);
  const nearbyKey = nearbyValid ? `:${nearLatitude.toFixed(2)},${nearLongitude.toFixed(2)}` : '';
  const cacheProviderKey = KAKAO_REST_API_KEY ? ':kakao-enabled' : ':kakao-disabled';
  const key = `search:${searchTerms.join('|').toLowerCase()}:${language}${nearbyKey}${cacheProviderKey}`;
  const cached = geocodeCache.get(key);
  if (cached && now() - cached.at < GEOCODE_CACHE_MS) return res.json({ ok: true, results: cached.value, providers: cached.providers || {}, cached: true });

  try {
    let nearbyViewbox = '';
    if (nearbyValid) {
      const latRange = 0.18;
      const lonRange = Math.min(1.2, Math.max(0.2, latRange / Math.max(0.25, Math.cos(nearLatitude * Math.PI / 180))));
      const left = Math.max(-180, nearLongitude - lonRange).toFixed(3);
      const right = Math.min(180, nearLongitude + lonRange).toFixed(3);
      const top = Math.min(90, nearLatitude + latRange).toFixed(3);
      const bottom = Math.max(-90, nearLatitude - latRange).toFixed(3);
      nearbyViewbox = `&viewbox=${left},${top},${right},${bottom}&bounded=0`;
    }
    const searchNominatim = async (term) => {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&namedetails=1&extratags=1&dedupe=1&limit=20&accept-language=${encodeURIComponent(language)}&q=${encodeURIComponent(term)}${nearbyViewbox}`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'SpaceNovaX-Orbit/1.0 (contact: business@spacenovax.com)' },
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) throw new Error(`Nominatim responded ${response.status}`);
      return response.json();
    };

    // Search the literal input first. If it is a short building or landmark
    // name, try the normalized aliases one by one as well. This is important
    // for Korean names such as “센텀큐시티”, where the public map may store
    // the Latin letter form first and then only the underlying road address.
    // The loop stops as soon as a useful set is found, so it remains bounded.
    let items = await searchNominatim(searchTerms[0]);
    const combined = new Map((items || []).map((item) => [String(item.place_id), item]));
    if (combined.size < 6 && searchTerms.length > 1) {
      for (const term of searchTerms.slice(1)) {
        const fallbackItems = await searchNominatim(term);
        (fallbackItems || []).forEach((item) => combined.set(String(item.place_id), item));
        if (combined.size >= 6) break;
      }
      items = [...combined.values()].slice(0, 24);
    }

    // Use Kakao's official address/place data for searches that are clearly in
    // Korea. It returns building names and business POIs that are not always
    // present in global OSM data. The worldwide Nominatim/OSM path remains the
    // fallback for every other region and when the optional key is not set.
    const isKoreanLocation = nearbyValid
      && nearLatitude >= 32.5 && nearLatitude <= 39.5
      && nearLongitude >= 124 && nearLongitude <= 132;
    const useKakaoSearch = Boolean(KAKAO_REST_API_KEY && (/[가-힣]/.test(query) || isKoreanLocation));
    const kakaoProvider = {
      configured: Boolean(KAKAO_REST_API_KEY),
      requested: useKakaoSearch,
      status: useKakaoSearch ? 'pending' : (KAKAO_REST_API_KEY ? 'not_applicable' : 'not_configured'),
      code: null,
      resultCount: 0,
    };
    const searchKakao = async () => {
      if (!useKakaoSearch) return [];
      const request = async (endpoint, parameters) => {
        const url = new URL('https://dapi.kakao.com/v2/local/search/' + endpoint + '.json');
        Object.entries(parameters).forEach(([name, value]) => {
          if (value !== undefined && value !== null && value !== '') url.searchParams.set(name, String(value));
        });
        const response = await fetch(url, {
          headers: { Authorization: 'KakaoAK ' + KAKAO_REST_API_KEY },
          signal: AbortSignal.timeout(8_000),
        });
        if (!response.ok) throw new Error('Kakao Local responded ' + response.status);
        return response.json();
      };
      const nearbyParameters = nearbyValid ? {
        x: nearLongitude.toFixed(6), y: nearLatitude.toFixed(6), radius: 10000, sort: 'distance',
      } : {};
      // Kakao keeps many Korean buildings under a spaced, regional, or Latin
      // letter spelling. Search the exact input and up to two normalized aliases
      // so “센텀큐시티” can return the apartment, gate, building units, and
      // nearby businesses instead of only a fallback road segment.
      const kakaoTerms = [...new Set([query, ...searchTerms].filter(Boolean))].slice(0, 3);
      const combined = new Map();
      try {
        for (const term of kakaoTerms) {
          const keyword = await request('keyword', { query: term, size: 15, ...nearbyParameters });
          (keyword.documents || []).forEach((document) => {
            const id = document.id || `${document.x},${document.y}:${document.place_name}`;
            combined.set(`keyword:${id}`, { source: 'keyword', document });
          });
          // A precise street address may not have a keyword POI record. Use the
          // address endpoint only when the keyword results are still sparse.
          if (combined.size < 8) {
            const address = await request('address', { query: term, analyze_type: 'similar', size: 15 });
            (address.documents || []).forEach((document) => {
              const id = document.address_name || `${document.x},${document.y}`;
              combined.set(`address:${id}`, { source: 'address', document });
            });
          }
          if (combined.size >= 15) break;
        }
        const entries = [...combined.values()].slice(0, 24);
        kakaoProvider.status = 'ok';
        kakaoProvider.resultCount = entries.length;
        return entries;
      } catch (error) {
        const message = String(error?.message || '');
        const status = message.match(/\b(401|403|429|5\d\d)\b/)?.[1] || 'REQUEST_FAILED';
        kakaoProvider.status = 'error';
        kakaoProvider.code = status;
        console.warn('Orbit Kakao Local search unavailable', message);
        return [];
      }
    };
    const kakaoItems = await searchKakao();

    // For non-Korean searches, Google Places is an optional quality upgrade
    // for global building and business names. It is never called after the
    // strict monthly safety cap, and it can never suppress OSM fallback.
    const searchGooglePlaces = async () => {
      if (useKakaoSearch || (items?.length || 0) >= 8 || !consumeGooglePlacesSearchQuota()) return [];
      const body = { textQuery: query, languageCode: language, pageSize: 15 };
      if (nearbyValid) {
        body.locationBias = {
          circle: {
            center: { latitude: nearLatitude, longitude: nearLongitude },
            radius: 10000,
          },
        };
      }
      try {
        const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types',
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(8_000),
        });
        if (!response.ok) throw new Error('Google Places responded ' + response.status);
        return (await response.json()).places || [];
      } catch (error) {
        console.warn('Orbit Google Places search unavailable', error.message);
        return [];
      }
    };
    const googlePlaceItems = await searchGooglePlaces();

    // Nominatim is best for postal addresses, but map-visible shops, apartment
    // buildings and local landmarks are often stored only as OSM POI tags.
    // Query those tags only as a bounded fallback around the supplied local area.
    const searchNearbyMapPois = async () => {
      if (!nearbyValid || compactQuery.length < 2) return [];
      const escapedNeedle = compactQuery
        .replaceAll('\\', '\\\\')
        .replaceAll('"', '\\"')
        .replaceAll('$', '\\$')
        .replace(/[.*+?^{}()|[\]]/g, (character) => '\\' + character);
      const around = `around:${GEOCODE_MAP_POI_RADIUS_METERS},${nearLatitude.toFixed(5)},${nearLongitude.toFixed(5)}`;
      const nameFields = ['name', 'name:ko', 'name:en', 'alt_name', 'official_name', 'short_name', 'brand'];
      const clauses = nameFields.map((field) => `nwr(${around})["${field}"~"${escapedNeedle}",i];`).join('');
      const overpassQuery = `[out:json][timeout:10];(${clauses});out center tags 30;`;
      try {
        const response = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'SpaceNovaX-Orbit/1.0 (contact: business@spacenovax.com)',
          },
          body: new URLSearchParams({ data: overpassQuery }).toString(),
          signal: AbortSignal.timeout(12_000),
        });
        if (!response.ok) throw new Error(`Overpass responded ${response.status}`);
        const payload = await response.json();
        return (payload.elements || []).slice(0, 30);
      } catch (error) {
        // An optional POI fallback must never make normal address search fail.
        console.warn('Orbit map POI search unavailable', error.message);
        return [];
      }
    };
    const mapPoiItems = (items?.length || 0) < 12 ? await searchNearbyMapPois() : [];

    const seen = new Set();
    const radians = (value) => value * Math.PI / 180;
    const distanceFromNearby = (lat, lon) => {
      if (!nearbyValid) return null;
      const a = Math.sin(radians(lat - nearLatitude) / 2) ** 2
        + Math.cos(radians(nearLatitude)) * Math.cos(radians(lat))
        * Math.sin(radians(lon - nearLongitude) / 2) ** 2;
      return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
    };
    const results = (items || []).map((item) => {
      const names = item.namedetails || {};
      const localName = names[`name:${language}`] || names[`name:${language.split('-')[0]}`] || names.name || '';
      const displayParts = String(item.display_name || '').split(',');
      if (localName && displayParts.length) displayParts[0] = localName;
      const lat = Number(item.lat);
      const lon = Number(item.lon);
      const address = item.address || {};
      const addressLine = [
        address.road && address.house_number ? `${address.road} ${address.house_number}` : address.road,
        address.neighbourhood || address.suburb || address.village || address.town || address.city || address.county,
        address.state,
        address.postcode,
      ].filter(Boolean).join(', ');
      const category = item.category || '';
      const type = item.type || category || 'place';
      return {
        id: String(item.place_id),
        label: displayParts.join(',').trim(),
        address: addressLine || displayParts.slice(1).join(',').trim(),
        lat,
        lon,
        country: address.country || '',
        type,
        category,
        distanceM: distanceFromNearby(lat, lon),
      };
    }).filter((place) => Number.isFinite(place.lat) && Number.isFinite(place.lon)
      && place.label && !seen.has(place.id) && (seen.add(place.id) || true)).slice(0, 20);
    const kakaoResults = kakaoItems.map(({ source, document }) => {
      const lat = Number(document.y);
      const lon = Number(document.x);
      const roadAddress = document.road_address?.address_name || '';
      const address = roadAddress || document.address_name || '';
      const label = source === 'keyword'
        ? (document.place_name || document.address_name || '')
        : (document.road_address?.building_name || document.address_name || '');
      return {
        id: 'kakao:' + source + ':' + (document.id || lat.toFixed(6) + ',' + lon.toFixed(6)),
        label: String(label).trim(),
        address,
        lat,
        lon,
        country: '대한민국',
        type: source === 'keyword' ? (document.category_group_name || 'place') : 'address',
        category: source === 'keyword' ? (document.category_group_name || 'place') : 'address',
        distanceM: distanceFromNearby(lat, lon),
      };
    }).filter((place) => Number.isFinite(place.lat) && Number.isFinite(place.lon) && place.label);
    const googleResults = googlePlaceItems.map((item) => {
      const lat = Number(item.location?.latitude);
      const lon = Number(item.location?.longitude);
      return {
        id: 'google:' + (item.id || lat.toFixed(6) + ',' + lon.toFixed(6)),
        label: String(item.displayName?.text || item.formattedAddress || '').trim(),
        address: String(item.formattedAddress || '').trim(),
        lat,
        lon,
        country: '',
        type: String(item.types?.[0] || 'place'),
        category: String(item.types?.[0] || 'place'),
        distanceM: distanceFromNearby(lat, lon),
      };
    }).filter((place) => Number.isFinite(place.lat) && Number.isFinite(place.lon) && place.label);
    const poiResults = mapPoiItems.map((item) => {
      const tags = item.tags || {};
      const lat = Number(item.lat ?? item.center?.lat);
      const lon = Number(item.lon ?? item.center?.lon);
      const label = tags[`name:${language}`] || tags[`name:${language.split('-')[0]}`] || tags['name:ko'] || tags.name || tags.alt_name || '';
      const address = [
        tags['addr:street'] && tags['addr:housenumber'] ? `${tags['addr:street']} ${tags['addr:housenumber']}` : tags['addr:street'],
        tags['addr:suburb'] || tags['addr:district'] || tags['addr:city'],
        tags['addr:postcode'],
      ].filter(Boolean).join(', ');
      const category = tags.amenity || tags.shop || tags.tourism || tags.office || tags.building || 'place';
      return {
        id: `osm:${item.type}:${item.id}`,
        label: String(label).trim(),
        address,
        lat,
        lon,
        country: tags['addr:country'] || '',
        type: category,
        category,
        distanceM: distanceFromNearby(lat, lon),
      };
    }).filter((place) => Number.isFinite(place.lat) && Number.isFinite(place.lon) && place.label);

    const mergedSeen = new Set();
    const normalizedQuery = compactQuery.toLocaleLowerCase();
    const mergedResults = [...kakaoResults, ...googleResults, ...poiResults, ...results].filter((place) => {
      const placeKey = `${String(place.label).toLocaleLowerCase()}:${place.lat.toFixed(4)}:${place.lon.toFixed(4)}`;
      if (mergedSeen.has(placeKey)) return false;
      mergedSeen.add(placeKey);
      return true;
    }).sort((a, b) => {
      const aName = String(a.label).replace(/\s+/g, '').toLocaleLowerCase();
      const bName = String(b.label).replace(/\s+/g, '').toLocaleLowerCase();
      const score = (name) => (name === normalizedQuery ? 0 : name.includes(normalizedQuery) ? 1 : 2);
      return score(aName) - score(bName)
        || Number(a.distanceM ?? Number.MAX_SAFE_INTEGER) - Number(b.distanceM ?? Number.MAX_SAFE_INTEGER);
    }).slice(0, 20);

    const providers = { kakao: kakaoProvider };
    geocodeCache.set(key, { at: now(), value: mergedResults, providers });
    return res.json({ ok: true, results: mergedResults, providers, cached: false });
  } catch (error) {
    console.error('Orbit geocode failed', error.message);
    return res.status(502).json({ ok: false, message: 'Destination search temporarily unavailable.', results: [] });
  }
});


// Nearby-place discovery for a selected neighborhood/address. This is intentionally
// an on-demand, cached request: it returns a small list of public OSM essentials,
// not a tracking feed and not a proprietary map-data replacement.
const nearbyPlaceCache = new Map();
const NEARBY_PLACE_CACHE_MS = 10 * 60 * 1000;
app.get('/api/orbit/nearby-places', async (req, res) => {
  const latitude = Number(req.query.lat);
  const longitude = Number(req.query.lon);
  const language = String(req.query.lang || 'en').toLowerCase().replace(/[^a-z-]/g, '').slice(0, 5) || 'en';
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return res.status(400).json({ ok: false, message: 'Valid coordinates are required.' });
  }
  const cacheKey = `${latitude.toFixed(3)},${longitude.toFixed(3)}:${language}`;
  const cached = nearbyPlaceCache.get(cacheKey);
  if (cached && now() - cached.at < NEARBY_PLACE_CACHE_MS) return res.json({ ok: true, places: cached.value, cached: true });
  try {
    const query = `[out:json][timeout:12];(nwr(around:5000,${latitude.toFixed(5)},${longitude.toFixed(5)})[amenity~"^(hospital|clinic|pharmacy|fuel|police|parking|bus_station|bank)$"];nwr(around:5000,${latitude.toFixed(5)},${longitude.toFixed(5)})[tourism~"^(attraction|museum|hotel)$"];nwr(around:5000,${latitude.toFixed(5)},${longitude.toFixed(5)})[shop~"^(supermarket|convenience)$"];);out center tags 36;`;
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'SpaceNovaX-Orbit/1.0 (contact: business@spacenovax.com)' },
      body: new URLSearchParams({ data: query }).toString(),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Overpass responded ${response.status}`);
    const payload = await response.json();
    const radians = (value) => value * Math.PI / 180;
    const kmFrom = (lat, lon) => {
      const a = Math.sin(radians(lat - latitude) / 2) ** 2 + Math.cos(radians(latitude)) * Math.cos(radians(lat)) * Math.sin(radians(lon - longitude) / 2) ** 2;
      return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };
    const kind = (tags = {}) => tags.amenity || tags.tourism || tags.shop || 'place';
    const iconByKind = { hospital: '✚', clinic: '✚', pharmacy: '✚', fuel: '⛽', police: '⚑', parking: 'P', bus_station: '▣', bank: '¤', attraction: '★', museum: '★', hotel: '⌂', supermarket: '▤', convenience: '▤' };
    const seen = new Set();
    const places = (payload.elements || []).map((item) => {
      const lat = Number(item.lat ?? item.center?.lat);
      const lon = Number(item.lon ?? item.center?.lon);
      const tags = item.tags || {};
      const localName = tags[`name:${language}`] || tags[`name:${language.split('-')[0]}`] || tags.name || '';
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || !localName) return null;
      const type = kind(tags);
      const key = `${localName}:${lat.toFixed(4)}:${lon.toFixed(4)}`;
      if (seen.has(key)) return null;
      seen.add(key);
      return { id: `nearby-${item.type}-${item.id}`, label: localName, subtitle: [tags['addr:street'], tags['addr:city']].filter(Boolean).join(', '), lat, lon, type, icon: iconByKind[type] || '⌖', distanceKm: kmFrom(lat, lon) };
    }).filter(Boolean).sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 12);
    nearbyPlaceCache.set(cacheKey, { at: now(), value: places });
    while (nearbyPlaceCache.size > 120) nearbyPlaceCache.delete(nearbyPlaceCache.keys().next().value);
    return res.json({ ok: true, places, cached: false });
  } catch (error) {
    console.error('Orbit nearby-place discovery failed', error.message);
    return res.status(502).json({ ok: false, message: 'Nearby places are temporarily unavailable.', places: [] });
  }
});

// Driving route proxy for Earth Navigation. The browser never calls a routing host
// directly: requests are validated, cached, and reduced to the route data the UI uses.
const ORBIT_ROUTE_CACHE_MS = 45 * 1000;
const orbitRouteCache = new Map();
const GOOGLE_ROUTES_API_KEY = String(process.env.GOOGLE_ROUTES_API_KEY || '').trim();

// A captain can flag a bad road or unsafe turn without contributing a precise
// movement history. Reports are for later map-quality review; they never alter
// an active route automatically and are deliberately rate-limited.
app.post('/api/orbit/navigation-report', (req, res) => {
  const data = readData();
  const user = getSessionUser(req, data);
  if (!requireVerifiedCaptain(user, res)) return;
  const category = String(req.body?.category || 'other');
  const allowedCategories = new Set(['missing_road', 'wrong_route', 'road_blocked', 'unsafe', 'other']);
  if (!allowedCategories.has(category)) return res.status(400).json({ ok: false, message: 'Invalid map report category.' });
  const latitude = Number(req.body?.location?.lat);
  const longitude = Number(req.body?.location?.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return res.status(400).json({ ok: false, message: 'A valid approximate location is required.' });
  }
  const recentReports = (data.navigationReports || []).filter((report) => report.userId === user.id && Number(report.createdAt || 0) > now() - 24 * 60 * 60 * 1000);
  if (recentReports.length >= NAVIGATION_REPORT_DAILY_LIMIT) {
    return res.status(429).json({ ok: false, message: 'You have reached today’s map report limit. Thank you for helping improve navigation.' });
  }
  const location = { lat: Number(latitude.toFixed(3)), lon: Number(longitude.toFixed(3)) };
  const duplicate = recentReports.some((report) => report.category === category
    && report.location?.lat === location.lat && report.location?.lon === location.lon
    && Number(report.createdAt || 0) > now() - 6 * 60 * 60 * 1000);
  if (duplicate) return res.status(409).json({ ok: false, message: 'This map issue was already reported recently from this approximate area.' });
  const note = String(req.body?.note || '').replace(/\s+/g, ' ').trim().slice(0, 300);
  const destinationLabel = String(req.body?.destination?.label || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  const report = {
    id: crypto.randomUUID(),
    userId: user.id,
    category,
    note,
    destinationLabel,
    // 3 decimal degrees is roughly a 100m area. Do not retain raw phone GPS.
    location,
    status: 'pending',
    createdAt: now(),
  };
  data.navigationReports.push(report);
  data.events.push({ type: 'orbit_navigation_report', userId: user.id, reportId: report.id, category, at: report.createdAt });
  writeData(data);
  res.status(201).json({ ok: true, status: report.status, reportId: report.id, message: 'Map report received. Your exact GPS location was not stored.' });
});

// Admin review keeps navigation reports advisory. A report can never modify a route,
// map tile, or traffic claim directly; a verified administrator records every review.
app.get('/api/admin/navigation-reports', requireAdmin, (req, res) => {
  const data = readData();
  const requestedStatus = String(req.query.status || '');
  const allowedStatuses = new Set(['pending', 'in_review', 'resolved', 'dismissed']);
  if (requestedStatus && !allowedStatuses.has(requestedStatus)) return res.status(400).json({ ok: false, message: 'Invalid report status.' });
  const reports = (data.navigationReports || [])
    .filter((report) => !requestedStatus || report.status === requestedStatus)
    .slice()
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
    .slice(0, 250)
    .map(({ userId, ...report }) => ({ ...report, reporter: userId ? 'verified_captain' : 'unknown' }));
  res.json({ ok: true, reports });
});

app.post('/api/admin/navigation-reports/review', requireAdmin, (req, res) => {
  const data = readData();
  const report = (data.navigationReports || []).find((item) => item.id === String(req.body?.reportId || ''));
  const status = String(req.body?.status || '');
  const allowedStatuses = new Set(['in_review', 'resolved', 'dismissed']);
  if (!report || !allowedStatuses.has(status)) return res.status(400).json({ ok: false, message: 'Invalid navigation report review.' });
  const reviewNote = String(req.body?.reviewNote || '').replace(/\s+/g, ' ').trim().slice(0, 300);
  report.status = status;
  report.reviewedAt = now();
  report.reviewedBy = req.admin.id;
  report.reviewNote = reviewNote;
  data.events.push({ type: 'admin_navigation_report_review', adminId: req.admin.id, reportId: report.id, status, at: report.reviewedAt });
  writeData(data);
  res.json({ ok: true, report: { id: report.id, status: report.status, reviewedAt: report.reviewedAt } });
});

function decodeGooglePolyline(encoded = '') {
  const points = []; let index = 0; let lat = 0; let lon = 0;
  while (index < encoded.length) {
    let shift = 0; let result = 0; let byte;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20 && index <= encoded.length);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20 && index <= encoded.length);
    lon += (result & 1) ? ~(result >> 1) : (result >> 1);
    points.push({ lat: lat / 1e5, lon: lon / 1e5 });
  }
  return points;
}

async function fetchGoogleDrivingRoute({ fromLat, fromLon, toLat, toLon, mode, language }) {
  const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_ROUTES_API_KEY,
      'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.travelAdvisory.tollInfo,routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration,routes.legs.steps.navigationInstruction,routes.legs.steps.polyline.encodedPolyline',
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: fromLat, longitude: fromLon } } },
      destination: { location: { latLng: { latitude: toLat, longitude: toLon } } },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE',
      languageCode: language,
      routeModifiers: { avoidTolls: mode === 'free' },
      extraComputations: ['TOLLS'],
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Google Routes responded ${response.status}`);
  const source = (await response.json()).routes?.[0];
  if (!source?.polyline?.encodedPolyline || !Number.isFinite(source.distanceMeters)) throw new Error('Google Routes returned no drivable route');
  const parseDuration = (value) => Math.round(Number(String(value || '0s').replace('s', '')) || 0);
  const steps = (source.legs || []).flatMap((leg) => leg.steps || []).slice(0, 80).map((step) => ({
    name: String(step.navigationInstruction?.instructions || '').slice(0, 100),
    distanceM: Math.round(Number(step.distanceMeters) || 0),
    durationSec: parseDuration(step.staticDuration),
    lanes: [],
    maneuver: { type: 'continue', modifier: '', location: null },
  }));
  const prices = (source.travelAdvisory?.tollInfo?.estimatedPrice || []).map((price) => ({
    currency: String(price.currencyCode || ''),
    amount: Number(price.units || 0) + Number(price.nanos || 0) / 1e9,
  })).filter((price) => price.currency && Number.isFinite(price.amount));
  return {
    distanceM: Math.round(source.distanceMeters),
    durationSec: parseDuration(source.duration),
    points: decodeGooglePolyline(source.polyline.encodedPolyline),
    steps,
    toll: { available: true, prices },
    provider: 'google-routes',
  };
}

app.get('/api/orbit/route', async (req, res) => {
  const fromLat = Number(req.query.fromLat); const fromLon = Number(req.query.fromLon);
  const toLat = Number(req.query.toLat); const toLon = Number(req.query.toLon);
  const fresh = req.query.fresh === '1';
  const mode = ['recommended', 'toll', 'free'].includes(String(req.query.mode || '')) ? String(req.query.mode) : 'recommended';
  const language = String(req.query.lang || 'en').replace(/[^a-z-]/gi, '').slice(0, 5) || 'en';
  const coordinates = [fromLat, fromLon, toLat, toLon];
  if (!coordinates.every(Number.isFinite) || Math.abs(fromLat) > 90 || Math.abs(toLat) > 90 || Math.abs(fromLon) > 180 || Math.abs(toLon) > 180) return res.status(400).json({ ok: false, message: 'Invalid route coordinates.' });
  const key = `${mode}:${fromLat.toFixed(3)},${fromLon.toFixed(3)}:${toLat.toFixed(3)},${toLon.toFixed(3)}`;
  const cached = orbitRouteCache.get(key);
  if (!fresh && cached && now() - cached.at < ORBIT_ROUTE_CACHE_MS) return res.json({ ok: true, route: cached.value, cached: true });
  try {
    if (mode !== 'recommended') {
      if (!GOOGLE_ROUTES_API_KEY) {
        return res.status(409).json({ ok: false, code: 'TOLL_PROVIDER_UNAVAILABLE', message: 'Toll and toll-free routing needs verified road-pricing data. Use the recommended route until Google Routes is connected.' });
      }
      const route = await fetchGoogleDrivingRoute({ fromLat, fromLon, toLat, toLon, mode, language });
      if (route.points.length < 2) throw new Error('Google Routes geometry unavailable');
      orbitRouteCache.set(key, { at: now(), value: route }); if (orbitRouteCache.size > 160) orbitRouteCache.delete(orbitRouteCache.keys().next().value);
      return res.json({ ok: true, route, cached: false });
    }
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLon},${fromLat};${toLon},${toLat}?overview=full&geometries=geojson&steps=true&alternatives=false`;
    const response = await fetch(url, { headers: { 'User-Agent': 'SpaceNovaX-Orbit/1.0 (public driving route relay)' }, signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`OSRM responded ${response.status}`);
    const source = (await response.json()).routes?.[0];
    if (!source || !Number.isFinite(source.distance) || !Number.isFinite(source.duration)) throw new Error('No drivable route found');
    const rawPoints = source.geometry?.coordinates || [];
    // Keep enough geometry for a phone GPS to be matched to the correct road
    // segment. The previous 220-point cap made a dense city turn look like a
    // straight shortcut and produced false off-route events.
    const stride = Math.max(1, Math.ceil(rawPoints.length / 720));
    const points = rawPoints.filter((_, index) => index % stride === 0 || index === rawPoints.length - 1).map(([lon, lat]) => ({ lat: Number(lat), lon: Number(lon) })).filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon));
    if (points.length < 2) throw new Error('Route geometry unavailable');
    const pointDistances = [0];
    for (let index = 1; index < points.length; index++) {
      const a = points[index - 1], b = points[index], latDelta = (b.lat - a.lat) * Math.PI / 180, lonDelta = (b.lon - a.lon) * Math.PI / 180;
      const h = Math.sin(latDelta / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(lonDelta / 2) ** 2;
      pointDistances[index] = pointDistances[index - 1] + 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    }
    const routeGeometryDistanceM = pointDistances[pointDistances.length - 1] || 1;
    const routeProgressAt = (lat, lon) => {
      let nearest = 0, nearestDistance = Infinity;
      points.forEach((point, index) => {
        const dLat = point.lat - lat, dLon = point.lon - lon;
        const squared = dLat * dLat + dLon * dLon;
        if (squared < nearestDistance) { nearestDistance = squared; nearest = index; }
      });
      return { progress: pointDistances[nearest] / routeGeometryDistanceM, distanceFromStartM: pointDistances[nearest] };
    };
    const steps = (source.legs || []).flatMap((leg) => leg.steps || []).slice(0, 80).map((step, index) => {
      const maneuverLocation = Array.isArray(step.maneuver?.location) ? step.maneuver.location : [];
      const maneuverLon = Number(maneuverLocation[0]); const maneuverLat = Number(maneuverLocation[1]);
      const validManeuver = Number.isFinite(maneuverLat) && Number.isFinite(maneuverLon);
      const laneSet = (step.intersections || []).find((intersection) => Array.isArray(intersection.lanes) && intersection.lanes.length)?.lanes || [];
      const lanes = laneSet.slice(0, 8).map((lane) => ({ indications: Array.isArray(lane.indications) ? lane.indications.map(String).slice(0, 3) : [], valid: lane.valid === true }));
      return {
        index,
        routeProgress: validManeuver ? routeProgressAt(maneuverLat, maneuverLon).progress : 1,
        distanceFromStartM: validManeuver ? Math.round(routeProgressAt(maneuverLat, maneuverLon).distanceFromStartM) : Math.round(routeGeometryDistanceM),
        name: String(step.name || '').slice(0, 100),
        distanceM: Math.round(Number(step.distance) || 0),
        durationSec: Math.round(Number(step.duration) || 0),
        lanes,
        maneuver: {
          type: String(step.maneuver?.type || 'continue').slice(0, 32),
          modifier: String(step.maneuver?.modifier || '').slice(0, 32),
          lat: validManeuver ? maneuverLat : null,
          lon: validManeuver ? maneuverLon : null,
          location: validManeuver ? { lat: maneuverLat, lon: maneuverLon } : null,
        },
      };
    });
    const route = { distanceM: Math.round(source.distance), durationSec: Math.round(source.duration), points, steps };
    orbitRouteCache.set(key, { at: now(), value: route }); if (orbitRouteCache.size > 160) orbitRouteCache.delete(orbitRouteCache.keys().next().value);
    return res.json({ ok: true, route, cached: false });
  } catch (error) { console.error('Orbit driving route failed', error.message); return res.status(502).json({ ok: false, message: 'Driving route temporarily unavailable.' }); }
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

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

// This route deliberately does not mutate referral data. Link crawlers from
// KakaoTalk/Telegram must never count as people. The recipient is linked only
// after opening the signed Telegram start link and creating a new account.
app.get('/brand/spacenovax-symbol.jpg', (req, res) => {
  const encoded = fs.readFileSync(path.join(__dirname, 'brand-symbol.base64'), 'utf8').trim();
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.type('jpeg').send(Buffer.from(encoded, 'base64'));
});

app.get('/spacenovax-referral-card.jpg', (req, res) => {
  const encoded = fs.readFileSync(path.join(__dirname, 'referral-card.base64'), 'utf8').trim();
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.type('jpeg').send(Buffer.from(encoded, 'base64'));
});

app.get('/join/:code', (req, res) => {
  const code = String(req.params.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 32);
  const data = readData();
  const referrer = code ? findUserByReferralCode(data, code) : null;
  if (!referrer) return res.status(404).send('SpaceNovaX invitation not found.');
  const inviter = escapeHtml(referrer.firstName || 'a SpaceNovaX Captain');
  const shareUrl = publicReferralLink(code);
  const telegramUrl = telegramReferralLink(code);
  const imageUrl = `${PUBLIC_APP_ORIGIN}/spacenovax-referral-card.jpg?v=${encodeURIComponent(REFERRAL_SHARE_VERSION)}`;
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.type('html').send(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SpaceNovaX Fleet Invitation</title><meta name="description" content="${inviter} Captain invites you to explore, earn and build beyond with SpaceNovaX.">
<meta property="og:type" content="website"><meta property="og:site_name" content="SpaceNovaX"><meta property="og:title" content="🚀 Join SpaceNovaX Fleet"><meta property="og:description" content="Mine • Play • Explore with NOVA AI&#10;Build your Fleet and earn SPNX Points."><meta property="og:url" content="${shareUrl}"><meta property="og:image" content="${imageUrl}"><meta property="og:image:type" content="image/jpeg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="SpaceNovaX — Explore, Earn, Beyond">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="🚀 Join SpaceNovaX Fleet"><meta name="twitter:description" content="Mine • Play • Explore with NOVA AI — Build your Fleet and earn SPNX Points."><meta name="twitter:image" content="${imageUrl}">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#020714;color:#eff8ff;font:16px system-ui,-apple-system,sans-serif}.card{width:min(92vw,460px);padding:30px;border:1px solid #19d6ff;border-radius:24px;background:#071426;box-shadow:0 0 42px #0aa8e855;text-align:center}.brand{color:#21d6ff;letter-spacing:.16em;font-weight:800}.code{font-size:30px;font-weight:900;letter-spacing:.1em}.open{display:block;margin:24px 0 8px;padding:16px;border-radius:14px;background:linear-gradient(100deg,#1674ff,#19d6ff);color:white;text-decoration:none;font-weight:800}</style></head><body><main class="card"><p class="brand">SPACENOVAX</p><h1>${inviter} Captain’s Fleet</h1><p>Explore · Earn · Beyond</p><p class="code">${code}</p><a class="open" href="${telegramUrl}">Open SpaceNovaX</a><small>Referral is recorded only after a new Captain opens the official app.</small></main></body></html>`);
});

app.use(express.static(distPath));

app.use((req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

await initializeStateStorage();

const server = app.listen(PORT, () => {
  console.log(`SpaceNovaX V15 Command Network running on port ${PORT}`);
  const payoutTimer = setInterval(runAutomaticPayoutWorker, 30_000);
  payoutTimer.unref();
  setTimeout(runAutomaticPayoutWorker, 5_000).unref();
  const nodeMonitorTimer = setInterval(monitorCommunityNodeOfflineStates, 30_000);
  nodeMonitorTimer.unref();
});

async function shutdown(signal) {
  console.log(`${signal} received; draining persistent state.`);
  server.close(async () => {
    try {
      await databaseWriteQueue;
      await databasePool?.end();
      process.exit(0);
    } catch (error) {
      console.error('Graceful shutdown failed', error);
      process.exit(1);
    }
  });
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
