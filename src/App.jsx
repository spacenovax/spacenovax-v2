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



function createArcadeSounds() {
  let audioCtx = null;
  const getCtx = () => {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  };
  const tone = (freq = 440, dur = 0.12, type = 'sine', gain = 0.08, slide = 0) => {
    try {
      const ctx = getCtx();
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), ctx.currentTime + dur);
      g.gain.setValueAtTime(gain, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch {}
  };
  return {
    start: () => { tone(220, .10, 'sawtooth', .045, 220); setTimeout(() => tone(660, .12, 'sine', .05, 220), 90); },
    crystal: () => { tone(860, .08, 'sine', .055, 360); setTimeout(() => tone(1320, .10, 'triangle', .04, 240), 55); },
    boost: () => { tone(180, .16, 'sawtooth', .055, 520); setTimeout(() => tone(740, .13, 'square', .035, 260), 80); },
    hit: () => { tone(90, .20, 'sawtooth', .09, -35); setTimeout(() => tone(54, .18, 'square', .055, -14), 70); },
    high: () => { tone(660, .10, 'sine', .055, 220); setTimeout(() => tone(880, .10, 'sine', .055, 220), 110); setTimeout(() => tone(1320, .16, 'triangle', .055, 0), 220); },
    muted: false,
  };
}


function createArcadeSounds() {
  let audioCtx = null;
  const getCtx = () => {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  };
  const tone = (freq = 440, dur = 0.12, type = 'sine', gain = 0.08, slide = 0) => {
    try {
      const ctx = getCtx();
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), ctx.currentTime + dur);
      g.gain.setValueAtTime(gain, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch {}
  };
  return {
    start: () => { tone(260, .10, 'sawtooth', .045, 220); setTimeout(() => tone(720, .11, 'sine', .05, 200), 90); },
    crystal: () => { tone(920, .08, 'sine', .055, 420); setTimeout(() => tone(1380, .10, 'triangle', .04, 240), 55); },
    item: () => { tone(180, .16, 'sawtooth', .055, 520); setTimeout(() => tone(740, .13, 'square', .035, 260), 80); },
    shield: () => { tone(500, .12, 'triangle', .06, 220); setTimeout(() => tone(900, .12, 'sine', .05, 200), 90); },
    explosion: () => { tone(95, .24, 'sawtooth', .10, -45); setTimeout(() => tone(48, .32, 'square', .075, -18), 90); },
  };
}

function GalaxyLeaderboard({ currentScore = 0 }) {
  const championScore = 18560;
  const top = [
    { rank: 1, name: 'Captain Nova', score: championScore, badge: '👑' },
    { rank: 2, name: 'Astro Hunter', score: 16240, badge: '🥈' },
    { rank: 3, name: 'Mars Pilot', score: 14880, badge: '🥉' },
  ];
  const myRank = currentScore >= top[0].score ? 1 : currentScore >= top[2].score ? 3 : 128;
  const gap = Math.max(0, championScore - currentScore);
  return (
    <div className="galaxy-leaderboard">
      <div className="champion-banner">
        <span>🌌 Current Galaxy Champion</span>
        <b>{top[0].badge} {top[0].name}</b>
        <strong>{top[0].score.toLocaleString()}</strong>
      </div>
      <div className="leaderboard-list">
        {top.map((p) => (
          <div key={p.rank} className={`leader-row rank-${p.rank}`}>
            <em>#{p.rank}</em>
            <span>{p.badge} {p.name}</span>
            <b>{p.score.toLocaleString()}</b>
          </div>
        ))}
      </div>
      <div className="my-rank-card">
        <span>🚀 My Arcade Rank</span>
        <b>#{myRank}</b>
        <small>{gap > 0 ? `${gap.toLocaleString()} points to Galaxy Champion` : 'You are today’s Galaxy Champion!'}</small>
      </div>
    </div>
  );
}

function GameOverOverlay({ result, onPlayAgain }) {
  if (!result?.over) return null;
  const championScore = 18560;
  const gap = Math.max(0, championScore - Number(result.score || 0));
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
        <div className="champion-gap">
          <span>👑 Today's Champion</span>
          <b>Captain Nova — {championScore.toLocaleString()}</b>
          <small>{gap > 0 ? `${gap.toLocaleString()} points behind the Champion` : 'You are today’s Galaxy Champion!'}</small>
        </div>
        <div className="gameover-actions">
          <button onClick={onPlayAgain}>🚀 PLAY AGAIN</button>
        </div>
      </div>
    </div>
  );
}

function NovaArcadeCanvas({ onReward, dailyRemaining, soundOn, onScore, onEvent, onGameOver, restartKey }) {
  const canvasRef = useRef(null);
  const soundsRef = useRef(null);
  const stopRef = useRef(false);

  const play = useCallback((name) => {
    if (!soundOn) return;
    if (!soundsRef.current) soundsRef.current = createArcadeSounds();
    soundsRef.current[name]?.();
  }, [soundOn]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let raf = 0;
    stopRef.current = false;

    const state = {
      score: 0,
      crystals: 0,
      shipX: 0.5,
      targetX: 0.5,
      lastRewardScore: 0,
      objects: [],
      stars: [],
      particles: [],
      floaters: [],
      frame: 0,
      shake: 0,
      flash: 0,
      shield: 0,
      boost: 0,
      combo: 0,
      dead: false,
      showShip: true,
      gameOverSent: false,
    };

    const addFloater = (x, y, text, color = '#34efff') => {
      state.floaters.push({ x, y, text, color, life: 72, max: 72 });
    };

    const burst = (x, y, color, count = 18, power = 3) => {
      for (let i = 0; i < count; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const sp = 0.8 + Math.random() * power;
        state.particles.push({
          x, y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 38 + Math.random() * 30,
          max: 70,
          r: 1.6 + Math.random() * 5.4,
          color,
        });
      }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      state.stars = Array.from({ length: 230 }, () => ({
        x: Math.random() * rect.width,
        y: Math.random() * rect.height,
        s: 0.35 + Math.random() * 2.1,
        a: 0.18 + Math.random() * 0.82,
        v: 0.15 + Math.random() * 0.85,
      }));
    };

    const spawn = (w, difficulty) => {
      if (state.dead) return;
      const roll = Math.random();
      const type = roll < 0.55 ? 'crystal' : roll < 0.86 ? 'asteroid' : roll < 0.94 ? 'boost' : 'shield';
      state.objects.push({
        type,
        crystalType: type === 'crystal' ? (Math.random() > .88 ? 'gold' : Math.random() > .70 ? 'purple' : 'blue') : '',
        x: 32 + Math.random() * (w - 64),
        y: -44,
        r: type === 'asteroid' ? 18 + Math.random() * 22 : 16,
        vy: (type === 'asteroid' ? 1.8 + Math.random() * 1.9 : 1.2 + Math.random() * 1.3) + difficulty,
        spin: Math.random() * Math.PI,
      });
    };

    const endGame = (shipX, shipY) => {
      if (state.gameOverSent) return;
      state.gameOverSent = true;
      state.dead = true;
      state.showShip = false;
      state.objects = [];
      state.shake = 32;
      state.flash = 44;
      state.combo = 0;
      burst(shipX, shipY, '#ff4d6d', 110, 10);
      burst(shipX, shipY, '#ffd66e', 70, 8);
      burst(shipX, shipY, '#34efff', 42, 6);
      addFloater(shipX, shipY - 50, 'MISSION FAILED', '#ff4d6d');
      play('explosion');
      if (navigator.vibrate) navigator.vibrate([100, 50, 160]);
      onEvent?.('Mission failed, Captain. Prepare for another launch.');

      setTimeout(() => {
        if (stopRef.current) return;
        onGameOver?.({
          over: true,
          score: state.score,
          crystals: state.crystals,
          reward: Math.min(20, Math.floor(state.score / 100) * 5),
          rank: state.score >= 18560 ? 1 : state.score >= 14880 ? 3 : state.score >= 10920 ? 5 : 128,
        });
      }, 1000);
    };

    const drawShip = (x, y, t) => {
      if (!state.showShip) return;
      ctx.save();
      ctx.translate(x, y + Math.sin(t / 28) * 4);
      ctx.scale(0.43, 0.43);
      ctx.shadowColor = state.boost > 0 ? '#ffd66e' : '#34efff';
      ctx.shadowBlur = state.boost > 0 ? 52 : 34;

      const flame = (state.boost > 0 ? 110 : 74) + Math.sin(t / 4) * 18;
      const grad = ctx.createLinearGradient(0, 32, 0, 32 + flame);
      grad.addColorStop(0, 'rgba(255,255,255,.98)');
      grad.addColorStop(.22, 'rgba(52,239,255,.90)');
      grad.addColorStop(.62, state.boost > 0 ? 'rgba(255,214,110,.58)' : 'rgba(91,104,255,.55)');
      grad.addColorStop(1, 'rgba(255,60,231,0)');
      ctx.fillStyle = grad;
      [-28, 0, 28].forEach((dx) => {
        ctx.beginPath();
        ctx.moveTo(dx - 9, 28);
        ctx.lineTo(dx + 9, 28);
        ctx.lineTo(dx, 32 + flame);
        ctx.closePath();
        ctx.fill();
      });

      const wingGrad = ctx.createLinearGradient(-120, -10, 120, 20);
      wingGrad.addColorStop(0, '#f8fbff');
      wingGrad.addColorStop(.45, '#7c8fa8');
      wingGrad.addColorStop(1, '#f8fbff');
      ctx.fillStyle = wingGrad;
      ctx.beginPath(); ctx.moveTo(-18, 6); ctx.lineTo(-128, 52); ctx.lineTo(-82, 0); ctx.lineTo(-22, -18); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(18, 6); ctx.lineTo(128, 52); ctx.lineTo(82, 0); ctx.lineTo(22, -18); ctx.closePath(); ctx.fill();

      const bodyGrad = ctx.createLinearGradient(-30, -80, 36, 64);
      bodyGrad.addColorStop(0, '#ffffff');
      bodyGrad.addColorStop(.35, '#cbd8e8');
      bodyGrad.addColorStop(.6, '#41536b');
      bodyGrad.addColorStop(1, '#f8fbff');
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.moveTo(0, -98);
      ctx.bezierCurveTo(42, -40, 48, 26, 0, 72);
      ctx.bezierCurveTo(-48, 26, -42, -40, 0, -98);
      ctx.closePath();
      ctx.fill();

      const cockGrad = ctx.createRadialGradient(0, -38, 4, 0, -30, 42);
      cockGrad.addColorStop(0, '#6ffaff');
      cockGrad.addColorStop(.38, '#12315c');
      cockGrad.addColorStop(1, '#020617');
      ctx.fillStyle = cockGrad;
      ctx.beginPath();
      ctx.ellipse(0, -34, 20, 42, 0, 0, Math.PI * 2);
      ctx.fill();

      if (state.shield > 0) {
        ctx.strokeStyle = 'rgba(118,250,255,.9)';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, -10, 148, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    };

    const loop = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const t = state.frame;
      state.frame += 1;

      const difficulty = Math.min(2.7, t / 3400);
      if (state.shake > 0) state.shake *= .88;
      if (state.flash > 0) state.flash *= .90;
      if (state.boost > 0) state.boost -= 1;
      if (state.shield > 0) state.shield -= .5;

      ctx.save();
      const shakeX = state.shake > 0.2 ? (Math.random() - .5) * state.shake : 0;
      const shakeY = state.shake > 0.2 ? (Math.random() - .5) * state.shake : 0;
      ctx.translate(shakeX, shakeY);

      ctx.clearRect(-40, -40, w + 80, h + 80);
      const bg = ctx.createRadialGradient(w * .55, h * .45, 10, w * .5, h * .45, h * .78);
      bg.addColorStop(0, '#172968');
      bg.addColorStop(.35, '#070b22');
      bg.addColorStop(1, '#02030b');
      ctx.fillStyle = bg;
      ctx.fillRect(-40, -40, w + 80, h + 80);

      state.stars.forEach((s) => {
        s.y += s.v * (state.boost > 0 ? 2 : 1);
        if (s.y > h) {
          s.y = -4;
          s.x = Math.random() * w;
        }
        ctx.globalAlpha = s.a * (0.55 + Math.sin((t + s.x) / 28) * 0.45);
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.s, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      if (!state.dead && t % Math.max(16, 34 - Math.floor(difficulty * 5)) === 0) spawn(w, difficulty);

      state.objects.forEach((o) => {
        o.y += o.vy;
        o.spin += 0.04;
        if (o.type === 'asteroid') {
          ctx.save();
          ctx.translate(o.x, o.y);
          ctx.rotate(o.spin);
          ctx.shadowColor = '#ff7a2f';
          ctx.shadowBlur = 14;
          const g = ctx.createRadialGradient(-6, -8, 3, 0, 0, o.r);
          g.addColorStop(0, '#d8d8d8');
          g.addColorStop(.55, '#383843');
          g.addColorStop(1, '#08080d');
          ctx.fillStyle = g;
          ctx.beginPath();
          for (let i = 0; i < 9; i += 1) {
            const a = (Math.PI * 2 / 9) * i;
            const rr = o.r * (.72 + ((i * 13) % 30) / 100);
            ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
          }
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else if (o.type === 'boost') {
          ctx.font = '30px system-ui';
          ctx.shadowColor = '#ffd66e';
          ctx.shadowBlur = 20;
          ctx.fillText('⚡', o.x - 14, o.y + 12);
          ctx.shadowBlur = 0;
        } else if (o.type === 'shield') {
          ctx.font = '29px system-ui';
          ctx.shadowColor = '#76faff';
          ctx.shadowBlur = 20;
          ctx.fillText('🛡', o.x - 14, o.y + 12);
          ctx.shadowBlur = 0;
        } else {
          const emoji = o.crystalType === 'gold' ? '🔶' : o.crystalType === 'purple' ? '🔮' : '💎';
          ctx.font = '28px system-ui';
          ctx.shadowColor = o.crystalType === 'gold' ? '#ffd66e' : '#8b5cff';
          ctx.shadowBlur = 18;
          ctx.fillText(emoji, o.x - 14, o.y + 10);
          ctx.shadowBlur = 0;
        }
      });

      if (!state.dead) state.shipX += (state.targetX - state.shipX) * 0.11;
      const shipX = w * state.shipX;
      const shipY = h - 105;
      const hitbox = 24;
      drawShip(shipX, shipY, t);

      if (!state.dead) {
        for (const o of state.objects) {
          const dx = o.x - shipX;
          const dy = o.y - shipY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < o.r + hitbox) {
            o.y = h + 100;
            if (o.type === 'asteroid') {
              state.combo = 0;
              if (state.shield > 0) {
                state.shield = 0;
                state.shake = 13;
                state.flash = 10;
                burst(o.x, o.y, '#76faff', 40, 6);
                addFloater(o.x, o.y, 'SHIELD BLOCK!', '#76faff');
                play('shield');
                if (navigator.vibrate) navigator.vibrate(60);
                onEvent?.('Shield absorbed the impact.');
              } else {
                endGame(shipX, shipY);
                break;
              }
            } else {
              const points = o.type === 'boost' ? 25 : o.type === 'shield' ? 18 : o.crystalType === 'gold' ? 35 : o.crystalType === 'purple' ? 20 : 10;
              state.score += points;
              state.combo += 1;
              if (o.type === 'crystal') state.crystals += 1;
              burst(o.x, o.y, o.type === 'boost' ? '#ffd66e' : o.type === 'shield' ? '#76faff' : '#34efff', 20, 4);
              addFloater(o.x, o.y, o.type === 'boost' ? 'BOOST!' : o.type === 'shield' ? 'SHIELD!' : `+${points}`, o.type === 'boost' ? '#ffd66e' : '#34efff');
              if (o.type === 'boost') {
                state.boost = 300;
                play('item');
              } else if (o.type === 'shield') {
                state.shield = 520;
                play('shield');
              } else {
                play('crystal');
              }
              if (state.combo === 10) addFloater(w / 2, h * .36, 'GREAT COMBO x10', '#ffd66e');
              if (state.combo === 20) addFloater(w / 2, h * .36, 'GALAXY COMBO x20', '#ff3ce7');
              onScore?.(state.score);
              if (state.score - state.lastRewardScore >= 100 && dailyRemaining > 0) {
                state.lastRewardScore = state.score;
                onReward(Math.min(5, dailyRemaining));
                addFloater(shipX, shipY - 80, '+5 SPNX', '#76ffb0');
              }
            }
          }
        }
      }

      state.objects = state.objects.filter((o) => o.y < h + 80);
      state.particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += .025;
        p.life -= 1;
        ctx.globalAlpha = Math.max(0, p.life / p.max);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });
      state.particles = state.particles.filter((p) => p.life > 0);
      ctx.globalAlpha = 1;

      state.floaters.forEach((f) => {
        f.y -= .65;
        f.life -= 1;
        ctx.globalAlpha = Math.max(0, f.life / f.max);
        ctx.fillStyle = f.color;
        ctx.shadowColor = f.color;
        ctx.shadowBlur = 16;
        ctx.font = '900 18px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(f.text, f.x, f.y);
        ctx.shadowBlur = 0;
        ctx.textAlign = 'start';
      });
      state.floaters = state.floaters.filter((f) => f.life > 0);
      ctx.globalAlpha = 1;

      ctx.fillStyle = 'rgba(2,5,20,.66)';
      ctx.strokeStyle = 'rgba(52,239,255,.28)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(12, 12, 172, 72, 16);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#34efff';
      ctx.font = '800 13px system-ui';
      ctx.fillText('SCORE', 28, 34);
      ctx.fillStyle = '#fff';
      ctx.font = '900 22px system-ui';
      ctx.fillText(String(state.score), 28, 60);
      ctx.fillStyle = '#ffd66e';
      ctx.font = '800 12px system-ui';
      ctx.fillText(`COMBO x${state.combo}`, 102, 34);
      ctx.fillStyle = '#76ffb0';
      ctx.fillText(`CRYSTAL ${state.crystals}`, 102, 58);

      if (state.dead) {
        ctx.globalAlpha = .72;
        ctx.fillStyle = 'rgba(1,3,12,.22)';
        ctx.fillRect(-40, -40, w + 80, h + 80);
        ctx.globalAlpha = 1;
      }

      if (state.flash > 0.2) {
        ctx.globalAlpha = Math.min(.42, state.flash / 60);
        ctx.fillStyle = '#ff2d55';
        ctx.fillRect(-40, -40, w + 80, h + 80);
        ctx.globalAlpha = 1;
      }

      ctx.restore();
      raf = requestAnimationFrame(loop);
    };

    resize();
    onScore?.(0);
    play('start');

    const onResize = () => resize();
    const onMove = (e) => {
      if (state.dead) return;
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches?.[0]?.clientX ?? e.clientX;
      state.targetX = Math.max(0.10, Math.min(0.90, (clientX - rect.left) / rect.width));
    };

    window.addEventListener('resize', onResize);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('touchmove', onMove, { passive: true });
    canvas.addEventListener('touchstart', onMove, { passive: true });
    raf = requestAnimationFrame(loop);

    return () => {
      stopRef.current = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('touchmove', onMove);
      canvas.removeEventListener('touchstart', onMove);
    };
  }, [dailyRemaining, onReward, onScore, onEvent, onGameOver, play, restartKey]);

  return <canvas className="arcade-canvas" ref={canvasRef} />;
}

function GamePage({ user, setUser }) {
  const today = new Date().toISOString().slice(0, 10);
  const gs = user.gameReward || { date: today, earnedToday: 0, bestScore: 0 };
  const earned = gs.date === today ? Number(gs.earnedToday || 0) : 0;
  const remaining = Math.max(0, 20 - earned);
  const [score, setScore] = useState(0);
  const [notice, setNotice] = useState('Real Game Over Mode · 운석 충돌 시 Shield 없으면 즉시 종료');
  const [soundOn, setSoundOn] = useState(true);
  const [gameOver, setGameOver] = useState(null);
  const [restartKey, setRestartKey] = useState(0);

  const rewardGame = useCallback(async (reward) => {
    if (remaining <= 0) {
      setNotice('오늘 게임 보상 20 SPNX를 모두 받았습니다. 랭킹은 계속 기록됩니다.');
      return;
    }
    try {
      const data = await api('/api/game/reward', { method: 'POST', body: JSON.stringify({ score: Math.max(score, 100), reward }) });
      if (data.user) setUser(data.user);
      setNotice(`💎 Arcade reward! +${data.reward} SPNX`);
    } catch {
      setNotice(`Preview reward: +${reward} SPNX · 서버 연결 후 실제 지급됩니다.`);
    }
  }, [remaining, score, setUser]);

  const restartArcade = () => {
    setGameOver(null);
    setScore(0);
    setNotice('3... 2... 1... LAUNCH!');
    setRestartKey((v) => v + 1);
  };

  return (
    <section className="page premium-card content-card game-page arcade-ultimate-page">
      <div className="arcade-title-row">
        <div>
          <h2>🎮 Nova-X1 Arcade Ultimate</h2>
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
          onReward={rewardGame}
          dailyRemaining={remaining}
          soundOn={soundOn}
          onScore={setScore}
          onEvent={setNotice}
          onGameOver={setGameOver}
          restartKey={restartKey}
        />
        <GameOverOverlay result={gameOver} onPlayAgain={restartArcade} />
      </div>

      <div className="game-help">
        <span>☄️ Shield 없이 운석 충돌 = GAME OVER</span>
        <span>🛡 Shield는 1회 방어 · 💎 Crystal 수집 · ⚡ Boost</span>
      </div>
      <div className="rank-row"><b>Score</b><span>Real Game Over Mode</span><strong>{score}</strong></div>
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
