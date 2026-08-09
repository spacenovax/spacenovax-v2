import { useEffect, useState } from 'react';

const OFFICIAL_MISSIONS = [
  { id: 'website', icon: '🌐', title: 'Visit SpaceNovaX Website', type: 'one_time', reward: 100, url: 'https://spacenovax.com', action: 'OPEN' },
  { id: 'telegram', icon: '📢', title: 'Join Telegram', type: 'one_time', reward: 300, url: 'https://t.me/spacesnovax', action: 'JOIN' },
  { id: 'discord', icon: '💬', title: 'Join Discord', type: 'one_time', reward: 300, url: 'https://discord.gg/rxVNWMC8e8', action: 'JOIN' },
  { id: 'x', icon: '𝕏', title: 'Follow X', type: 'one_time', reward: 300, url: 'https://x.com/spacenovaxteam', action: 'FOLLOW' },
  { id: 'youtube_subscribe', icon: '▶️', title: 'Subscribe YouTube', type: 'one_time', reward: 300, url: 'https://youtube.com/@spacenovaxteam', action: 'SUBSCRIBE' },
  { id: 'youtube_like', icon: '👍', title: 'YouTube Like', type: 'one_time', reward: 100, url: 'https://youtube.com/@spacenovaxteam', action: 'LIKE' },
  { id: 'daily_checkin', icon: '🎁', title: 'Daily Check-in', type: 'daily', reward: 20, url: '', action: 'CHECK-IN' },
];

function fmt(value, digits = 6) {
  return Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: digits,
  });
}

function clock(ms) {
  const total = Math.max(0, Math.floor(Number(ms || 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
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

export default function CinematicHome({ user, onStart, onClaim, loading, onUserUpdate }) {
  const mining = user?.mining || {};
  const isMining = Boolean(mining.active);
  const canClaim = Boolean(mining.claimable);
  const [missions, setMissions] = useState(OFFICIAL_MISSIONS);
  const [notice, setNotice] = useState('1회 미션과 Daily Check-in 보상을 받을 수 있습니다.');
  const [busyMission, setBusyMission] = useState('');

  async function loadMissions() {
    try {
      const data = await api('/api/missions');
      setMissions(data.missions || OFFICIAL_MISSIONS);
    } catch {
      setMissions(OFFICIAL_MISSIONS);
    }
  }

  useEffect(() => { loadMissions(); }, []);

  function openOfficial(url) {
    if (!url) return;
    const tg = window.Telegram?.WebApp;
    if (tg?.openLink) tg.openLink(url);
    else window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function completeMission(mission) {
    if (mission.status?.completed || busyMission) return;
    setBusyMission(mission.id);
    if (mission.url) openOfficial(mission.url);

    setTimeout(async () => {
      try {
        const data = await api('/api/missions/claim', {
          method: 'POST',
          body: JSON.stringify({ missionId: mission.id }),
        });
        setNotice(`✨ Mission Complete! +${data.reward} SPNX`);
        if (onUserUpdate && data.user) onUserUpdate(data.user);
        await loadMissions();
      } catch (error) {
        setNotice(error.message || 'Mission failed');
      } finally {
        setBusyMission('');
      }
    }, mission.url ? 650 : 0);
  }

  const oneTime = missions.filter((m) => m.type !== 'daily');
  const daily = missions.filter((m) => m.type === 'daily');

  return (
    <main className="spnx-single-home">
      <section className="profile-strip glass">
        <div className="profile-core" />
        <div>
          <h3>Space Explorer</h3>
          <span>Lv.7 Captain</span>
        </div>
        <div className="profile-exp">
          <small>Experience</small>
          <b>850 / 1000 EXP</b>
          <i><em /></i>
        </div>
      </section>

      <section className="cinematic-hero">
        <div className="twinkle-stars" />
        <span className="shooting-star s1" />
        <span className="shooting-star s2" />

        <div className="phase-badge"><i />Phase {mining.phase || 1}</div>

        <div className="hero-balance">
          <small>TOTAL BALANCE</small>
          <strong>{fmt(user?.balance || 15250, 6)}</strong>
          <h1>SPNX Points</h1>
          <p>≈ $18.43 USD</p>
        </div>

        <div className={isMining ? 'cinema-ship mining' : 'cinema-ship'}>
          <div className="ship-hull">
            <div className="ship-glass" />
            <div className="wing left-wing" />
            <div className="wing right-wing"><b>SPNX</b></div>
            <div className="engine e1" />
            <div className="engine e2" />
            <div className="engine e3" />
          </div>
          <div className="flames"><i /><i /><i /></div>
          {isMining && (
            <>
              <span className="point-pop p1">+0.000032</span>
              <span className="point-pop p2">+0.000041</span>
              <span className="point-pop p3">+0.000028</span>
            </>
          )}
        </div>

        <div className="today-card">
          <span>⛏️</span>
          <div>
            <small>Today's Mining</small>
            <b>+{fmt(mining.reward || 24, 6)}</b>
            <em>SPNX</em>
          </div>
          <span className="trend">↗</span>
        </div>

        <div className="stat-bar">
          <div><small>Mining Speed</small><b>{fmt(mining.speedPerHour || 1, 2)}x</b></div>
          <div><small>Miners</small><b>86</b></div>
          <div><small>Power</small><b>2.80x</b></div>
        </div>

        <div className="network-row">
          <div><span>⚡</span><small>Network Power</small><b>125.68 TH/s</b></div>
          <div><span>🪙</span><small>Total Mined</small><b>2,845,260 SPNX</b></div>
        </div>

        <div className="mining-cta">
          <div>
            <small>{canClaim ? 'Claim Ready' : isMining ? 'Next Claim' : 'Ready'}</small>
            <b>{canClaim ? '00:00:00' : clock(mining.remainingMs || mining.durationMs || 86400000)}</b>
          </div>
          <button
            type="button"
            disabled={loading || isMining}
            className={canClaim ? 'claim-ready' : ''}
            onClick={canClaim ? onClaim : onStart}
          >
            {canClaim ? '🎁 CLAIM' : isMining ? 'MINING...' : '🚀 START MINING'}
          </button>
        </div>
      </section>

      <section className="mission-center-v73 glass">
        <h2>⭐ Mission Center</h2>
        <p>{notice}</p>

        <h4>🚀 One-Time Missions</h4>
        {[...oneTime, ...daily].map((mission) => (
          <button
            key={mission.id}
            type="button"
            className={mission.status?.completed ? 'mission-v73 completed' : 'mission-v73'}
            disabled={busyMission === mission.id || mission.status?.completed}
            onClick={() => completeMission(mission)}
          >
            <span>{mission.icon} {mission.title}</span>
            <em>{mission.status?.completed ? (mission.type === 'daily' ? '✅ Claimed Today' : '✅ Completed') : busyMission === mission.id ? 'Checking...' : mission.action}</em>
            <b>+{mission.reward} SPNX</b>
          </button>
        ))}
      </section>
    </main>
  );
}
