import { useEffect, useState } from 'react';

const FALLBACK_MISSIONS = [
  { id: 'website', icon: '🌐', title: 'Visit SpaceNovaX Website', type: 'one_time', reward: 100, url: 'https://spacenovax.com', action: 'OPEN' },
  { id: 'telegram', icon: '📢', title: 'Join Telegram', type: 'one_time', reward: 300, url: 'https://t.me/spacesnovax', action: 'JOIN' },
  { id: 'discord', icon: '💬', title: 'Join Discord', type: 'one_time', reward: 300, url: 'https://discord.gg/rxVNWMC8e8', action: 'JOIN' },
  { id: 'x', icon: '𝕏', title: 'Follow X', type: 'one_time', reward: 300, url: 'https://x.com/spacenovaxteam', action: 'FOLLOW' },
  { id: 'youtube_subscribe', icon: '▶️', title: 'Subscribe YouTube', type: 'one_time', reward: 300, url: 'https://youtube.com/@spacenovaxteam', action: 'SUBSCRIBE' },
  { id: 'youtube_like', icon: '👍', title: 'YouTube Like', type: 'one_time', reward: 100, url: 'https://youtube.com/@spacenovaxteam', action: 'LIKE' },
  { id: 'daily_checkin', icon: '🎁', title: 'Daily Check-in', type: 'daily', reward: 20, url: '', action: 'CHECK-IN' },
];

async function api(path, options = {}) {
  const res = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.message || 'Mission API failed');
  return data;
}

export default function MissionCenter({ onUserUpdate }) {
  const [missions, setMissions] = useState(FALLBACK_MISSIONS);
  const [notice, setNotice] = useState('1회 미션은 평생 1번만, Daily Check-in은 하루 1번만 보상됩니다.');
  const [loadingId, setLoadingId] = useState('');

  async function loadMissions() {
    try { const data = await api('/api/missions'); setMissions(data.missions || FALLBACK_MISSIONS); }
    catch { setMissions(FALLBACK_MISSIONS); }
  }

  useEffect(() => { loadMissions(); }, []);

  function openMission(mission) {
    if (!mission.url) return;
    const tg = window.Telegram?.WebApp;
    if (tg?.openLink) tg.openLink(mission.url);
    else window.open(mission.url, '_blank', 'noopener,noreferrer');
  }

  async function completeMission(mission) {
    if (mission.status?.completed) return;
    setLoadingId(mission.id);
    if (mission.url) openMission(mission);
    setTimeout(async () => {
      try {
        const data = await api('/api/missions/claim', { method: 'POST', body: JSON.stringify({ missionId: mission.id }) });
        setNotice(`✨ Mission Complete! +${data.reward} SPNX`);
        if (onUserUpdate && data.user) onUserUpdate(data.user);
        await loadMissions();
      } catch (error) { setNotice(error.message); }
      finally { setLoadingId(''); }
    }, mission.url ? 700 : 0);
  }

  const oneTime = missions.filter((m) => m.type !== 'daily');
  const daily = missions.filter((m) => m.type === 'daily');
  const renderMission = (mission) => (
    <button type="button" className={mission.status?.completed ? 'mission-row completed' : 'mission-row'} key={mission.id} onClick={() => completeMission(mission)} disabled={loadingId === mission.id || mission.status?.completed}>
      <span className="mission-name"><i>{mission.icon}</i>{mission.title}</span>
      <span className="mission-action">{mission.status?.completed ? (mission.type === 'daily' ? '✅ Claimed Today' : '✅ Completed') : loadingId === mission.id ? 'Checking...' : mission.action}</span>
      <b>+{mission.reward} SPNX</b>
    </button>
  );

  return (
    <section className="mission-center glass">
      <div className="mission-head"><div><h2>⭐ Mission Center</h2><p>{notice}</p></div><span>Official Links</span></div>
      <div className="mission-group-title">🚀 One-Time Missions</div>
      <div className="mission-list">{oneTime.map(renderMission)}</div>
      <div className="mission-group-title daily">📅 Daily Mission</div>
      <div className="mission-list">{daily.map(renderMission)}</div>
    </section>
  );
}
