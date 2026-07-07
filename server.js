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
const BASE_MINING_REWARD = 30;

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
  if (activeFleet >= 100) return 20;
  if (activeFleet >= 50) return 15;
  if (activeFleet >= 30) return 10;
  if (activeFleet >= 20) return 8;
  if (activeFleet >= 10) return 5;
  if (activeFleet >= 5) return 3;
  if (activeFleet >= 1) return 1;
  return 0;
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
  const used = Object.values(data.users).reduce((sum, user) => sum + Number(user.totalMined || 0), 0);
  const pool = data.settings?.miningPool || 3500000000;
  const ratio = pool > 0 ? used / pool : 0;

  if (ratio >= 0.8) return { phase: 5, reward: 6, used, pool, ratio };
  if (ratio >= 0.6) return { phase: 4, reward: 12, used, pool, ratio };
  if (ratio >= 0.4) return { phase: 3, reward: 18, used, pool, ratio };
  if (ratio >= 0.2) return { phase: 2, reward: 24, used, pool, ratio };
  return { phase: 1, reward: BASE_MINING_REWARD, used, pool, ratio };
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

function calculateMining(data, user) {
  const phase = miningPhase(data);
  const activeFleet = getActiveFleetCount(data, user.id);
  const bonus = fleetBonusPercent(activeFleet);
  const reward = Number((phase.reward * (1 + bonus / 100)).toFixed(6));

  if (!user.mining?.active) {
    return { active: false, reward, baseReward: phase.reward, fleetBonus: bonus, activeFleet, phase: phase.phase, remainingMs: MINING_DURATION, progress: 0, minedSoFar: 0, claimable: false };
  }

  const startedAt = user.mining.startedAt;
  const endsAt = startedAt + MINING_DURATION;
  const remainingMs = Math.max(0, endsAt - now());
  const progress = Math.min(1, Math.max(0, (now() - startedAt) / MINING_DURATION));
  const minedSoFar = Number((reward * progress).toFixed(6));

  return {
    active: remainingMs > 0,
    startedAt,
    endsAt,
    remainingMs,
    progress,
    minedSoFar,
    reward,
    baseReward: phase.reward,
    fleetBonus: bonus,
    activeFleet,
    phase: phase.phase,
    claimable: remainingMs <= 0
  };
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

  user.mining = { active: true, startedAt: now() };
  user.lastMiningAt = now();
  data.events.push({ type: 'mining_start', userId: user.id, at: now() });
  writeData(data);

  res.json({ ok: true, message: 'Mining started.', user: publicUser(data, user) });
});

app.post('/api/mining/claim', (req, res) => {
  const data = readData();
  const user = getSessionUser(req, data);
  const status = calculateMining(data, user);

  if (!status.claimable) {
    return res.status(400).json({ ok: false, message: 'Mining is not ready to claim yet.' });
  }

  const amount = Number(status.reward || 0);
  user.balance = Number(user.balance || 0) + amount;
  user.totalMined = Number(user.totalMined || 0) + amount;
  user.mining = null;
  user.lastMiningAt = now();
  user.updatedAt = now();

  data.events.push({ type: 'mining_claim', userId: user.id, amount, at: now() });
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

app.get('/api/admin/stats', (req, res) => {
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

app.get('/api/admin/users', (req, res) => {
  const data = readData();
  const users = Object.values(data.users || {})
    .sort((a, b) => Number(b.balance || 0) - Number(a.balance || 0))
    .slice(0, 200)
    .map((user) => publicUser(data, user));
  res.json({ ok: true, users });
});

app.get('/api/admin/missions', (req, res) => {
  const data = readData();
  res.json({ ok: true, missions: data.missions });
});

app.post('/api/admin/points', (req, res) => {
  const data = readData();
  const userId = String(req.body?.userId || '');
  const amount = Number(req.body?.amount || 0);
  const reason = req.body?.reason || 'manual';

  if (!userId || !Number.isFinite(amount)) return res.status(400).json({ ok: false, message: 'userId and amount are required' });

  const user = data.users?.[userId];
  if (!user) return res.status(404).json({ ok: false, message: 'User not found' });

  user.balance = Number(user.balance || 0) + amount;
  user.updatedAt = now();
  data.events.push({ type: 'admin_points', userId, amount, reason, at: now() });
  writeData(data);

  res.json({ ok: true, user: publicUser(data, user) });
});

const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

app.use((req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`SpaceNovaX V6 Mission Fleet DB running on port ${PORT}`);
});
