import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const distPath = path.join(__dirname, 'dist');
const indexPath = path.join(distPath, 'index.html');
const dataPath = path.join(__dirname, 'server', 'data.json');

const MINING_DURATION_MS = 24 * 60 * 60 * 1000;
const BASE_DAILY_REWARD = 30;

app.use(express.json({ limit: '1mb' }));

function loadData() {
  if (!fs.existsSync(dataPath)) {
    return { users: {}, events: [] };
  }

  try {
    return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  } catch {
    return { users: {}, events: [] };
  }
}

function saveData(data) {
  fs.mkdirSync(path.dirname(dataPath), { recursive: true });
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

function makeGuest() {
  return {
    id: 'guest_' + crypto.randomBytes(6).toString('hex'),
    firstName: 'Space Explorer',
    username: 'guest',
    photoUrl: '',
    isGuest: true,
  };
}

function normalizeTelegramUser(body = {}) {
  const tg = body.telegramUser || body.user || {};
  const id = String(tg.id || body.userId || '').trim();

  if (!id) return makeGuest();

  return {
    id,
    firstName: tg.first_name || tg.firstName || 'Space Explorer',
    lastName: tg.last_name || tg.lastName || '',
    username: tg.username || '',
    photoUrl: tg.photo_url || tg.photoUrl || '',
    isGuest: false,
  };
}

function ensureUser(data, profile) {
  const now = Date.now();
  const existing = data.users[profile.id];

  if (!existing) {
    data.users[profile.id] = {
      id: profile.id,
      firstName: profile.firstName,
      lastName: profile.lastName || '',
      username: profile.username || '',
      photoUrl: profile.photoUrl || '',
      isGuest: profile.isGuest,
      balance: 15250,
      totalMined: 0,
      level: 7,
      exp: 850,
      miners: 86,
      power: 2.8,
      speed: 1.25,
      mining: {
        active: false,
        startedAt: null,
        endsAt: null,
        claimedAt: null,
        pendingReward: 0
      },
      createdAt: now,
      updatedAt: now
    };
  } else {
    existing.firstName = profile.firstName || existing.firstName;
    existing.lastName = profile.lastName || existing.lastName || '';
    existing.username = profile.username || existing.username || '';
    existing.photoUrl = profile.photoUrl || existing.photoUrl || '';
    existing.updatedAt = now;
  }

  return data.users[profile.id];
}

function calculateMining(user) {
  const now = Date.now();
  const mining = user.mining || {};

  if (!mining.active || !mining.startedAt || !mining.endsAt) {
    return {
      active: false,
      progress: 0,
      remainingMs: 0,
      minedSoFar: 0,
      claimable: false,
      reward: BASE_DAILY_REWARD,
    };
  }

  const duration = mining.endsAt - mining.startedAt;
  const elapsed = Math.max(0, Math.min(now - mining.startedAt, duration));
  const progress = duration > 0 ? elapsed / duration : 0;
  const reward = mining.pendingReward || BASE_DAILY_REWARD;
  const minedSoFar = reward * progress;
  const remainingMs = Math.max(0, mining.endsAt - now);
  const claimable = now >= mining.endsAt;

  return {
    active: true,
    progress,
    remainingMs,
    minedSoFar,
    claimable,
    reward,
  };
}

function publicUser(user) {
  return {
    id: user.id,
    firstName: user.firstName,
    username: user.username,
    photoUrl: user.photoUrl,
    isGuest: user.isGuest,
    balance: user.balance,
    totalMined: user.totalMined,
    level: user.level,
    exp: user.exp,
    miners: user.miners,
    power: user.power,
    speed: user.speed,
    mining: calculateMining(user),
  };
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, project: 'SpaceNovaX V3.1 Working Tabs', version: '3.1.0' });
});

app.post('/api/session', (req, res) => {
  const data = loadData();
  const profile = normalizeTelegramUser(req.body);
  const user = ensureUser(data, profile);

  data.events.push({ type: 'session', userId: user.id, at: Date.now() });
  saveData(data);

  res.json({ ok: true, user: publicUser(user) });
});

app.post('/api/mining/start', (req, res) => {
  const data = loadData();
  const profile = normalizeTelegramUser(req.body);
  const user = ensureUser(data, profile);
  const status = calculateMining(user);

  if (status.active && !status.claimable) {
    saveData(data);
    return res.json({ ok: true, user: publicUser(user), message: 'Mining already active' });
  }

  const reward = BASE_DAILY_REWARD * user.speed;
  user.mining = {
    active: true,
    startedAt: Date.now(),
    endsAt: Date.now() + MINING_DURATION_MS,
    claimedAt: null,
    pendingReward: reward
  };
  user.updatedAt = Date.now();

  data.events.push({ type: 'mining_start', userId: user.id, reward, at: Date.now() });
  saveData(data);

  res.json({ ok: true, user: publicUser(user), message: 'Mining started' });
});

app.post('/api/mining/claim', (req, res) => {
  const data = loadData();
  const profile = normalizeTelegramUser(req.body);
  const user = ensureUser(data, profile);
  const status = calculateMining(user);

  if (!status.active) {
    saveData(data);
    return res.status(400).json({ ok: false, message: 'No active mining session' });
  }

  if (!status.claimable) {
    saveData(data);
    return res.status(400).json({ ok: false, message: 'Mining is not finished yet', user: publicUser(user) });
  }

  user.balance += status.reward;
  user.totalMined += status.reward;
  user.exp = Math.min(1000, user.exp + 15);
  user.mining = {
    active: false,
    startedAt: null,
    endsAt: null,
    claimedAt: Date.now(),
    pendingReward: 0
  };
  user.updatedAt = Date.now();

  data.events.push({ type: 'mining_claim', userId: user.id, reward: status.reward, at: Date.now() });
  saveData(data);

  res.json({ ok: true, user: publicUser(user), message: `Claimed ${status.reward.toFixed(6)} SPNX` });
});

app.get('/api/leaderboard', (req, res) => {
  const data = loadData();
  const users = Object.values(data.users)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 30)
    .map((u, index) => ({
      rank: index + 1,
      firstName: u.firstName,
      username: u.username,
      balance: u.balance,
      totalMined: u.totalMined
    }));

  res.json({ ok: true, users });
});

app.use(express.static(distPath));

app.use((req, res) => {
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(500).send('Build not found. Run npm run build first.');
  }
});

app.listen(PORT, () => {
  console.log(`SpaceNovaX V3.1 Working Tabs running on port ${PORT}`);
});
