import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './styles/global.css';

const OFFICIAL_LINKS = {
  website: 'https://spacenovax.com',
  telegram: 'https://t.me/spacenovaxteam',
  x: 'https://x.com/spacenovaxteam',
  discord: 'https://discord.gg/rxVNWMC8e8',
  youtube: 'https://youtube.com/@spacenovaxteam',
};

const MISSIONS = [
  { id: 'website', icon: '🌐', title: 'Website', reward: 100, url: OFFICIAL_LINKS.website, action: 'OPEN', type: 'one_time' },
  { id: 'telegram', icon: '📢', title: 'Telegram', reward: 300, url: OFFICIAL_LINKS.telegram, action: 'JOIN', type: 'one_time' },
  { id: 'x', icon: '𝕏', title: 'X Twitter', reward: 300, url: OFFICIAL_LINKS.x, action: 'FOLLOW', type: 'one_time' },
  { id: 'discord', icon: '💬', title: 'Discord', reward: 300, url: OFFICIAL_LINKS.discord, action: 'JOIN', type: 'one_time' },
  { id: 'youtube_subscribe', icon: '▶️', title: 'YouTube Subscribe', reward: 300, url: OFFICIAL_LINKS.youtube, action: 'SUBSCRIBE', type: 'one_time' },
  { id: 'youtube_like', icon: '👍', title: 'YouTube Like', reward: 20, url: OFFICIAL_LINKS.youtube, action: 'LIKE', type: 'one_time' },
  { id: 'daily_checkin', icon: '🎁', title: 'Daily Check-in', reward: 20, url: '', action: 'CHECK-IN', type: 'daily' },
];

function fmt(v, d = 2) {
  return Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: 6 });
}
function time(ms) {
  const t = Math.max(0, Math.floor(Number(ms || 0) / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return [h, m, s].map((x) => String(x).padStart(2, '0')).join(':');
}
function defaultUser() {
  return {
    id: 'guest-captain',
    firstName: 'Space Explorer',
    level: 7,
    exp: 850,
    balance: 15250,
    referrals: [],
    activeFleet: 0,
    fleetBonus: 0,
    solanaWallet: '',
    kyc: { status: 'not_submitted' },
    gameReward: { date: new Date().toISOString().slice(0, 10), earnedToday: 0, bestScore: 0 },
    mining: { active: false, claimable: false, phase: 1, reward: 24, speedPerHour: 1, fleetBonus: 0, remainingMs: 86400000, durationMs: 86400000, progress: 0, minedSoFar: 0 },
    missionClaims: {},
  };
}
function refCode(user) {
  return (user?.id || 'guest-captain').replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase() || 'SPNX2026';
}

function getCaptainCode(user) {
  const n = Math.abs(String(user?.id || 'guest-captain').split('').reduce((a, c) => a + c.charCodeAt(0), 0));
  return `#${String(n % 999999).padStart(6, '0')}`;
}

function getRank(level = 1) {
  if (level >= 70) return { emoji: '👑', title: 'Galactic Legend', className: 'rank-legend', ship: 'Nova-X1 Genesis', sector: 'Andromeda' };
  if (level >= 60) return { emoji: '💎', title: 'Admiral', className: 'rank-admiral', ship: 'Nova-X1 Admiral', sector: 'Nebula-X' };
  if (level >= 50) return { emoji: '🔴', title: 'Commander', className: 'rank-commander', ship: 'Nova-X1 Commander', sector: 'Alpha Centauri' };
  if (level >= 40) return { emoji: '🟣', title: 'Explorer', className: 'rank-explorer', ship: 'Nova-X1 Titan', sector: 'Jupiter Station' };
  if (level >= 30) return { emoji: '🔷', title: 'Pioneer', className: 'rank-pioneer', ship: 'Nova-X1 Falcon', sector: 'Mars Colony' };
  if (level >= 20) return { emoji: '🟡', title: 'Voyager', className: 'rank-voyager', ship: 'Nova-X1 Voyager', sector: 'Moon Base' };
  if (level >= 10) return { emoji: '⚪', title: 'Cadet', className: 'rank-cadet', ship: 'Nova-X1 Scout', sector: 'Earth Orbit' };
  return { emoji: '🥉', title: 'Rookie', className: 'rank-rookie', ship: 'Nova-X1 Basic', sector: 'Earth Orbit' };
}

function openUrl(url) {
  if (!url) return;
  const tg = window.Telegram?.WebApp;
  if (tg?.openLink) tg.openLink(url);
  else window.open(url, '_blank', 'noopener,noreferrer');
}
async function api(path, options = {}) {
  const res = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.message || 'API failed');
  return data;
}

function SymbolLogo() {
  return (
    <div className="symbol-logo">
      <img src="/spacenovax-symbol.jpg" alt="SpaceNovaX" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
      <span>X</span>
    </div>
  );
}

function StarField({ count = 260, className = '' }) {
  const stars = useMemo(() => Array.from({ length: count }, (_, i) => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 0.35 + Math.random() * (i % 12 === 0 ? 2.9 : 1.55),
    delay: Math.random() * 8,
    dur: 2.2 + Math.random() * 6.2,
    alpha: 0.18 + Math.random() * 0.82,
    tint: Math.random() > 0.88 ? 'cyan' : Math.random() > 0.76 ? 'violet' : 'white',
    layer: i % 3,
  })), [count]);
  return <div className={`star-layer ${className}`}>{stars.map((s, i) => <i key={i} className={`${s.tint} l${s.layer}`} style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.size, height: s.size, animationDelay: `${s.delay}s`, animationDuration: `${s.dur}s`, opacity: s.alpha }} />)}</div>;
}

function AppHeader({ user }) {
  const rank = getRank(user?.level || 1);
  return (
    <header className="app-header v13-header">
      <SymbolLogo />
      <div>
        <h1>SpaceNovaX</h1>
        <p>Explore. Mine. Evolve.</p>
      </div>
      <div className={`phase-pill ${rank.className}`}>{rank.emoji} {rank.title}</div>
    </header>
  );
}

function CinematicShip({ active = false, game = false }) {
  return (
    <div className={game ? 'ship-wrap game-ship' : 'ship-wrap'}>
      <img src="/nova-x1-cinematic.svg" alt="Nova-X1" />
      <div className="ship-aura" />
      <div className="ship-flare" />
      {active && (
        <>
          <span className="point-pop p1">+0.000032</span>
          <span className="point-pop p2">+0.000041</span>
          <span className="point-pop p3">+0.000028</span>
        </>
      )}
    </div>
  );
}

function LaunchCountdown({ user }) {
  const rank = getRank(user?.level || 1);
  return (
    <div className="launch-card premium-card v13-launch">
      <span>🚀 Official Launch</span>
      <b>Coming Soon</b>
      <small>Captain {getCaptainCode(user)} · {rank.sector} · 1 Point = 1 SPNX during official conversion</small>
    </div>
  );
}

function HomePage({ user, startMining, claimMining, loading }) {
  const m = user.mining || {};
  const isMining = Boolean(m.active);
  const canClaim = Boolean(m.claimable);
  return (
    <section className="page">
      <div className={`profile-card premium-card ${getRank(user.level || 1).className}`}>
        <div className="rank-badge">{getRank(user.level || 1).emoji}</div>
        <div>
          <b>Captain {getCaptainCode(user)}</b>
          <span>Lv.{user.level || 7} · {getRank(user.level || 1).title} · {getRank(user.level || 1).ship}</span>
        </div>
        <div className="exp-bar"><small>Experience</small><em><i /></em></div>
      </div>
      <LaunchCountdown user={user} />
      <div className="hero-cinema home-ultimate">
        <span className="space-weather" />
        <span className="cosmic-dust dust-one" />
        <span className="cosmic-dust dust-two" />
        <span className="tiny-galaxy" />
        <StarField count={180} />
        <span className="meteor meteor-one" />
        <span className="meteor meteor-two" />
        <span className="meteor meteor-three" />
        <span className="meteor meteor-four" />
        <span className="meteor meteor-five" />
        <span className="meteor meteor-six" />
        <span className="nebula n1" />
        <span className="planet planet-one" />
        <span className="planet planet-two" />
        <div className="system-online-chip">🟢 SYSTEM ONLINE</div>
        <div className="ai-home-bubble">🤖 Every Captain has a story</div>
        <div className="balance-block">
          <small>TOTAL BALANCE</small>
          <strong>{fmt(user.balance)}</strong>
          <h2>SPNX Points</h2>
          <p>Nova-X1 Cinematic Class</p>
        </div>
        <CinematicShip active={isMining} />
        <div className="mining-glass">
          <div className="mining-main"><span>⛏️</span><div><small>Today's Mining</small><b>+{fmt(m.reward || 24)}</b><em>SPNX</em></div></div>
          <div className="mining-time"><small>{canClaim ? 'Claim Ready' : isMining ? 'Next Claim' : 'Ready'}</small><b>{canClaim ? '00:00:00' : time(m.remainingMs || 86400000)}</b></div>
          <button disabled={loading || isMining} className={canClaim ? 'ready' : ''} onClick={canClaim ? claimMining : startMining}>{canClaim ? '🎁 CLAIM' : isMining ? 'MINING...' : '🚀 START MINING'}</button>
        </div>
        <div className="stat-strip">
          <div><small>Mining Speed</small><b>{fmt(m.speedPerHour || 1, 2)}x</b></div>
          <div><small>Fleet Bonus</small><b>+{m.fleetBonus || 0}%</b></div>
          <div><small>Game Reward</small><b>20/day</b></div>
        </div>
      </div>
    </section>
  );
}

function MiningPage({ user, startMining, claimMining, loading }) {
  const m = user.mining || {};
  const progress = Math.round((m.progress || 0) * 100);
  return (
    <section className="page premium-card content-card">
      <h2>⛏️ Expedition Mining</h2>
      <p>Server-based 24h mining · Nova-X1 = 24 SPNX / day</p>
      <div className="progress"><span><i style={{ width: `${progress}%` }} /></span><b>{progress}%</b></div>
      <div className="grid">
        <div><small>Remaining</small><b>{time(m.remainingMs || 86400000)}</b></div>
        <div><small>Earned</small><b>{fmt(m.minedSoFar || 0)}</b></div>
        <div><small>Cycle Reward</small><b>{fmt(m.reward || 24)}</b></div>
        <div><small>Speed</small><b>{fmt(m.speedPerHour || 1, 2)} SPNX/h</b></div>
      </div>
      <div className="two-buttons">
        <button disabled={loading || m.active || m.claimable} onClick={startMining}>🚀 START</button>
        <button disabled={loading || !m.claimable} onClick={claimMining}>🎁 CLAIM</button>
      </div>
    </section>
  );
}

function MissionsPage({ setUser }) {
  const [missions, setMissions] = useState(MISSIONS.map((m) => ({ ...m, status: { completed: false } })));
  const [notice, setNotice] = useState('Official missions (Website, Telegram, X, Discord, YouTube Subscribe, YouTube Like +20) are rewarded ONLY ONCE per account for lifetime.');
  const [busy, setBusy] = useState('');
  const completed = missions.filter((m) => m.status?.completed).length;
  const progress = Math.round((completed / Math.max(1, missions.length)) * 100);

  async function load() {
    try { const data = await api('/api/missions'); setMissions(data.missions || missions); } catch {}
  }
  useEffect(() => { load(); }, []);

  async function claim(mission) {
    if (mission.status?.completed || busy) return;
    setBusy(mission.id);
    openUrl(mission.url);
    setTimeout(async () => {
      try {
        const data = await api('/api/missions/claim', { method: 'POST', body: JSON.stringify({ missionId: mission.id }) });
        setNotice(`✨ Mission Complete: +${data.reward} SPNX`);
        if (data.user) setUser(data.user);
        await load();
      } catch (e) { setNotice(e.message); } finally { setBusy(''); }
    }, mission.url ? 650 : 0);
  }

  return (
    <section className="page premium-card content-card mission-page">
      <h2>⭐ Space Missions</h2>
      <p>{notice}</p>
      <div className="mission-progress">
        <div><b>{completed}/{missions.length}</b><span>Completed</span></div>
        <em><i style={{ width: `${progress}%` }} /></em>
      </div>
      {missions.map((m) => (
        <button key={m.id} className={m.status?.completed ? 'mission-row done' : 'mission-row'} disabled={m.status?.completed || busy === m.id} onClick={() => claim(m)}>
          <span><strong>{m.icon}</strong><i>{m.title}<small>{m.type === 'daily' ? 'Daily reward' : 'Lifetime one-time reward'}</small></i></span>
          <em>{m.status?.completed ? (m.type === 'daily' ? 'Claimed Today' : 'Completed') : busy === m.id ? 'Checking...' : m.action}</em>
          <b>+{m.reward} SPNX</b>
        </button>
      ))}
    </section>
  );
}

function FriendsPage({ user }) {
  const code = refCode(user);
  const link = `https://t.me/SpaceNovaXBot?start=${code}`;
  async function copy() { try { await navigator.clipboard.writeText(link); alert('Invite link copied'); } catch { alert(link); } }
  function share() {
    const text = `🚀 Join SpaceNovaX\nMine SPNX Points every day.\n${link}`;
    if (navigator.share) navigator.share({ title: 'SpaceNovaX', text, url: link }); else copy();
  }
  return (
    <section className="page premium-card content-card">
      <h2>👥 Fleet Command</h2><p>Your referral link automatically registers new captains into your Fleet.</p>
      <div className="invite-box"><small>Your Fleet Code</small><b>{code}</b><input readOnly value={link} /><div className="two-buttons"><button onClick={copy}>📋 Copy</button><button onClick={share}>📤 Share</button></div></div>
      <div className="grid"><div><small>Total Invites</small><b>{user.referrals?.length || 0}</b></div><div><small>Active Fleet</small><b>{user.activeFleet || 0}</b></div><div><small>Fleet Bonus</small><b>+{user.fleetBonus || 0}%</b></div><div><small>Fleet Rank</small><b>Captain</b></div></div>
    </section>
  );
}

function RankingPage({ user }) {
  return (
    <section className="page premium-card content-card">
      <h2>🏆 Galaxy Rank</h2><p>Mining, Fleet and Game rankings.</p>
      <div className="ranking-tabs"><span>Mining</span><span>Fleet</span><span>Game</span></div>
      {[user, { firstName: 'Nova Pilot', balance: 9800 }, { firstName: 'Mars Captain', balance: 7600 }].map((u, i) => <div className="rank-row" key={i}><b>#{i + 1}</b><span>{u.firstName}</span><strong>{fmt(u.balance)}</strong></div>)}
    </section>
  );
}

function WalletPage({ user, setUser }) {
  const [wallet, setWallet] = useState(user.solanaWallet || '');
  const [notice, setNotice] = useState('상장 후 공식 교환 기간에 1 SPNX Point = 1 SPNX 비율로 전환 신청할 수 있습니다.');
  const [saving, setSaving] = useState(false);
  const clean = wallet.trim();
  const valid = clean.length >= 32 && clean.length <= 48;
  const balance = Number(user.balance || 0);
  async function save() {
    if (!valid) { setNotice('Solana 지갑 주소는 보통 32~48자입니다. 주소를 다시 확인해 주세요.'); return; }
    setSaving(true);
    try { const data = await api('/api/wallet/save', { method: 'POST', body: JSON.stringify({ wallet: clean }) }); setUser(data.user || { ...user, solanaWallet: clean }); setNotice('Solana 지갑이 등록되었습니다.'); } catch (e) { setNotice(e.message); } finally { setSaving(false); }
  }
  async function requestConversion() {
    try { const data = await api('/api/conversion/request', { method: 'POST', body: JSON.stringify({ amount: balance }) }); setNotice(`교환 신청 완료: ${fmt(data.request.amount)} SPNX · KYC/관리자 검토 대기`); } catch (e) { setNotice(e.message); }
  }
  return (
    <section className="page premium-card content-card wallet-page">
      <h2>👛 Space Vault</h2><p>{notice}</p>
      <div className="grid conversion-grid"><div><small>Current Point</small><b>{fmt(balance)}</b></div><div><small>Rate</small><b>1:1</b></div><div><small>You Receive</small><b>{fmt(balance)} SPNX</b></div></div>
      <div className="panel"><h3>🔗 Solana Wallet Registration</h3><p>Phantom 또는 Solflare 지갑의 Solana 주소를 등록하세요.</p><input className="input" placeholder="Solana wallet address" value={wallet} onChange={(e) => setWallet(e.target.value)} /><div className={clean ? (valid ? 'status ok' : 'status warn') : 'status'}>{clean ? (valid ? '✅ Address format looks valid' : '⚠️ Address length looks unusual') : '등록된 지갑이 없습니다.'}</div><button className="wide" onClick={save} disabled={saving}>{saving ? 'Saving...' : user.solanaWallet ? 'Update Wallet' : 'Save Wallet'}</button></div>
      <div className="panel"><h3>🔄 Token Conversion Policy</h3><p>상장 후 공식 교환 기간에 1 SPNX Point = 1 SPNX로 교환됩니다. KYC 및 보안 검토 후 관리자 승인 필요.</p><button className="wide" onClick={requestConversion}>Request Conversion</button></div>
    </section>
  );
}

function KycPage({ user, setUser }) {
  const [form, setForm] = useState({ name: '', country: '', note: '' });
  const [notice, setNotice] = useState('Token conversion requires KYC/security review.');
  async function submit() {
    try { const data = await api('/api/kyc/submit', { method: 'POST', body: JSON.stringify(form) }); if (data.user) setUser(data.user); setNotice('KYC submitted. 관리자 검토 대기 중입니다.'); } catch (e) { setNotice(e.message); }
  }
  return (
    <section className="page premium-card content-card"><h2>🛡️ KYC Center</h2><p>{notice}</p><div className="grid"><div><small>Status</small><b>{user.kyc?.status || 'not_submitted'}</b></div><div><small>Purpose</small><b>Conversion</b></div></div><input className="input" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><input className="input" placeholder="Country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /><input className="input" placeholder="Note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /><button className="wide" onClick={submit}>Submit KYC</button></section>
  );
}




function createSPNXArcadeSounds() {
  let ctx = null;
  const get = () => {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
  const beep = (freq, dur = .1, type = 'sine') => {
    try {
      const a = get();
      const o = a.createOscillator();
      const g = a.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(.06, a.currentTime);
      g.gain.exponentialRampToValueAtTime(.0001, a.currentTime + dur);
      o.connect(g); g.connect(a.destination);
      o.start(); o.stop(a.currentTime + dur);
    } catch {}
  };
  return {
    start: () => { beep(320,.08); setTimeout(()=>beep(720,.1),80); },
    crystal: () => { beep(900,.06); setTimeout(()=>beep(1300,.08),50); },
    item: () => beep(650,.12,'triangle'),
    explosion: () => { beep(95,.22,'sawtooth'); setTimeout(()=>beep(55,.26,'square'),90); },
  };
}

function GalaxyLeaderboard({ currentScore = 0 }) {
  const championScore = 18560;
  const gap = Math.max(0, championScore - currentScore);
  return (
    <div className="galaxy-leaderboard">
      <div className="champion-banner">
        <span>🌌 Current Galaxy Champion</span>
        <b>👑 Captain Nova</b>
        <strong>{championScore.toLocaleString()}</strong>
      </div>
      <div className="my-rank-card">
        <span>🚀 My Arcade Rank</span>
        <b>{currentScore >= championScore ? '#1' : '#128'}</b>
        <small>{gap > 0 ? `${gap.toLocaleString()} points to Galaxy Champion` : 'You are today’s Galaxy Champion!'}</small>
      </div>
    </div>
  );
}

function GameOverOverlay({ result, onPlayAgain }) {
  if (!result?.over) return null;
  return (
    <div className="gameover-overlay">
      <div className="gameover-card">
        <span className="gameover-kicker">MISSION FAILED</span>
        <h2>💥 GAME OVER</h2>
        <p className="ai-fail">🤖 Every Captain falls... but every great Captain rises again.</p>
        <div className="gameover-stats">
          <div><small>Final Score</small><b>{Number(result.score || 0).toLocaleString()}</b></div>
          <div><small>Crystals</small><b>{Number(result.crystals || 0).toLocaleString()}</b></div>
          <div><small>Reward</small><b>+{Number(result.reward || 0)} SPNX</b></div>
          <div><small>Galaxy Rank</small><b>#{result.rank || 128}</b></div>
        </div>
        <button className="play-again-btn" onClick={onPlayAgain}>🚀 PLAY AGAIN</button>
      </div>
    </div>
  );
}

function NovaArcadeCanvas({ soundOn, onScore, onNotice, onGameOver, restartKey }) {
  const canvasRef = useRef(null);
  const cbRef = useRef({ onScore, onNotice, onGameOver });
  const soundRef = useRef(soundOn);
  const audioRef = useRef(null);

  useEffect(() => {
    cbRef.current = { onScore, onNotice, onGameOver };
    soundRef.current = soundOn;
  }, [onScore, onNotice, onGameOver, soundOn]);

  const play = useCallback((name) => {
    if (!soundRef.current) return;
    if (!audioRef.current) audioRef.current = createSPNXArcadeSounds();
    audioRef.current[name]?.();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let raf = 0;
    let stopped = false;

    const s = {
      score: 0, crystals: 0, shipX: .5, targetX: .5, frame: 0,
      dead: false, shield: false, objects: [], particles: [], stars: [],
      shake: 0, flash: 0, gameOverSent: false,
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      s.stars = Array.from({ length: 180 }, () => ({
        x: Math.random() * rect.width, y: Math.random() * rect.height,
        r: .5 + Math.random() * 1.8, v: .25 + Math.random() * .8,
        a: .25 + Math.random() * .75,
      }));
    };

    const burst = (x, y, color, n = 30) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 1 + Math.random() * 6;
        s.particles.push({ x, y, vx: Math.cos(a)*sp, vy: Math.sin(a)*sp, life: 40 + Math.random()*30, color });
      }
    };

    const spawn = (w) => {
      if (s.dead) return;
      const r = Math.random();
      const type = r < .55 ? 'crystal' : r < .82 ? 'asteroid' : r < .91 ? 'shield' : 'boost';
      s.objects.push({
        type, x: 30 + Math.random() * (w - 60), y: -40,
        r: type === 'asteroid' ? 22 + Math.random()*18 : 18,
        vy: type === 'asteroid' ? 2.0 + Math.random()*2.1 : 1.4 + Math.random()*1.5,
      });
    };

    const finish = (x, y) => {
      if (s.gameOverSent) return;
      s.gameOverSent = true;
      s.dead = true;
      s.objects = [];
      s.shake = 28;
      s.flash = 34;
      burst(x, y, '#ff4d6d', 90);
      burst(x, y, '#ffd66e', 55);
      play('explosion');
      if (navigator.vibrate) navigator.vibrate([100,40,150]);
      cbRef.current.onNotice?.('Mission failed, Captain. Prepare for another launch.');
      setTimeout(() => {
        if (stopped) return;
        cbRef.current.onGameOver?.({
          over: true,
          score: s.score,
          crystals: s.crystals,
          reward: Math.min(20, Math.floor(s.score/100)*5),
          rank: s.score >= 18560 ? 1 : 128,
        });
      }, 900);
    };

    const drawShip = (x, y) => {
      if (s.dead) return;
      ctx.save();
      ctx.translate(x, y);
      ctx.shadowColor = s.shield ? '#76faff' : '#34efff';
      ctx.shadowBlur = 28;
      ctx.font = '58px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('🚀', 0, 16);
      if (s.shield) {
        ctx.strokeStyle = 'rgba(118,250,255,.9)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, -5, 40, 0, Math.PI*2); ctx.stroke();
      }
      ctx.restore();
    };

    const loop = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width, h = rect.height;
      const t = s.frame++;
      if (s.shake > 0) s.shake *= .86;
      if (s.flash > 0) s.flash *= .88;

      ctx.save();
      ctx.translate(s.shake > .2 ? (Math.random()-.5)*s.shake : 0, s.shake > .2 ? (Math.random()-.5)*s.shake : 0);
      ctx.clearRect(-30,-30,w+60,h+60);

      const bg = ctx.createRadialGradient(w*.5,h*.35,10,w*.5,h*.5,h);
      bg.addColorStop(0,'#182c78'); bg.addColorStop(.45,'#070b24'); bg.addColorStop(1,'#01030c');
      ctx.fillStyle = bg; ctx.fillRect(-30,-30,w+60,h+60);

      s.stars.forEach(st => {
        st.y += st.v; if (st.y > h) { st.y = -4; st.x = Math.random()*w; }
        ctx.globalAlpha = st.a; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, Math.PI*2); ctx.fill();
      });
      ctx.globalAlpha = 1;

      if (!s.dead && t % 30 === 0) spawn(w);

      s.objects.forEach(o => {
        o.y += o.vy;
        ctx.save(); ctx.textAlign='center'; ctx.shadowBlur=18;
        if (o.type === 'asteroid') { ctx.shadowColor='#ff7a2f'; ctx.font=`${Math.floor(o.r*1.8)}px system-ui`; ctx.fillText('☄️',o.x,o.y+10); }
        else if (o.type === 'shield') { ctx.shadowColor='#76faff'; ctx.font='30px system-ui'; ctx.fillText('🛡',o.x,o.y+10); }
        else if (o.type === 'boost') { ctx.shadowColor='#ffd66e'; ctx.font='30px system-ui'; ctx.fillText('⚡',o.x,o.y+10); }
        else { ctx.shadowColor='#34efff'; ctx.font='30px system-ui'; ctx.fillText('💎',o.x,o.y+10); }
        ctx.restore();
      });

      if (!s.dead) s.shipX += (s.targetX - s.shipX) * .12;
      const shipX = w * s.shipX;
      const shipY = h - 92;
      drawShip(shipX, shipY);

      if (!s.dead) {
        for (const o of s.objects) {
          const dx = o.x - shipX, dy = o.y - shipY;
          if (Math.sqrt(dx*dx + dy*dy) < o.r + 24) {
            o.y = h + 999;

            if (o.type === 'asteroid') {
              if (s.shield) {
                s.shield = false; s.shake = 10; s.flash = 8;
                burst(o.x,o.y,'#76faff',35); play('item');
                cbRef.current.onNotice?.('Shield absorbed the impact.');
              } else {
                finish(shipX, shipY);
                break;
              }
            } else {
              if (o.type === 'crystal') { s.score += 10; s.crystals += 1; play('crystal'); burst(o.x,o.y,'#34efff',18); }
              if (o.type === 'boost') { s.score += 25; play('item'); burst(o.x,o.y,'#ffd66e',24); }
              if (o.type === 'shield') { s.score += 18; s.shield = true; play('item'); burst(o.x,o.y,'#76faff',24); }
              cbRef.current.onScore?.(s.score);
            }
          }
        }
      }

      s.objects = s.objects.filter(o => o.y < h + 80);
      s.particles.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vy += .04; p.life -= 1;
        ctx.globalAlpha = Math.max(0, p.life/70); ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x,p.y,2.5,0,Math.PI*2); ctx.fill();
      });
      s.particles = s.particles.filter(p => p.life > 0);
      ctx.globalAlpha = 1;

      ctx.fillStyle='rgba(2,5,20,.68)'; ctx.strokeStyle='rgba(52,239,255,.3)';
      ctx.beginPath(); ctx.roundRect(12,12,168,70,16); ctx.fill(); ctx.stroke();
      ctx.fillStyle='#34efff'; ctx.font='800 13px system-ui'; ctx.fillText('SCORE',28,35);
      ctx.fillStyle='#fff'; ctx.font='900 24px system-ui'; ctx.fillText(String(s.score),28,64);
      ctx.fillStyle=s.shield?'#76faff':'rgba(255,255,255,.45)'; ctx.font='800 12px system-ui'; ctx.fillText(s.shield?'SHIELD ON':'NO SHIELD',98,35);

      if (s.dead) { ctx.fillStyle='rgba(1,3,12,.35)'; ctx.fillRect(-30,-30,w+60,h+60); }
      if (s.flash > .2) { ctx.globalAlpha=Math.min(.38,s.flash/45); ctx.fillStyle='#ff2d55'; ctx.fillRect(-30,-30,w+60,h+60); ctx.globalAlpha=1; }

      ctx.restore();
      raf = requestAnimationFrame(loop);
    };

    resize();
    cbRef.current.onScore?.(0);
    play('start');

    const move = e => {
      if (s.dead) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.touches?.[0]?.clientX ?? e.clientX;
      s.targetX = Math.max(.08, Math.min(.92, (x - rect.left)/rect.width));
    };
    window.addEventListener('resize', resize);
    canvas.addEventListener('mousemove', move);
    canvas.addEventListener('touchstart', move, { passive:true });
    canvas.addEventListener('touchmove', move, { passive:true });
    raf = requestAnimationFrame(loop);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', move);
      canvas.removeEventListener('touchstart', move);
      canvas.removeEventListener('touchmove', move);
    };
  }, [restartKey, play]);

  return <canvas className="arcade-canvas" ref={canvasRef} />;
}

function GamePage({ user, setUser }) {
  const today = new Date().toISOString().slice(0,10);
  const gs = user.gameReward || { date: today, earnedToday: 0, bestScore: 0 };
  const earned = gs.date === today ? Number(gs.earnedToday || 0) : 0;
  const remaining = Math.max(0, 20 - earned);
  const [score, setScore] = useState(0);
  const [notice, setNotice] = useState('Stable Arcade · 보석은 획득만, 운석은 GAME OVER');
  const [soundOn, setSoundOn] = useState(true);
  const [gameOver, setGameOver] = useState(null);
  const [restartKey, setRestartKey] = useState(0);

  const restartArcade = () => {
    setGameOver(null);
    setScore(0);
    setNotice('3... 2... 1... LAUNCH!');
    setRestartKey(v => v + 1);
  };

  return (
    <section className="page premium-card content-card game-page arcade-ultimate-page">
      <div className="arcade-title-row">
        <div>
          <h2>🎮 Nova-X1 Arcade Stable</h2>
          <p>{notice}</p>
        </div>
        <button className={soundOn ? 'sound-toggle on' : 'sound-toggle'} onClick={() => setSoundOn(!soundOn)}>
          {soundOn ? '🔊' : '🔇'}
        </button>
      </div>

      <div className="grid">
        <div><small>Daily Game Reward</small><b>{earned}/20 SPNX</b></div>
        <div><small>Remaining</small><b>{remaining} SPNX</b></div>
      </div>

      <GalaxyLeaderboard currentScore={score} />

      <div className="arcade-live arcade-ultimate">
        <NovaArcadeCanvas
          soundOn={soundOn}
          onScore={setScore}
          onNotice={setNotice}
          onGameOver={setGameOver}
          restartKey={restartKey}
        />
        <GameOverOverlay result={gameOver} onPlayAgain={restartArcade} />
      </div>

      <div className="game-help">
        <span>💎 보석/아이템 충돌 = 획득만, 게임 재시작 없음</span>
        <span>☄️ Shield 없이 운석 충돌 = 폭발 후 GAME OVER</span>
      </div>
      <div className="rank-row"><b>Score</b><span>Stable No Restart Mode</span><strong>{score}</strong></div>
    </section>
  );
}


function MorePage() {
  return (
    <section className="page premium-card content-card"><h2>🛰 Command Center</h2>
      <div className="manifesto-panel">
        <h3>🌌 SpaceNovaX Manifesto</h3>
        <p>We are not just building an app. We are building the future digital space civilization.</p>
        <b>Every great journey begins with one brave Captain.</b>
      </div><div className="panel"><h3>🔄 Listing Conversion Policy</h3><p>상장 후 공식 교환 기간에 1 SPNX Point = 1 SPNX 비율로 교환됩니다.</p><p>KYC, 보안 검토, Solana 지갑 등록이 필요합니다.</p></div><button className="wide" onClick={() => { window.location.href = '/admin'; }}>Admin Dashboard</button>{Object.entries(OFFICIAL_LINKS).map(([k, url]) => <button key={k} className="wide ghost" onClick={() => openUrl(url)}>{k.toUpperCase()}</button>)}</section>
  );
}


function captainAiMessages(user = defaultUser()) {
  const m = user.mining || {};
  const today = new Date().toISOString().slice(0, 10);
  const game = user.gameReward || { date: today, earnedToday: 0 };
  const gameEarned = game.date === today ? Number(game.earnedToday || 0) : 0;
  const gameLeft = Math.max(0, 20 - gameEarned);
  const claims = user.missionClaims || {};
  const rank = getRank(user.level || 1);

  const messages = [
    'We are not just building an app. We are building the future digital space civilization.',
    'Every great journey begins with one brave Captain.',
    'Explore. Mine. Evolve. This is the SpaceNovaX way.',
    'Every Captain has a story. Yours begins here.',
    'One Galaxy. Millions of Captains.',
    'SpaceNovaX is not only a token. It is a growing space ecosystem.',
  ];

  if (m.claimable) messages.unshift('Mining complete. Claim your 24 SPNX and continue the expedition.');
  else if (m.active) messages.unshift(`Mining in progress. Next claim in ${time(m.remainingMs || 0)}.`);
  else messages.unshift('Mining engine is ready. Start your 24-hour expedition.');

  messages.push(`Game reward remaining today: ${gameLeft}/20 SPNX.`);
  messages.push('Today\'s Galaxy Champion is waiting to be challenged. Enter Arcade and climb the leaderboard.');
  messages.push(`Mission progress: ${Object.keys(claims).length}/7 completed. Lifetime missions can be claimed only once.`);
  messages.push(`Current rank: ${rank.title}. Sector: ${rank.sector}.`);
  messages.push(user.solanaWallet ? 'Solana wallet registered. You are preparing for the future conversion window.' : 'Register your Solana wallet to prepare for future SPNX conversion.');
  messages.push('Official Launch is coming. 1 SPNX Point = 1 SPNX during the official conversion period.');

  return messages;
}

function CaptainAI({ user }) {
  const [open, setOpen] = useState(false);
  const messages = captainAiMessages(user);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setIndex((v) => (v + 1) % messages.length), 5200);
    return () => clearInterval(timer);
  }, [messages.length]);

  return (
    <div className={open ? 'captain-ai open' : 'captain-ai'}>
      <button className="captain-ai-orb" type="button" onClick={() => setOpen(!open)}>
        <span>🤖</span>
      </button>
      <div className="captain-ai-panel">
        <div className="captain-ai-head">
          <b>Captain AI</b><small>SpaceNovaX Vision Assistant</small>
          <button type="button" onClick={() => setOpen(false)}>×</button>
        </div>
        <p>{messages[index]}</p>
        <div className="captain-ai-dots">
          {messages.slice(0, 6).map((_, i) => <i key={i} className={i === index % 6 ? 'active' : ''} />)}
        </div>
      </div>
    </div>
  );
}

function BottomNav({ tab, setTab }) {
  const items = [
    ['home','🪐','HOME'],
    ['mining','⛏','MINE'],
    ['missions','⭐','MISSIONS'],
    ['friends','👨‍🚀','FLEET'],
    ['ranking','🏆','RANK'],
    ['wallet','👛','WALLET'],
    ['kyc','🛡','KYC'],
    ['game','🚀','ARCADE'],
    ['more','🛰','COMMAND'],
  ];
  function go(id) {
    if (navigator.vibrate) navigator.vibrate(12);
    setTab(id);
  }
  return (
    <nav className="bottom-nav v13-bottom-nav">
      {items.map(([id, icon, label]) => (
        <button key={id} className={tab === id ? 'active' : ''} onClick={() => go(id)}>
          <span>{icon}</span><small>{label}</small>
        </button>
      ))}
    </nav>
  );
}

export default function App() {
  const [tab, setTab] = useState('home');
  const [user, setUserState] = useState(defaultUser());
  const [loading, setLoading] = useState(false);
  function setUser(u) { setUserState({ ...defaultUser(), ...u }); }
  async function sync() { try { const data = await api('/api/session', { method: 'POST', body: JSON.stringify({}) }); if (data.user) setUser(data.user); } catch {} }
  useEffect(() => { sync(); const t = setInterval(sync, 30000); return () => clearInterval(t); }, []);
  async function startMining() { setLoading(true); try { const data = await api('/api/mining/start', { method: 'POST', body: JSON.stringify({}) }); if (data.user) setUser(data.user); } catch(e) { alert(e.message); } setLoading(false); }
  async function claimMining() { setLoading(true); try { const data = await api('/api/mining/claim', { method: 'POST', body: JSON.stringify({}) }); if (data.user) setUser(data.user); } catch(e) { alert(e.message); } setLoading(false); }
  const page = useMemo(() => {
    if (tab === 'home') return <HomePage user={user} startMining={startMining} claimMining={claimMining} loading={loading} />;
    if (tab === 'mining') return <MiningPage user={user} startMining={startMining} claimMining={claimMining} loading={loading} />;
    if (tab === 'missions') return <MissionsPage setUser={setUser} />;
    if (tab === 'friends') return <FriendsPage user={user} />;
    if (tab === 'ranking') return <RankingPage user={user} />;
    if (tab === 'wallet') return <WalletPage user={user} setUser={setUser} />;
    if (tab === 'kyc') return <KycPage user={user} setUser={setUser} />;
    if (tab === 'game') return <GamePage user={user} setUser={setUser} />;
    return <MorePage />;
  }, [tab, user, loading]);
  return <div className="app-shell"><AppHeader user={user} />{page}<CaptainAI user={user} />
      <BottomNav tab={tab} setTab={setTab} /></div>;
}
