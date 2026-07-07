import { useEffect, useMemo, useState } from 'react';
import './styles/global.css';

const OFFICIAL_LINKS = {
  website: 'https://spacenovax.com',
  telegram: 'https://t.me/spacesnovax',
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

function StarField({ count = 160 }) {
  const stars = useMemo(() => Array.from({ length: count }, (_, i) => {
    const x = (i * 73 + 17) % 100;
    const y = (i * 41 + 29) % 100;
    const size = 0.7 + ((i * 13) % 22) / 10;
    const delay = ((i * 19) % 80) / 10;
    const dur = 2.6 + ((i * 11) % 45) / 10;
    const alpha = 0.35 + ((i * 7) % 60) / 100;
    return { x, y, size, delay, dur, alpha };
  }), [count]);
  return <div className="star-layer">{stars.map((s, i) => <i key={i} style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.size, height: s.size, animationDelay: `${s.delay}s`, animationDuration: `${s.dur}s`, opacity: s.alpha }} />)}</div>;
}

function AppHeader({ user }) {
  return (
    <header className="app-header">
      <SymbolLogo />
      <div>
        <h1>SpaceNovaX</h1>
        <p>Mine Together. Explore Beyond.</p>
      </div>
      <div className="phase-pill">Phase {user?.mining?.phase || 1}</div>
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

function LaunchCountdown() {
  return (
    <div className="launch-card premium-card">
      <span>🚀 Launch Countdown</span>
      <b>TGE Coming Soon</b>
      <small>1 SPNX Point = 1 SPNX after official conversion window</small>
    </div>
  );
}

function HomePage({ user, startMining, claimMining, loading }) {
  const m = user.mining || {};
  const isMining = Boolean(m.active);
  const canClaim = Boolean(m.claimable);
  return (
    <section className="page">
      <div className="profile-card premium-card">
        <SymbolLogo />
        <div><b>Space Explorer</b><span>Lv.{user.level || 7} Captain · Genesis Explorer</span></div>
        <div className="exp-bar"><small>Experience</small><em><i /></em></div>
      </div>
      <LaunchCountdown />
      <div className="hero-cinema">
        <StarField count={180} />
        <span className="meteor meteor-one" />
        <span className="meteor meteor-two" />
        <span className="nebula n1" />
        <span className="planet planet-one" />
        <span className="planet planet-two" />
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
  const [notice, setNotice] = useState('Official missions are paid once per account.');
  const [busy, setBusy] = useState('');
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
        setNotice(`Mission Complete: +${data.reward} SPNX`);
        if (data.user) setUser(data.user);
        await load();
      } catch (e) { setNotice(e.message); } finally { setBusy(''); }
    }, mission.url ? 650 : 0);
  }
  return (
    <section className="page premium-card content-card">
      <h2>⭐ Space Missions</h2><p>{notice}</p>
      {missions.map((m) => (
        <button key={m.id} className={m.status?.completed ? 'mission-row done' : 'mission-row'} disabled={m.status?.completed || busy === m.id} onClick={() => claim(m)}>
          <span>{m.icon} {m.title}</span><em>{m.status?.completed ? (m.type === 'daily' ? 'Claimed Today' : 'Completed') : busy === m.id ? 'Checking...' : m.action}</em><b>+{m.reward} SPNX</b>
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
      <h2>👥 Fleet Friends</h2><p>Your referral link automatically registers new captains into your Fleet.</p>
      <div className="invite-box"><small>Your Fleet Code</small><b>{code}</b><input readOnly value={link} /><div className="two-buttons"><button onClick={copy}>📋 Copy</button><button onClick={share}>📤 Share</button></div></div>
      <div className="grid"><div><small>Total Invites</small><b>{user.referrals?.length || 0}</b></div><div><small>Active Fleet</small><b>{user.activeFleet || 0}</b></div><div><small>Fleet Bonus</small><b>+{user.fleetBonus || 0}%</b></div><div><small>Fleet Rank</small><b>Captain</b></div></div>
    </section>
  );
}

function RankingPage({ user }) {
  return (
    <section className="page premium-card content-card">
      <h2>🏆 Galaxy Ranking</h2><p>Mining, Fleet and Game rankings.</p>
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

function GamePage({ user, setUser }) {
  const today = new Date().toISOString().slice(0, 10);
  const gs = user.gameReward || { date: today, earnedToday: 0, bestScore: 0 };
  const earned = gs.date === today ? Number(gs.earnedToday || 0) : 0;
  const remaining = Math.max(0, 20 - earned);
  const [score, setScore] = useState(0);
  const [notice, setNotice] = useState('Nova-X1 Arcade · 하루 최대 20 SPNX Point');
  async function collect() {
    const next = score + 10;
    setScore(next);
    if (remaining <= 0) { setNotice('오늘 게임 보상 20 SPNX를 모두 받았습니다. 랭킹은 계속 기록됩니다.'); return; }
    const reward = Math.min(5, remaining);
    try { const data = await api('/api/game/reward', { method: 'POST', body: JSON.stringify({ score: next, reward }) }); if (data.user) setUser(data.user); setNotice(`💎 Crystal collected! +${reward} SPNX`); } catch { setNotice(`Preview reward: +${reward} SPNX · 서버 연결 후 실제 지급됩니다.`); }
  }
  return (
    <section className="page premium-card content-card game-page">
      <h2>🎮 Nova-X1 Arcade</h2><p>{notice}</p>
      <div className="grid"><div><small>Daily Game Reward</small><b>{earned}/20 SPNX</b></div><div><small>Remaining</small><b>{remaining} SPNX</b></div></div>
      <div className="arcade-stage">
        <StarField count={90} />
        <span className="game-meteor gm1" /><span className="game-meteor gm2" />
        <span className="asteroid a1" /><span className="asteroid a2" /><span className="asteroid a3" />
        <span className="crystal c1">💎</span><span className="crystal c2">💎</span><span className="crystal c3">💎</span><span className="boost">⚡</span>
        <CinematicShip active game />
        <button className="control left">‹</button><button className="control right">›</button>
      </div>
      <div className="two-buttons"><button onClick={collect}>💎 Collect Crystal</button><button onClick={() => { setScore(0); setNotice('Game reset. Try again.'); }}>Reset</button></div>
      <div className="rank-row"><b>Score</b><span>SPNX Crystal</span><strong>{score}</strong></div>
    </section>
  );
}

function MorePage() {
  return (
    <section className="page premium-card content-card"><h2>••• Command Menu</h2><div className="panel"><h3>🔄 Listing Conversion Policy</h3><p>상장 후 공식 교환 기간에 1 SPNX Point = 1 SPNX 비율로 교환됩니다.</p><p>KYC, 보안 검토, Solana 지갑 등록이 필요합니다.</p></div><button className="wide" onClick={() => { window.location.href = '/admin'; }}>Admin Dashboard</button>{Object.entries(OFFICIAL_LINKS).map(([k, url]) => <button key={k} className="wide ghost" onClick={() => openUrl(url)}>{k.toUpperCase()}</button>)}</section>
  );
}

function BottomNav({ tab, setTab }) {
  const items = [['home','🏠','Home'],['mining','⛏️','Mining'],['missions','⭐','Missions'],['friends','👥','Friends'],['ranking','🏆','Ranking'],['wallet','👛','Wallet'],['kyc','🛡️','KYC'],['game','🎮','Game'],['more','•••','More']];
  return <nav className="bottom-nav">{items.map(([id, icon, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><span>{icon}</span><small>{label}</small></button>)}</nav>;
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
  return <div className="app-shell"><AppHeader user={user} />{page}<BottomNav tab={tab} setTab={setTab} /></div>;
}
