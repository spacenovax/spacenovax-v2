import { useEffect, useMemo, useRef, useState } from 'react';
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


function NovaArcadeCanvas({ onReward, dailyRemaining }) {
  const canvasRef = useRef(null);
  const stateRef = useRef({
    running: true,
    score: 0,
    crystals: 0,
    shipX: 0.5,
    targetX: 0.5,
    lastRewardScore: 0,
    objects: [],
    stars: [],
    frame: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const state = stateRef.current;
    let raf = 0;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!state.stars.length) {
        state.stars = Array.from({ length: 220 }, () => ({
          x: Math.random() * rect.width,
          y: Math.random() * rect.height,
          s: 0.4 + Math.random() * 2.2,
          a: 0.22 + Math.random() * 0.78,
          v: 0.12 + Math.random() * 0.62,
        }));
      }
    }

    function spawn(w) {
      const typeRoll = Math.random();
      const type = typeRoll < 0.58 ? 'crystal' : typeRoll < 0.86 ? 'asteroid' : 'boost';
      state.objects.push({
        type,
        x: 30 + Math.random() * (w - 60),
        y: -40,
        r: type === 'asteroid' ? 22 + Math.random() * 18 : type === 'boost' ? 18 : 16,
        vy: type === 'asteroid' ? 1.5 + Math.random() * 1.5 : 1.2 + Math.random() * 1.1,
        spin: Math.random() * Math.PI,
      });
    }

    function drawShip(x, y, t) {
      ctx.save();
      ctx.translate(x, y + Math.sin(t / 28) * 4);
      ctx.scale(0.46, 0.46);
      ctx.shadowColor = '#34efff';
      ctx.shadowBlur = 30;

      // engine flame
      const flame = 62 + Math.sin(t / 4) * 20;
      const grad = ctx.createLinearGradient(0, 32, 0, 32 + flame);
      grad.addColorStop(0, 'rgba(255,255,255,.95)');
      grad.addColorStop(.25, 'rgba(52,239,255,.85)');
      grad.addColorStop(.62, 'rgba(91,104,255,.55)');
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

      // wings
      const wingGrad = ctx.createLinearGradient(-120, -10, 120, 20);
      wingGrad.addColorStop(0, '#f8fbff');
      wingGrad.addColorStop(.45, '#7c8fa8');
      wingGrad.addColorStop(1, '#f8fbff');
      ctx.fillStyle = wingGrad;
      ctx.beginPath();
      ctx.moveTo(-18, 6);
      ctx.lineTo(-128, 52);
      ctx.lineTo(-82, 0);
      ctx.lineTo(-22, -18);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(18, 6);
      ctx.lineTo(128, 52);
      ctx.lineTo(82, 0);
      ctx.lineTo(22, -18);
      ctx.closePath();
      ctx.fill();

      // body
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

      // cockpit
      const cockGrad = ctx.createRadialGradient(0, -38, 4, 0, -30, 42);
      cockGrad.addColorStop(0, '#6ffaff');
      cockGrad.addColorStop(.38, '#12315c');
      cockGrad.addColorStop(1, '#020617');
      ctx.fillStyle = cockGrad;
      ctx.beginPath();
      ctx.ellipse(0, -34, 20, 42, 0, 0, Math.PI * 2);
      ctx.fill();

      // engines
      [-30, 0, 30].forEach((dx) => {
        const eg = ctx.createRadialGradient(dx, 28, 2, dx, 28, 18);
        eg.addColorStop(0, '#fff');
        eg.addColorStop(.3, '#34efff');
        eg.addColorStop(.65, '#7e43ff');
        eg.addColorStop(1, '#020617');
        ctx.fillStyle = eg;
        ctx.beginPath();
        ctx.arc(dx, 28, 18, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.restore();
    }

    function draw() {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const t = state.frame++;
      ctx.clearRect(0, 0, w, h);

      // deep space
      const bg = ctx.createRadialGradient(w * .55, h * .45, 10, w * .5, h * .45, h * .75);
      bg.addColorStop(0, '#172968');
      bg.addColorStop(.35, '#070b22');
      bg.addColorStop(1, '#02030b');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // nebula
      ctx.save();
      ctx.globalAlpha = .35;
      const ng = ctx.createRadialGradient(w * .35, h * .35, 20, w * .35, h * .35, w * .55);
      ng.addColorStop(0, '#7e43ff');
      ng.addColorStop(.4, '#123cff');
      ng.addColorStop(1, 'transparent');
      ctx.fillStyle = ng;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();

      // stars no tiled pattern
      state.stars.forEach((s) => {
        s.y += s.v;
        if (s.y > h) { s.y = -4; s.x = Math.random() * w; }
        ctx.globalAlpha = s.a * (0.55 + Math.sin((t + s.x) / 28) * 0.45);
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.s, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      if (t % 34 === 0) spawn(w);
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
          for (let i = 0; i < 9; i++) {
            const a = (Math.PI * 2 / 9) * i;
            const rr = o.r * (0.72 + ((i * 13) % 30) / 100);
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
        } else {
          ctx.font = '28px system-ui';
          ctx.shadowColor = '#8b5cff';
          ctx.shadowBlur = 18;
          ctx.fillText('💎', o.x - 14, o.y + 10);
          ctx.shadowBlur = 0;
        }
      });
      state.objects = state.objects.filter((o) => o.y < h + 60);

      // smooth ship movement
      state.shipX += (state.targetX - state.shipX) * 0.08;
      const shipX = w * state.shipX;
      const shipY = h - 105;
      drawShip(shipX, shipY, t);

      // collection zone
      for (const o of state.objects) {
        const dx = o.x - shipX;
        const dy = o.y - shipY;
        const hit = Math.sqrt(dx * dx + dy * dy) < (o.r + 25);
        if (hit && o.type !== 'asteroid') {
          o.y = h + 100;
          state.score += o.type === 'boost' ? 25 : 10;
          state.crystals += o.type === 'boost' ? 0 : 1;
          if (state.score - state.lastRewardScore >= 30 && dailyRemaining > 0) {
            state.lastRewardScore = state.score;
            onReward(Math.min(5, dailyRemaining));
          }
        }
      }

      // HUD
      ctx.fillStyle = 'rgba(2,5,20,.62)';
      ctx.strokeStyle = 'rgba(52,239,255,.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(12, 12, 150, 52, 16);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#34efff';
      ctx.font = '700 14px system-ui';
      ctx.fillText('SCORE', 28, 32);
      ctx.fillStyle = '#fff';
      ctx.font = '900 22px system-ui';
      ctx.fillText(String(state.score), 28, 56);

      raf = requestAnimationFrame(draw);
    }

    resize();
    const onResize = () => { state.stars = []; resize(); };
    const onMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches?.[0]?.clientX ?? e.clientX;
      state.targetX = Math.max(0.12, Math.min(0.88, (clientX - rect.left) / rect.width));
    };
    window.addEventListener('resize', onResize);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('touchmove', onMove, { passive: true });
    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('touchmove', onMove);
    };
  }, [dailyRemaining, onReward]);

  return <canvas className="arcade-canvas" ref={canvasRef} />;
}

function GamePage({ user, setUser }) {
  const today = new Date().toISOString().slice(0, 10);
  const gs = user.gameReward || { date: today, earnedToday: 0, bestScore: 0 };
  const earned = gs.date === today ? Number(gs.earnedToday || 0) : 0;
  const remaining = Math.max(0, 20 - earned);
  const [score, setScore] = useState(0);
  const [notice, setNotice] = useState('Nova-X1 Arcade · 하루 최대 20 SPNX Point');

  async function rewardGame(reward) {
    if (remaining <= 0) {
      setNotice('오늘 게임 보상 20 SPNX를 모두 받았습니다. 랭킹은 계속 기록됩니다.');
      return;
    }
    try {
      const nextScore = score + 30;
      setScore(nextScore);
      const data = await api('/api/game/reward', { method: 'POST', body: JSON.stringify({ score: nextScore, reward }) });
      if (data.user) setUser(data.user);
      setNotice(`💎 Live Arcade reward! +${data.reward} SPNX`);
    } catch {
      setNotice(`Preview reward: +${reward} SPNX · 서버 연결 후 실제 지급됩니다.`);
    }
  }

  return (
    <section className="page premium-card content-card game-page">
      <h2>🎮 Nova-X1 Arcade</h2>
      <p>{notice}</p>
      <div className="grid">
        <div><small>Daily Game Reward</small><b>{earned}/20 SPNX</b></div>
        <div><small>Remaining</small><b>{remaining} SPNX</b></div>
      </div>
      <div className="arcade-live">
        <NovaArcadeCanvas onReward={rewardGame} dailyRemaining={remaining} />
      </div>
      <div className="game-help">
        <span>🖱️ 마우스/손가락으로 우주선을 좌우 이동</span>
        <span>💎 크리스탈 수집 · ☄️ 운석 회피 · ⚡ 부스터 획득</span>
      </div>
      <div className="rank-row"><b>Score</b><span>SPNX Crystal</span><strong>{score}</strong></div>
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
