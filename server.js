import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'spacenovax-data.json');

const MINING_DURATION = 24 * 60 * 60 * 1000;
const BASE_MINING_REWARD = 24;

const DEFAULT_MISSIONS = [
  { id: 'website', title: 'Visit SpaceNovaX Website', icon: '🌐', reward: 100, type: 'one-time', url: 'https://spacenovax.com', enabled: true },
  { id: 'telegram', title: 'Join Telegram', icon: '✈️', reward: 300, type: 'one-time', url: 'https://t.me/', enabled: true },
  { id: 'discord', title: 'Join Discord', icon: '💬', reward: 300, type: 'one-time', url: 'https://discord.com/', enabled: true },
  { id: 'x_follow', title: 'Follow X', icon: '𝕏', reward: 300, type: 'one-time', url: 'https://x.com/', enabled: true },
  { id: 'youtube_sub', title: 'Subscribe YouTube', icon: '📺', reward: 300, type: 'one-time', url: 'https://youtube.com/', enabled: true },
  { id: 'youtube_like', title: 'YouTube Like', icon: '👍', reward: 100, type: 'one-time', url: 'https://youtube.com/', enabled: true },
  { id: 'daily_checkin', title: 'Daily Check-in', icon: '🎁', reward: 20, type: 'daily', url: '', enabled: true }
];

function now() {
  return Date.now();
}

function readData() {
  if (!fs.existsSync(DATA_FILE)) {
    const initial = {
      users: {},
      events: [],
      missions: DEFAULT_MISSIONS,
      settings: {
        convertEnabled: false,
        pointToTokenRate: 1,
        minConvert: 5000,
        fleetMaxBonus: 20,
        activeFleetDays: 7,
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
  data.missions ||= DEFAULT_MISSIONS;
  data.settings ||= {};

  data.missions ||= [];
  const officialMissionsV73 = [
    { id: 'website', icon: '🌐', title: 'Visit SpaceNovaX Website', type: 'one_time', reward: 100, url: 'https://spacenovax.com', action: 'OPEN', enabled: true },
    { id: 'telegram', icon: '📢', title: 'Join Telegram', type: 'one_time', reward: 300, url: 'https://t.me/spacesnovax', action: 'JOIN', enabled: true },
    { id: 'discord', icon: '💬', title: 'Join Discord', type: 'one_time', reward: 300, url: 'https://discord.gg/rxVNWMC8e8', action: 'JOIN', enabled: true },
    { id: 'x', icon: '𝕏', title: 'Follow X', type: 'one_time', reward: 300, url: 'https://x.com/spacenovaxteam', action: 'FOLLOW', enabled: true },
    { id: 'youtube_subscribe', icon: '▶️', title: 'Subscribe YouTube', type: 'one_time', reward: 300, url: 'https://youtube.com/@spacenovaxteam', action: 'SUBSCRIBE', enabled: true },
    { id: 'youtube_like', icon: '👍', title: 'YouTube Like', type: 'one_time', reward: 100, url: 'https://youtube.com/@spacenovaxteam', action: 'LIKE', enabled: true },
    { id: 'daily_checkin', icon: '🎁', title: 'Daily Check-in', type: 'daily', reward: 20, url: '', action: 'CHECK-IN', enabled: true }
  ];
  const missionMapV73 = Object.fromEntries((data.missions || []).map((m) => [m.id, m]));
  data.missions = officialMissionsV73.map((m) => ({
    ...m,
    ...(missionMapV73[m.id] || {}),
    url: missionMapV73[m.id]?.url || m.url,
    reward: Number(missionMapV73[m.id]?.reward ?? m.reward),
    enabled: missionMapV73[m.id]?.enabled ?? m.enabled
  }));


  data.missions ||= [];
  const officialMissions = [
    { id: 'website', icon: '🌐', title: 'Visit SpaceNovaX Website', type: 'one_time', reward: 100, url: 'https://spacenovax.com', action: 'OPEN', enabled: true },
    { id: 'telegram', icon: '📢', title: 'Join Telegram', type: 'one_time', reward: 300, url: 'https://t.me/spacesnovax', action: 'JOIN', enabled: true },
    { id: 'discord', icon: '💬', title: 'Join Discord', type: 'one_time', reward: 300, url: 'https://discord.gg/rxVNWMC8e8', action: 'JOIN', enabled: true },
    { id: 'x', icon: '𝕏', title: 'Follow X', type: 'one_time', reward: 300, url: 'https://x.com/spacenovaxteam', action: 'FOLLOW', enabled: true },
    { id: 'youtube_subscribe', icon: '▶️', title: 'Subscribe YouTube', type: 'one_time', reward: 300, url: 'https://youtube.com/@spacenovaxteam', action: 'SUBSCRIBE', enabled: true },
    { id: 'youtube_like', icon: '👍', title: 'YouTube Like', type: 'one_time', reward: 100, url: 'https://youtube.com/@spacenovaxteam', action: 'LIKE', enabled: true },
    { id: 'daily_checkin', icon: '🎁', title: 'Daily Check-in', type: 'daily', reward: 20, url: '', action: 'CHECK-IN', enabled: true }
  ];
  const existingMissions = Object.fromEntries((data.missions || []).map((m) => [m.id, m]));
  data.missions = officialMissions.map((m) => ({ ...m, ...(existingMissions[m.id] || {}), url: existingMissions[m.id]?.url || m.url, reward: Number(existingMissions[m.id]?.reward ?? m.reward), enabled: existingMissions[m.id]?.enabled ?? m.enabled }));

  data.settings.miningSandboxEnabled ??= false;
  data.settings.miningSandboxMinutes ??= 5;
  data.settings.eventMultiplier ??= 1;
  data.settings.miningEngineVersion ??= '1.0.0';
  data.convertRequests ||= [];
  data.distributions ||= [];
  return data;
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function makeGuestUser() {
  return {
    id: `guest-${crypto.randomBytes(4).toString('hex')}`,
    telegramId: null,
    username: 'guest',
    firstName: 'Space Explorer',
    lastName: '',
    isGuest: true
  };
}

function normalizeTelegramUser(raw) {
  if (!raw?.id) return makeGuestUser();
  return {
    id: `tg-${raw.id}`,
    telegramId: String(raw.id),
    username: raw.username || '',
    firstName: raw.first_name || raw.firstName || 'Space Explorer',
    lastName: raw.last_name || '',
    isGuest: false
  };
}

function fleetBonusPercent(activeFleet) {
  return Math.max(0, Math.min(100, Number(activeFleet || 0)));
}

function fleetGrade(activeFleet) {
  if (activeFleet >= 100) return 'Diamond Fleet';
  if (activeFleet >= 50) return 'Gold Fleet';
  if (activeFleet >= 30) return 'Silver Fleet';
  if (activeFleet >= 10) return 'Bronze Fleet';
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
    const referrer = referralCode && data.users[referralCode] ? referralCode : null;
    data.users[userId] = {
      ...tUser,
      balance: 15250,
      totalMined: 0,
      exp: 850,
      level: 7,
      rankTitle: 'Captain',
      mining: null,
      missions: {},
      referredBy: referrer,
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
  const fleetBonus = fleetBonusPercent(activeFleet);
  const eventMultiplier = Number(data.settings?.eventMultiplier || 1);
  const duration = getMiningDuration(data);
  const basePerHour = phase.reward / 24;
  const finalPerHour = basePerHour * (1 + fleetBonus / 100) * eventMultiplier;
  return { basePerHour, finalPerHour: Number(finalPerHour.toFixed(8)), fleetBonus, activeFleet, phase: phase.phase, eventMultiplier, duration };
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
    return { active: false, reward, baseReward: miningPhase(data).reward, speedPerHour: speed.finalPerHour, baseSpeedPerHour: speed.basePerHour, fleetBonus: speed.fleetBonus, activeFleet: speed.activeFleet, phase: speed.phase, eventMultiplier: speed.eventMultiplier, durationMs: duration, remainingMs: duration, progress: 0, minedSoFar: 0, claimable: false, sandbox: Boolean(data.settings?.miningSandboxEnabled), engineVersion: data.settings?.miningEngineVersion || '1.0.0' };
  }
  const startedAt = Number(user.mining.startedAt || now());
  const endsAt = startedAt + duration;
  const remainingMs = Math.max(0, endsAt - now());
  const progress = Math.min(1, Math.max(0, (now() - startedAt) / duration));
  const minedSoFar = Number((reward * progress).toFixed(8));
  return { active: remainingMs > 0, startedAt, endsAt, remainingMs, progress, minedSoFar, reward, baseReward: miningPhase(data).reward, speedPerHour: speed.finalPerHour, baseSpeedPerHour: speed.basePerHour, fleetBonus: speed.fleetBonus, activeFleet: speed.activeFleet, phase: speed.phase, eventMultiplier: speed.eventMultiplier, durationMs: duration, claimable: remainingMs <= 0, sandbox: Boolean(data.settings?.miningSandboxEnabled), engineVersion: data.settings?.miningEngineVersion || '1.0.0' };
}

function publicUser(data, user) {
  const activeFleet = getActiveFleetCount(data, user.id);
  const bonus = fleetBonusPercent(activeFleet);

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
    referredBy: user.referredBy,
    referrals: user.referrals || [],
    activeFleet,
    fleetBonus: bonus,
    fleetGrade: fleetGrade(activeFleet),
    mining: calculateMining(data, user),
    solanaWallet: user.solanaWallet || ''
  };
}

function getSessionUser(req, data) {
  const user = ensureUser(data, req.body?.telegramUser, req.body?.ref || req.query?.ref || '');
  return user;
}

app.use(express.json({ limit: '2mb' }));

const ADMIN_ID = process.env.ADMIN_ID || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
const ADMIN_TOKEN_SECRET = process.env.JWT_SECRET || 'spacenovax-local-secret-change-on-render';
const ADMIN_SESSION_MS = 12 * 60 * 60 * 1000;

function signAdminToken(payload) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + ADMIN_SESSION_MS })).toString('base64url');
  const sig = crypto.createHmac('sha256', ADMIN_TOKEN_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyAdminToken(token = '') {
  const [body, sig] = String(token).split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', ADMIN_TOKEN_SECRET).update(body).digest('base64url');
  if (sig !== expected) return null;
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

app.post('/api/mining/start', (req, res) => {
  const data = readData();
  const user = getSessionUser(req, data);
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
  const status = calculateMining(data, user);

  if (user.banned) return res.status(403).json({ ok: false, message: 'Account is restricted.' });

  if (!status.claimable) {
    return res.status(400).json({ ok: false, message: 'Mining is not ready to claim yet.' });
  }

  const amount = Number(status.reward || 0);
  user.balance = Number(user.balance || 0) + amount;
  user.totalMined = Number(user.totalMined || 0) + amount;
  user.mining = null;
  user.lastMiningAt = now();
  user.updatedAt = now();

  data.events.push({ type: 'mining_claim', userId: user.id, amount, phase: status.phase, fleetBonus: status.fleetBonus, engineVersion: status.engineVersion, sandbox: status.sandbox, at: now() });
  writeData(data);

  res.json({ ok: true, message: `Claimed ${amount} SPNX Point.`, user: publicUser(data, user) });
});

app.get('/api/missions', (req, res) => {
  const data = readData();
  res.json({ ok: true, missions: data.missions.filter((m) => m.enabled !== false) });
});

app.post('/api/missions/claim', (req, res) => {
  const data = readData();
  const user = getSessionUser(req, data);
  const missionId = req.body?.missionId;
  const mission = data.missions.find((m) => m.id === missionId && m.enabled !== false);

  if (!mission) return res.status(404).json({ ok: false, message: 'Mission not found.' });

  user.missions ||= {};
  const record = user.missions[missionId];

  if (mission.type === 'one-time' && record?.claimed) {
    return res.status(400).json({ ok: false, message: 'Already claimed.' });
  }

  if (mission.type === 'daily' && record?.claimedAt && now() - record.claimedAt < 24 * 60 * 60 * 1000) {
    return res.status(400).json({ ok: false, message: 'Daily reward already claimed.' });
  }

  user.balance = Number(user.balance || 0) + Number(mission.reward || 0);
  user.missions[missionId] = { claimed: true, claimedAt: now(), reward: mission.reward };
  user.updatedAt = now();

  data.events.push({ type: 'mission_claim', userId: user.id, missionId, amount: mission.reward, at: now() });
  writeData(data);

  res.json({ ok: true, message: `${mission.reward} SPNX Point claimed.`, user: publicUser(data, user) });
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

app.post('/api/wallet/save', (req, res) => {
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

  const data = readData();
  if (id !== ADMIN_ID || password !== ADMIN_PASSWORD) {
    data.events.push({ type: 'admin_login_failed', id, at: now() });
    writeData(data);
    return res.status(401).json({ ok: false, message: 'Invalid admin ID or password' });
  }

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

  user.balance = Number(user.balance || 0) + amount;
  user.updatedAt = now();
  data.events.push({ type: 'admin_points', adminId: req.admin?.id || 'admin', userId, amount, reason, at: now() });
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
  if (req.body?.balance !== undefined) user.balance = Number(req.body.balance);
  if (req.body?.solanaWallet !== undefined) user.solanaWallet = String(req.body.solanaWallet || '').trim();
  if (req.body?.banned !== undefined) user.banned = Boolean(req.body.banned);
  user.updatedAt = now();
  data.events.push({ type: 'admin_user_update', adminId: req.admin.id, userId, at: now() });
  writeData(data);
  res.json({ ok: true, user: publicAdminUser(data, user) });
});

app.post('/api/admin/kyc/update', requireAdmin, (req, res) => {
  const data = readData();
  const userId = String(req.body?.userId || '');
  const status = String(req.body?.status || '');
  const note = String(req.body?.note || '');
  const user = data.users?.[userId];
  if (!user) return res.status(404).json({ ok: false, message: 'User not found' });
  if (!['not_submitted','pending','approved','rejected'].includes(status)) return res.status(400).json({ ok: false, message: 'Invalid KYC status' });
  user.kyc = { status, note, reviewedBy: req.admin.id, reviewedAt: now() };
  user.updatedAt = now();
  data.events.push({ type: 'admin_kyc_update', adminId: req.admin.id, userId, status, note, at: now() });
  writeData(data);
  res.json({ ok: true, user: publicAdminUser(data, user) });
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


app.post('/api/convert/request', (req, res) => {
  const data = readData();
  const user = getSessionUser(req, data);
  const amount = Number(req.body?.amount || 0);
  if (!data.settings?.convertEnabled) return res.status(400).json({ ok: false, message: 'Convert is not active before listing.' });
  if (!user.solanaWallet) return res.status(400).json({ ok: false, message: 'Solana wallet required.' });
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ ok: false, message: 'Invalid amount.' });
  if (amount < Number(data.settings?.minConvert || 5000)) return res.status(400).json({ ok: false, message: 'Minimum convert amount not reached.' });
  if (amount > Number(user.balance || 0)) return res.status(400).json({ ok: false, message: 'Insufficient SPNX Point.' });
  data.convertRequests ||= [];
  const request = { id: `cv-${crypto.randomBytes(6).toString('hex')}`, userId: user.id, amount, wallet: user.solanaWallet, status: 'pending', createdAt: now(), updatedAt: now() };
  data.convertRequests.push(request);
  data.events.push({ type: 'convert_request', userId: user.id, amount, at: now() });
  writeData(data);
  res.json({ ok: true, request });
});

app.get('/api/admin/settings', requireAdmin, (req, res) => {
  const data = readData();
  res.json({ ok: true, settings: data.settings || {} });
});

app.post('/api/admin/settings/update', requireAdmin, (req, res) => {
  const data = readData();
  data.settings ||= {};
  ['convertEnabled','minConvert','pointToTokenRate','fleetMaxBonus','activeFleetDays'].forEach((key) => {
    if (req.body?.[key] !== undefined) data.settings[key] = req.body[key];
  });
  data.events.push({ type: 'admin_settings_update', adminId: req.admin.id, settings: data.settings, at: now() });
  writeData(data);
  res.json({ ok: true, settings: data.settings });
});

app.get('/api/admin/convert-queue', requireAdmin, (req, res) => {
  const data = readData();
  const queue = (data.convertRequests || []).map((request) => ({ ...request, user: data.users?.[request.userId] ? publicAdminUser(data, data.users[request.userId]) : null })).reverse();
  res.json({ ok: true, queue });
});

app.post('/api/admin/convert/update', requireAdmin, (req, res) => {
  const data = readData();
  const id = String(req.body?.id || '');
  const status = String(req.body?.status || '');
  const txHash = String(req.body?.txHash || '').trim();
  const request = (data.convertRequests || []).find((r) => r.id === id);
  if (!request) return res.status(404).json({ ok: false, message: 'Convert request not found' });
  if (!['approved','rejected','completed','failed'].includes(status)) return res.status(400).json({ ok: false, message: 'Invalid status' });
  const user = data.users?.[request.userId];
  if (!user) return res.status(404).json({ ok: false, message: 'User not found' });
  if (status === 'completed' && request.status !== 'completed') {
    if (Number(user.balance || 0) < Number(request.amount || 0)) return res.status(400).json({ ok: false, message: 'User balance is lower than request amount' });
    user.balance = Number(user.balance || 0) - Number(request.amount || 0);
    user.updatedAt = now();
  }
  request.status = status;
  request.txHash = txHash || request.txHash || '';
  request.updatedAt = now();
  request.reviewedBy = req.admin.id;
  data.events.push({ type: 'admin_convert_update', adminId: req.admin.id, requestId: id, userId: request.userId, status, amount: request.amount, at: now() });
  writeData(data);
  res.json({ ok: true, request, user: publicAdminUser(data, user) });
});

app.get('/api/admin/distribution-simulator', requireAdmin, (req, res) => {
  const data = readData();
  const pending = (data.convertRequests || []).filter((r) => r.status === 'approved' || r.status === 'pending');
  const totalAmount = pending.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  res.json({ ok: true, simulator: { recipients: pending.length, totalAmount, estimatedSolFee: Number((pending.length * 0.000005).toFixed(6)), mode: data.settings?.convertEnabled ? 'convert_enabled' : 'convert_disabled', note: 'Simulator only. No real Solana transfer yet.' } });
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
  if (req.body?.reward !== undefined) mission.reward = Number(req.body.reward);
  if (req.body?.enabled !== undefined) mission.enabled = Boolean(req.body.enabled);
  if (req.body?.title !== undefined) mission.title = String(req.body.title);
  if (req.body?.url !== undefined) mission.url = String(req.body.url);
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

const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

app.use((req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`SpaceNovaX V7.2 One-Time Mission Links running on port ${PORT}`);
});
