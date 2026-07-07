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

const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

app.use((req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`SpaceNovaX V6.2 Users KYC Risk Center running on port ${PORT}`);
});
