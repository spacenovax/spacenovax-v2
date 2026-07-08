import { useEffect, useState } from 'react';
import AdminPage from './AdminPage.jsx';

function formatBalance(value) {
  return Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

async function postApi(path, body = {}) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.message || 'Request failed');
  return data;
}

function MissionCenter({ user }) {
  const [missions, setMissions] = useState([]);
  const [notice, setNotice] = useState('');

  async function loadMissions() {
    const res = await fetch('/api/missions');
    const data = await res.json();
    if (data.ok) setMissions(data.missions);
  }

  async function claimMission(mission) {
    try {
      if (mission.url) window.open(mission.url, '_blank');
      const data = await postApi('/api/missions/claim', { missionId: mission.id });
      setNotice(data.message);
      setTimeout(() => window.location.reload(), 500);
    } catch (e) {
      setNotice(e.message);
    }
  }

  useEffect(() => { loadMissions(); }, []);

  return (
    <section className="page-card glass">
      <h2>⭐ Mission Center</h2>
      <p>{notice || '1회 미션과 Daily Check-in 보상을 받을 수 있습니다.'}</p>
      <div className="mission-list">
        {missions.map((mission) => {
          const claimed = user?.missions?.[mission.id]?.claimed;
          return (
            <button key={mission.id} disabled={claimed} onClick={() => claimMission(mission)}>
              <span>{mission.icon} {mission.title}</span>
              <b>{claimed ? 'Completed' : `+${mission.reward} SPNX`}</b>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function RankingPage({ user }) {
  const [top, setTop] = useState([]);
  const [me, setMe] = useState(null);

  async function loadRanking() {
    const r = await fetch('/api/ranking');
    const d = await r.json();
    if (d.ok) setTop(d.top || []);

    try {
      const mine = await postApi('/api/ranking/me');
      setMe(mine);
    } catch {}
  }

  useEffect(() => { loadRanking(); }, []);

  return (
    <section className="page-card glass">
      <h2>🏆 Top Miners</h2>
      <p>Global Top 100과 내 순위를 확인할 수 있습니다.</p>

      <div className="my-rank-card">
        <small>Your Rank</small>
        <b>#{me?.rank || '-'}</b>
        <span>{user?.firstName || 'Space Explorer'} · {formatBalance(user?.balance)} SPNX</span>
      </div>

      <div className="rank-list">
        {top.slice(0, 20).map((item, idx) => (
          <div key={item.id}>
            <b>{idx + 1}</b>
            <span>{item.firstName}</span>
            <strong>{formatBalance(item.balance)}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function FleetPage({ user }) {
  return (
    <section className="page-card glass">
      <h2>👥 Space Fleet</h2>
      <p>Pi 스타일의 추천 보너스를 SpaceNovaX 방식으로 개선했습니다.</p>

      <div className="page-stats">
        <div><small>Active Fleet</small><b>{user?.activeFleet || 0}</b></div>
        <div><small>Fleet Bonus</small><b>+{user?.fleetBonus || 0}%</b></div>
        <div><small>Fleet Grade</small><b>{user?.fleetGrade || 'Explorer Fleet'}</b></div>
      </div>

      <div className="invite-box">
        <small>Your Invite Code</small>
        <b>{user?.id || 'guest'}</b>
      </div>
      <p className="sub-text">추천 가입자가 최근 7일 이내 채굴하면 활성 Fleet으로 계산됩니다. 최대 보너스는 +20%입니다.</p>
    </section>
  );
}

function WalletPage({ user }) {
  const [wallet, setWallet] = useState(user?.solanaWallet || '');
  const [notice, setNotice] = useState('상장 전에는 SPNX Point만 표시됩니다.');

  async function saveWallet() {
    try {
      const data = await postApi('/api/wallet/save', { wallet });
      setNotice('Wallet saved.');
      setTimeout(() => window.location.reload(), 500);
    } catch (e) {
      setNotice(e.message);
    }
  }

  return (
    <section className="page-card glass">
      <h2>👛 Wallet</h2>
      <p>{notice}</p>

      <div className="wallet-balance">
        <small>SPNX Point</small>
        <b>{formatBalance(user?.balance || 0)}</b>
      </div>

      <div className="wallet-balance">
        <small>Point → Token</small>
        <b>1 : 1 · Coming Soon</b>
      </div>

      <input className="wallet-input" placeholder="Solana wallet address" value={wallet} onChange={(e) => setWallet(e.target.value)} />
      <button className="connect-wallet" onClick={saveWallet}>Save Wallet</button>
    </section>
  );
}

export default function TabPage({ tab, user, notice }) {
  if (tab === 'home') return null;

  if (tab === 'mining') {
    return (
      <section className="page-card glass">
        <h2>⛏️ Mining Center</h2>
        <p>현재 Phase {user?.mining?.phase || 1}, 기본 보상 {user?.mining?.baseReward || 30} SPNX / 24h</p>
        <div className="page-stats">
          <div><small>Daily Reward</small><b>{formatBalance(user?.mining?.reward || 30)} SPNX</b></div>
          <div><small>Fleet Bonus</small><b>+{user?.fleetBonus || 0}%</b></div>
          <div><small>Status</small><b>{user?.mining?.active ? 'Active' : 'Ready'}</b></div>
        </div>
      </section>
    );
  }

  if (tab === 'missions') return <MissionCenter user={user} />;
  if (tab === 'friends') return <FleetPage user={user} />;
  if (tab === 'ranking') return <RankingPage user={user} />;
  if (tab === 'wallet') return <WalletPage user={user} />;

  if (tab === 'more') {
    return (
      <>
        <section className="page-card glass">
          <h2>••• More</h2>
          <p>{notice}</p>
          <div className="more-grid">
            <button>Profile</button>
            <button>FAQ</button>
            <button>Support</button>
            <button>Settings</button>
            <button onClick={() => { window.location.href = '/admin'; }}>Admin Dashboard</button>
          </div>
        </section>
        <AdminPage />
      </>
    );
  }

  return null;
}
