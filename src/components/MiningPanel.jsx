function formatTime(ms) {
  if (!ms || ms <= 0) return '00:00:00';
  const total = Math.floor(ms / 1000);
  const h = String(Math.floor(total / 3600)).padStart(2, '0');
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export default function MiningPanel({ user }) {
  const mining = user?.mining || {};

  return (
    <section className="mining-grid">
      <div className="timer-card glass">
        <h3>{mining.active ? 'MINING ACTIVE' : 'MINING READY'}</h3>
        <strong>{mining.active ? formatTime(mining.remainingMs) : '24:00:00'}</strong>
        <span>{mining.active ? `${Math.round((mining.progress || 0) * 100)}% Completed` : 'Tap Start Mining'}</span>
      </div>

      <div className="reward-card glass">
        <div className="gem">💎</div>
        <div>
          <span>Daily Reward</span>
          <strong>{Number(mining.reward || 30).toFixed(2)}</strong>
          <small>SPNX / 24h</small>
        </div>
      </div>
    </section>
  );
}
