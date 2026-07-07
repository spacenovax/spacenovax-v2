import { useEffect, useMemo, useState } from 'react';
import './styles/global.css';

const MISSION_LINKS = [
  { id: 'website', icon: '🌐', title: 'Website', reward: 100, url: 'https://spacenovax.com', action: 'OPEN', type: 'one_time' },
  { id: 'telegram', icon: '📢', title: 'Telegram', reward: 300, url: 'https://t.me/spacesnovax', action: 'JOIN', type: 'one_time' },
  { id: 'x', icon: '𝕏', title: 'X Twitter', reward: 300, url: 'https://x.com/spacenovaxteam', action: 'FOLLOW', type: 'one_time' },
  { id: 'discord', icon: '💬', title: 'Discord', reward: 300, url: 'https://discord.gg/rxVNWMC8e8', action: 'JOIN', type: 'one_time' },
  { id: 'youtube_subscribe', icon: '▶️', title: 'YouTube Subscribe', reward: 300, url: 'https://youtube.com/@spacenovaxteam', action: 'SUBSCRIBE', type: 'one_time' },
  { id: 'youtube_like', icon: '👍', title: 'YouTube Like', reward: 100, url: 'https://youtube.com/@spacenovaxteam', action: 'LIKE', type: 'one_time' },
  { id: 'daily_checkin', icon: '🎁', title: 'Daily Check-in', reward: 20, url: '', action: 'CHECK-IN', type: 'daily' },
];

function fmt(v, d = 6) {
  return Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: d });
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
    mining: {
      active: false,
      claimable: false,
      phase: 1,
      reward: 24,
      speedPerHour: 1,
      remainingMs: 86400000,
      durationMs: 86400000,
      progress: 0,
      minedSoFar: 0,
    },
    missionClaims: {},
  };
}

function getRefCode(user) {
  return (user?.id || 'guest-captain').replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase() || 'SPNX2026';
}

function openUrl(url) {
  if (!url) return;
  const tg = window.Telegram?.WebApp;
  if (tg?.openLink) tg.openLink(url);
  else window.open(url, '_blank', 'noopener,noreferrer');
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.message || 'API failed');
  return data;
}

function AppHeader({ user }) {
  return (
    <header className="v8-header">
      <div className="v8-logo-orb">X1</div>
      <div>
        <h1>SpaceNovaX</h1>
        <p>Mine Together. Explore Beyond.</p>
      </div>
      <div className="v8-phase">Phase {user?.mining?.phase || 1}</div>
    </header>
  );
}

function CinematicShip({ active }) {
  return (
    <div className={active ? 'v8-ship active' : 'v8-ship'}>
      <div className="v8-hull">
        <div className="v8-cockpit" />
        <div className="v8-wing-left" />
        <div className="v8-wing-right" />
        <div className="v8-engine e1" />
        <div className="v8-engine e2" />
        <div className="v8-engine e3" />
      </div>
      <div className="v8-flames"><i /><i /><i /></div>
      {active && (
        <>
          <span className="v8-pop p1">+0.000032</span>
          <span className="v8-pop p2">+0.000041</span>
          <span className="v8-pop p3">+0.000028</span>
        </>
      )}
    </div>
  );
}

function HomePage({ user, startMining, claimMining, loading }) {
  const mining = user.mining || {};
  const isMining = Boolean(mining.active);
  const canClaim = Boolean(mining.claimable);
  return (
    <section className="v8-page">
      <div className="v8-profile glass">
        <div className="v8-avatar" />
        <div><b>Space Explorer</b><span>Lv.{user.level || 7} Captain</span></div>
        <div className="v8-exp"><small>Experience</small><em><i /></em></div>
      </div>

      <div className="v8-hero">
        <div className="v8-stars" />
        <span className="v8-meteor m1" />
        <span className="v8-meteor m2" />

        <div className="v8-balance">
          <small>TOTAL BALANCE</small>
          <strong>{fmt(user.balance)}</strong>
          <h2>SPNX Points</h2>
          <p>Nova-X1 Starter Ship</p>
        </div>

        <CinematicShip active={isMining} />

        <div className="v8-today">
          <span>⛏️</span>
          <div><small>Today's Mining</small><b>+{fmt(mining.reward || 24)}</b><em>SPNX</em></div>
          <span className="trend">↗</span>
        </div>

        <div className="v8-stats">
          <div><small>Mining Speed</small><b>{fmt(mining.speedPerHour || 1, 2)}x</b></div>
          <div><small>Fleet Bonus</small><b>+{mining.fleetBonus || 0}%</b></div>
          <div><small>Power</small><b>2.80x</b></div>
        </div>

        <div className="v8-action">
          <div><small>{canClaim ? 'Claim Ready' : isMining ? 'Next Claim' : 'Ready'}</small><b>{canClaim ? '00:00:00' : time(mining.remainingMs || 86400000)}</b></div>
          <button disabled={loading || isMining} className={canClaim ? 'ready' : ''} onClick={canClaim ? claimMining : startMining}>
            {canClaim ? '🎁 CLAIM' : isMining ? 'MINING...' : '🚀 START MINING'}
          </button>
        </div>
      </div>
    </section>
  );
}

function MiningPage({ user, startMining, claimMining, loading }) {
  const m = user.mining || {};
  const progress = Math.round((m.progress || 0) * 100);
  return (
    <section className="v8-page glass v8-card">
      <h2>⛏️ Expedition Mining</h2>
      <p>Server-based 24h mining · Nova-X1 = 24 SPNX / day</p>
      <div className="v8-progress"><span><i style={{ width: `${progress}%` }} /></span><b>{progress}%</b></div>
      <div className="v8-grid">
        <div><small>Remaining</small><b>{time(m.remainingMs || 86400000)}</b></div>
        <div><small>Earned</small><b>{fmt(m.minedSoFar || 0)}</b></div>
        <div><small>Cycle Reward</small><b>{fmt(m.reward || 24)}</b></div>
        <div><small>Speed</small><b>{fmt(m.speedPerHour || 1, 2)} SPNX/h</b></div>
        <div><small>Fleet Bonus</small><b>+{m.fleetBonus || 0}%</b></div>
        <div><small>Halving</small><b>Phase {m.phase || 1}</b></div>
      </div>
      <div className="v8-two-buttons">
        <button disabled={loading || m.active || m.claimable} onClick={startMining}>🚀 START</button>
        <button disabled={loading || !m.claimable} onClick={claimMining}>🎁 CLAIM</button>
      </div>
    </section>
  );
}

function MissionsPage({ user, setUser }) {
  const [missions, setMissions] = useState(MISSION_LINKS.map((m) => ({ ...m, status: { completed: false } })));
  const [notice, setNotice] = useState('Official missions are paid once per account.');
  const [busy, setBusy] = useState('');

  async function load() {
    try {
      const data = await api('/api/missions');
      setMissions(data.missions || missions);
    } catch {}
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
      } catch (e) {
        setNotice(e.message);
      } finally {
        setBusy('');
      }
    }, mission.url ? 650 : 0);
  }

  return (
    <section className="v8-page glass v8-card">
      <h2>⭐ Space Missions</h2>
      <p>{notice}</p>
      {missions.map((m) => (
        <button key={m.id} className={m.status?.completed ? 'v8-mission done' : 'v8-mission'} disabled={m.status?.completed || busy === m.id} onClick={() => claim(m)}>
          <span>{m.icon} {m.title}</span>
          <em>{m.status?.completed ? (m.type === 'daily' ? 'Claimed Today' : 'Completed') : busy === m.id ? 'Checking...' : m.action}</em>
          <b>+{m.reward} SPNX</b>
        </button>
      ))}
    </section>
  );
}

function FriendsPage({ user }) {
  const code = getRefCode(user);
  const bot = 'SpaceNovaXBot';
  const link = `https://t.me/${bot}?start=${code}`;

  async function copy() {
    try { await navigator.clipboard.writeText(link); alert('Invite link copied'); } catch { alert(link); }
  }

  function share() {
    const text = `🚀 Join SpaceNovaX\nMine SPNX Points every day.\nUse my Fleet link:\n${link}`;
    if (navigator.share) navigator.share({ title: 'SpaceNovaX', text, url: link });
    else copy();
  }

  return (
    <section className="v8-page glass v8-card">
      <h2>👥 Fleet Friends</h2>
      <p>Your referral link automatically registers new captains into your Fleet.</p>
      <div className="v8-invite">
        <small>Your Fleet Code</small><b>{code}</b>
        <input readOnly value={link} />
        <div className="v8-two-buttons"><button onClick={copy}>📋 Copy</button><button onClick={share}>📤 Share</button></div>
      </div>
      <div className="v8-grid">
        <div><small>Total Invites</small><b>{user.referrals?.length || 0}</b></div>
        <div><small>Active Fleet</small><b>{user.activeFleet || 0}</b></div>
        <div><small>Fleet Bonus</small><b>+{user.fleetBonus || 0}%</b></div>
        <div><small>Fleet Rank</small><b>Captain</b></div>
      </div>
    </section>
  );
}

function RankingPage({ user }) {
  return (
    <section className="v8-page glass v8-card">
      <h2>🏆 Galaxy Ranking</h2>
      <p>Top miners and Fleet leaders.</p>
      {[user, { firstName: 'Nova Pilot', balance: 9800 }, { firstName: 'Mars Captain', balance: 7600 }].map((u, i) => (
        <div className="v8-rank" key={i}><b>#{i + 1}</b><span>{u.firstName}</span><strong>{fmt(u.balance)}</strong></div>
      ))}
    </section>
  );
}

function WalletPage({ user, setUser }) {
  const [wallet, setWallet] = useState(user.solanaWallet || '');
  const [notice, setNotice] = useState('Listing 이후 1 Point = 1 SPNX 전환 예정.');

  async function save() {
    try {
      const data = await api('/api/wallet/save', { method: 'POST', body: JSON.stringify({ wallet }) });
      setUser(data.user || { ...user, solanaWallet: wallet });
      setNotice('Wallet saved.');
    } catch (e) {
      setNotice(e.message);
    }
  }

  return (
    <section className="v8-page glass v8-card">
      <h2>👛 Space Vault</h2>
      <p>{notice}</p>
      <div className="v8-grid">
        <div><small>SPNX Point</small><b>{fmt(user.balance)}</b></div>
        <div><small>Convert Rate</small><b>1 : 1</b></div>
      </div>
      <input className="v8-input" placeholder="Solana wallet address" value={wallet} onChange={(e) => setWallet(e.target.value)} />
      <button className="v8-wide-btn" onClick={save}>Save Wallet</button>
    </section>
  );
}

function GamePage() {
  const [score, setScore] = useState(0);
  return (
    <section className="v8-page glass v8-card">
      <h2>🎮 Nova-X1 Game</h2>
      <p>Asteroid Miner preview. Full arcade opens in V2.0.</p>
      <div className="v8-game">
        <CinematicShip active />
        <span className="asteroid a" />
        <span className="asteroid b" />
      </div>
      <div className="v8-two-buttons">
        <button onClick={() => setScore(score + 10)}>💎 Collect Crystal</button>
        <button onClick={() => setScore(0)}>Reset</button>
      </div>
      <div className="v8-rank"><b>Score</b><span>SPNX Crystal</span><strong>{score}</strong></div>
    </section>
  );
}

function MorePage() {
  return (
    <section className="v8-page glass v8-card">
      <h2>••• Command Menu</h2>
      <button className="v8-wide-btn" onClick={() => { window.location.href = '/admin'; }}>Admin Dashboard</button>
      <button className="v8-wide-btn" onClick={() => openUrl('https://spacenovax.com')}>Official Website</button>
      <button className="v8-wide-btn" onClick={() => openUrl('https://t.me/spacesnovax')}>Telegram</button>
    </section>
  );
}

function BottomNav({ tab, setTab }) {
  const items = [
    ['home', '🏠', 'Home'],
    ['mining', '⛏️', 'Mining'],
    ['missions', '⭐', 'Missions'],
    ['friends', '👥', 'Friends'],
    ['ranking', '🏆', 'Ranking'],
    ['wallet', '👛', 'Wallet'],
    ['game', '🎮', 'Game'],
    ['more', '•••', 'More'],
  ];
  return (
    <nav className="v8-nav">
      {items.map(([id, icon, label]) => (
        <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
          <span>{icon}</span><small>{label}</small>
        </button>
      ))}
    </nav>
  );
}

export default function App() {
  const [tab, setTab] = useState('home');
  const [user, setUser] = useState(defaultUser());
  const [loading, setLoading] = useState(false);

  async function sync() {
    try {
      const data = await api('/api/session', { method: 'POST', body: JSON.stringify({}) });
      if (data.user) setUser({ ...defaultUser(), ...data.user });
    } catch {}
  }

  useEffect(() => {
    sync();
    const t = setInterval(sync, 30000);
    return () => clearInterval(t);
  }, []);

  async function startMining() {
    setLoading(true);
    try {
      const data = await api('/api/mining/start', { method: 'POST', body: JSON.stringify({}) });
      if (data.user) setUser({ ...defaultUser(), ...data.user });
    } catch (e) { alert(e.message); }
    setLoading(false);
  }

  async function claimMining() {
    setLoading(true);
    try {
      const data = await api('/api/mining/claim', { method: 'POST', body: JSON.stringify({}) });
      if (data.user) setUser({ ...defaultUser(), ...data.user });
    } catch (e) { alert(e.message); }
    setLoading(false);
  }

  const page = useMemo(() => {
    if (tab === 'home') return <HomePage user={user} startMining={startMining} claimMining={claimMining} loading={loading} />;
    if (tab === 'mining') return <MiningPage user={user} startMining={startMining} claimMining={claimMining} loading={loading} />;
    if (tab === 'missions') return <MissionsPage user={user} setUser={(u) => setUser({ ...defaultUser(), ...u })} />;
    if (tab === 'friends') return <FriendsPage user={user} />;
    if (tab === 'ranking') return <RankingPage user={user} />;
    if (tab === 'wallet') return <WalletPage user={user} setUser={(u) => setUser({ ...defaultUser(), ...u })} />;
    if (tab === 'game') return <GamePage />;
    return <MorePage />;
  }, [tab, user, loading]);

  return (
    <div className="v8-shell">
      <AppHeader user={user} />
      {page}
      <BottomNav tab={tab} setTab={setTab} />
    </div>
  );
}
