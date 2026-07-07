import { useEffect, useMemo, useState } from 'react';
import './styles/global.css';

const OFFICIAL_LINKS = {
  website: 'https://spacenovax.com',
  telegram: 'https://t.me/spacesnovax',
  x: 'https://x.com/spacenovaxteam',
  discord: 'https://discord.gg/rxVNWMC8e8',
  youtube: 'https://youtube.com/@spacenovaxteam',
};

const MISSION_LINKS = [
  { id: 'website', icon: '🌐', title: 'Website', reward: 100, url: OFFICIAL_LINKS.website, action: 'OPEN', type: 'one_time' },
  { id: 'telegram', icon: '📢', title: 'Telegram', reward: 300, url: OFFICIAL_LINKS.telegram, action: 'JOIN', type: 'one_time' },
  { id: 'x', icon: '𝕏', title: 'X Twitter', reward: 300, url: OFFICIAL_LINKS.x, action: 'FOLLOW', type: 'one_time' },
  { id: 'discord', icon: '💬', title: 'Discord', reward: 300, url: OFFICIAL_LINKS.discord, action: 'JOIN', type: 'one_time' },
  { id: 'youtube_subscribe', icon: '▶️', title: 'YouTube Subscribe', reward: 300, url: OFFICIAL_LINKS.youtube, action: 'SUBSCRIBE', type: 'one_time' },
  { id: 'youtube_like', icon: '👍', title: 'YouTube Like', reward: 20, url: OFFICIAL_LINKS.youtube, action: 'LIKE', type: 'one_time' },
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
    kyc: { status: 'not_submitted' },
    gameReward: { date: new Date().toISOString().slice(0, 10), earnedToday: 0, bestScore: 0 },
    mining: {
      active: false,
      claimable: false,
      phase: 1,
      reward: 24,
      speedPerHour: 1,
      fleetBonus: 0,
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

function SymbolLogo() {
  return (
    <div className="v9-symbol">
      <img src="/spacenovax-symbol.jpg" alt="SpaceNovaX" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
      <span>X</span>
    </div>
  );
}

function AppHeader({ user }) {
  return (
    <header className="v9-header">
      <SymbolLogo />
      <div>
        <h1>SpaceNovaX</h1>
        <p>Mine Together. Explore Beyond.</p>
      </div>
      <div className="v9-phase">Phase {user?.mining?.phase || 1}</div>
    </header>
  );
}

function CinematicShip({ active }) {
  return (
    <div className={active ? 'v9-ship active' : 'v9-ship'}>
      <div className="v9-hull">
        <div className="v9-cockpit" />
        <div className="v9-wing-left" />
        <div className="v9-wing-right" />
        <div className="v9-engine e1" />
        <div className="v9-engine e2" />
        <div className="v9-engine e3" />
      </div>
      <div className="v9-flames"><i /><i /><i /></div>
      {active && (
        <>
          <span className="v9-pop p1">+0.000032</span>
          <span className="v9-pop p2">+0.000041</span>
          <span className="v9-pop p3">+0.000028</span>
        </>
      )}
    </div>
  );
}

function LaunchCountdown() {
  return (
    <div className="launch-countdown">
      <span>🚀 Launch Countdown</span>
      <b>TGE Coming Soon</b>
      <small>1 SPNX Point = 1 SPNX after official conversion window</small>
    </div>
  );
}

function HomePage({ user, startMining, claimMining, loading }) {
  const mining = user.mining || {};
  const isMining = Boolean(mining.active);
  const canClaim = Boolean(mining.claimable);
  return (
    <section className="v9-page">
      <div className="v9-profile glass">
        <SymbolLogo />
        <div><b>Space Explorer</b><span>Lv.{user.level || 7} Captain · Genesis Explorer</span></div>
        <div className="v9-exp"><small>Experience</small><em><i /></em></div>
      </div>

      <LaunchCountdown />

      <div className="v9-hero">
        <div className="v9-stars" />
        <span className="v9-meteor m1" />
        <span className="v9-meteor m2" />

        <div className="v9-balance">
          <small>TOTAL BALANCE</small>
          <strong>{fmt(user.balance)}</strong>
          <h2>SPNX Points</h2>
          <p>Nova-X1 Starter Ship</p>
        </div>

        <CinematicShip active={isMining} />

        <div className="v9-today">
          <span>⛏️</span>
          <div><small>Today's Mining</small><b>+{fmt(mining.reward || 24)}</b><em>SPNX</em></div>
          <span className="trend">↗</span>
        </div>

        <div className="v9-stats">
          <div><small>Mining Speed</small><b>{fmt(mining.speedPerHour || 1, 2)}x</b></div>
          <div><small>Fleet Bonus</small><b>+{mining.fleetBonus || 0}%</b></div>
          <div><small>Game Reward</small><b>20/day</b></div>
        </div>

        <div className="v9-action">
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
    <section className="v9-page glass v9-card">
      <h2>⛏️ Expedition Mining</h2>
      <p>Server-based 24h mining · Nova-X1 = 24 SPNX / day</p>
      <div className="v9-progress"><span><i style={{ width: `${progress}%` }} /></span><b>{progress}%</b></div>
      <div className="v9-grid">
        <div><small>Remaining</small><b>{time(m.remainingMs || 86400000)}</b></div>
        <div><small>Earned</small><b>{fmt(m.minedSoFar || 0)}</b></div>
        <div><small>Cycle Reward</small><b>{fmt(m.reward || 24)}</b></div>
        <div><small>Speed</small><b>{fmt(m.speedPerHour || 1, 2)} SPNX/h</b></div>
        <div><small>Fleet Bonus</small><b>+{m.fleetBonus || 0}%</b></div>
        <div><small>Halving</small><b>Phase {m.phase || 1}</b></div>
      </div>
      <div className="v9-two-buttons">
        <button disabled={loading || m.active || m.claimable} onClick={startMining}>🚀 START</button>
        <button disabled={loading || !m.claimable} onClick={claimMining}>🎁 CLAIM</button>
      </div>
    </section>
  );
}

function MissionsPage({ setUser }) {
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
    <section className="v9-page glass v9-card">
      <h2>⭐ Space Missions</h2>
      <p>{notice}</p>
      {missions.map((m) => (
        <button key={m.id} className={m.status?.completed ? 'v9-mission done' : 'v9-mission'} disabled={m.status?.completed || busy === m.id} onClick={() => claim(m)}>
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
    <section className="v9-page glass v9-card">
      <h2>👥 Fleet Friends</h2>
      <p>Your referral link automatically registers new captains into your Fleet.</p>
      <div className="v9-invite">
        <small>Your Fleet Code</small><b>{code}</b>
        <input readOnly value={link} />
        <div className="v9-two-buttons"><button onClick={copy}>📋 Copy</button><button onClick={share}>📤 Share</button></div>
      </div>
      <div className="v9-grid">
        <div><small>Total Invites</small><b>{user.referrals?.length || 0}</b></div>
        <div><small>Active Fleet</small><b>{user.activeFleet || 0}</b></div>
        <div><small>Fleet Bonus</small><b>+{user.fleetBonus || 0}%</b></div>
        <div><small>Fleet Rank</small><b>Captain</b></div>
      </div>
    </section>
  );
}

function RankingPage({ user }) {
  const tabs = ['Mining', 'Fleet', 'Game'];
  return (
    <section className="v9-page glass v9-card">
      <h2>🏆 Galaxy Ranking</h2>
      <p>Mining, Fleet and Game rankings.</p>
      <div className="ranking-tabs">{tabs.map((t) => <span key={t}>{t}</span>)}</div>
      {[user, { firstName: 'Nova Pilot', balance: 9800 }, { firstName: 'Mars Captain', balance: 7600 }].map((u, i) => (
        <div className="v9-rank" key={i}><b>#{i + 1}</b><span>{u.firstName}</span><strong>{fmt(u.balance)}</strong></div>
      ))}
    </section>
  );
}

function WalletPage({ user, setUser }) {
  const [wallet, setWallet] = useState(user.solanaWallet || '');
  const [notice, setNotice] = useState('상장 후 공식 교환 기간에 1 SPNX Point = 1 SPNX 비율로 전환 신청할 수 있습니다.');
  const [saving, setSaving] = useState(false);
  const cleanWallet = wallet.trim();
  const isValidLength = cleanWallet.length >= 32 && cleanWallet.length <= 48;
  const currentBalance = Number(user.balance || 0);

  async function save() {
    if (!isValidLength) {
      setNotice('Solana 지갑 주소는 보통 32~48자입니다. 주소를 다시 확인해 주세요.');
      return;
    }
    setSaving(true);
    try {
      const data = await api('/api/wallet/save', { method: 'POST', body: JSON.stringify({ wallet: cleanWallet }) });
      setUser(data.user || { ...user, solanaWallet: cleanWallet });
      setNotice('Solana 지갑이 등록되었습니다. 상장 후 교환 신청 시 이 지갑으로 SPNX가 지급됩니다.');
    } catch (e) {
      setNotice(e.message || 'Wallet save failed');
    } finally {
      setSaving(false);
    }
  }

  async function requestConversion() {
    try {
      const data = await api('/api/conversion/request', { method: 'POST', body: JSON.stringify({ amount: currentBalance }) });
      setNotice(`교환 신청 완료: ${fmt(data.request.amount)} SPNX · KYC/관리자 검토 대기`);
    } catch (e) {
      setNotice(e.message);
    }
  }

  return (
    <section className="v9-page glass v9-card wallet-page">
      <h2>👛 Space Vault</h2>
      <p>{notice}</p>
      <div className="conversion-box">
        <div><small>Current SPNX Point</small><b>{fmt(currentBalance)}</b></div>
        <div><small>Conversion Rate</small><b>1 Point = 1 SPNX</b></div>
        <div><small>You Will Receive</small><b>{fmt(currentBalance)} SPNX</b></div>
      </div>
      <div className="wallet-register-box">
        <h3>🔗 Solana Wallet Registration</h3>
        <p>Phantom 또는 Solflare 지갑의 Solana 주소를 등록하세요.</p>
        <label>Solana Wallet Address</label>
        <input className="v9-input wallet-input" placeholder="예: 9xA...7Fd" value={wallet} onChange={(e) => setWallet(e.target.value)} />
        <div className={cleanWallet ? (isValidLength ? 'wallet-status ok' : 'wallet-status warn') : 'wallet-status'}>
          {cleanWallet ? (isValidLength ? '✅ Address format looks valid' : '⚠️ Address length looks unusual') : '등록된 지갑이 없습니다.'}
        </div>
        <button className="v9-wide-btn" onClick={save} disabled={saving}>{saving ? 'Saving...' : user.solanaWallet ? 'Update Wallet' : 'Save Wallet'}</button>
      </div>
      <div className="conversion-policy">
        <h3>🔄 Token Conversion Policy</h3>
        <ul>
          <li>상장 전에는 앱에서 SPNX Point만 적립됩니다.</li>
          <li>상장 후 공식 교환 기간에 1 SPNX Point = 1 SPNX로 교환됩니다.</li>
          <li>KYC 및 보안 검토를 통과한 계정만 교환 신청이 가능합니다.</li>
          <li>교환 완료 후 해당 Point는 차감되며 중복 교환은 불가능합니다.</li>
        </ul>
        <button className="v9-wide-btn" onClick={requestConversion}>Request Conversion</button>
      </div>
    </section>
  );
}

function KycPage({ user, setUser }) {
  const [form, setForm] = useState({ name: '', country: '', note: '' });
  const [notice, setNotice] = useState('Token conversion requires KYC/security review.');

  async function submit() {
    try {
      const data = await api('/api/kyc/submit', { method: 'POST', body: JSON.stringify(form) });
      if (data.user) setUser(data.user);
      setNotice('KYC submitted. 관리자 검토 대기 중입니다.');
    } catch (e) {
      setNotice(e.message);
    }
  }

  return (
    <section className="v9-page glass v9-card">
      <h2>🛡️ KYC Center</h2>
      <p>{notice}</p>
      <div className="v9-grid">
        <div><small>Status</small><b>{user.kyc?.status || 'not_submitted'}</b></div>
        <div><small>Purpose</small><b>Conversion</b></div>
      </div>
      <input className="v9-input" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <input className="v9-input" placeholder="Country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
      <input className="v9-input" placeholder="Note (optional)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
      <button className="v9-wide-btn" onClick={submit}>Submit KYC</button>
    </section>
  );
}

function GamePage({ user, setUser }) {
  const todayKey = new Date().toISOString().slice(0, 10);
  const gameState = user.gameReward || { date: todayKey, earnedToday: 0, bestScore: 0 };
  const earnedToday = gameState.date === todayKey ? Number(gameState.earnedToday || 0) : 0;
  const remaining = Math.max(0, 20 - earnedToday);
  const [score, setScore] = useState(0);
  const [notice, setNotice] = useState('Nova-X1 Asteroid Miner · 하루 최대 20 SPNX Point');

  async function collectCrystal() {
    const nextScore = score + 10;
    setScore(nextScore);
    if (remaining <= 0) {
      setNotice('오늘 게임 보상 20 SPNX를 모두 받았습니다. 점수 랭킹은 계속 기록됩니다.');
      return;
    }
    const reward = Math.min(5, remaining);
    try {
      const data = await api('/api/game/reward', { method: 'POST', body: JSON.stringify({ score: nextScore, reward }) });
      if (data.user) setUser(data.user);
      setNotice(`💎 Crystal collected! +${reward} SPNX`);
    } catch {
      setNotice(`Preview reward: +${reward} SPNX · 서버 연결 후 실제 지급됩니다.`);
    }
  }

  return (
    <section className="v9-page glass v9-card game-page">
      <h2>🎮 Nova-X1 Game</h2>
      <p>{notice}</p>
      <div className="game-limit-box">
        <div><small>Daily Game Reward</small><b>{earnedToday}/20 SPNX</b></div>
        <div><small>Remaining</small><b>{remaining} SPNX</b></div>
      </div>
      <div className="v9-game">
        <CinematicShip active />
        <span className="asteroid a" />
        <span className="asteroid b" />
        <span className="crystal c1">💎</span>
        <span className="crystal c2">💎</span>
        <span className="boost">⚡</span>
      </div>
      <div className="v9-two-buttons">
        <button onClick={collectCrystal}>💎 Collect Crystal</button>
        <button onClick={() => { setScore(0); setNotice('Game reset. Try again.'); }}>Reset</button>
      </div>
      <div className="v9-rank"><b>Score</b><span>SPNX Crystal</span><strong>{score}</strong></div>
    </section>
  );
}

function MorePage() {
  return (
    <section className="v9-page glass v9-card">
      <h2>••• Command Menu</h2>
      <div className="policy-panel">
        <h3>🔄 Listing Conversion Policy</h3>
        <p>상장 후 공식 교환 기간에 1 SPNX Point = 1 SPNX 비율로 교환됩니다.</p>
        <p>KYC, 보안 검토, Solana 지갑 등록이 필요합니다.</p>
      </div>
      <button className="v9-wide-btn" onClick={() => { window.location.href = '/admin'; }}>Admin Dashboard</button>
      <button className="v9-wide-btn" onClick={() => openUrl(OFFICIAL_LINKS.website)}>Official Website</button>
      <button className="v9-wide-btn" onClick={() => openUrl(OFFICIAL_LINKS.telegram)}>Telegram</button>
      <button className="v9-wide-btn" onClick={() => openUrl(OFFICIAL_LINKS.x)}>X Twitter</button>
      <button className="v9-wide-btn" onClick={() => openUrl(OFFICIAL_LINKS.discord)}>Discord</button>
      <button className="v9-wide-btn" onClick={() => openUrl(OFFICIAL_LINKS.youtube)}>YouTube</button>
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
    ['kyc', '🛡️', 'KYC'],
    ['game', '🎮', 'Game'],
    ['more', '•••', 'More'],
  ];
  return (
    <nav className="v9-nav">
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
  const [user, setUserState] = useState(defaultUser());
  const [loading, setLoading] = useState(false);

  function setUser(u) {
    setUserState({ ...defaultUser(), ...u });
  }

  async function sync() {
    try {
      const data = await api('/api/session', { method: 'POST', body: JSON.stringify({}) });
      if (data.user) setUser(data.user);
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
      if (data.user) setUser(data.user);
    } catch (e) { alert(e.message); }
    setLoading(false);
  }

  async function claimMining() {
    setLoading(true);
    try {
      const data = await api('/api/mining/claim', { method: 'POST', body: JSON.stringify({}) });
      if (data.user) setUser(data.user);
    } catch (e) { alert(e.message); }
    setLoading(false);
  }

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

  return (
    <div className="v9-shell">
      <AppHeader user={user} />
      {page}
      <BottomNav tab={tab} setTab={setTab} />
    </div>
  );
}
