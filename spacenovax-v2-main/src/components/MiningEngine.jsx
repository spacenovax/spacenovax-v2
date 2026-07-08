function formatAmount(value, digits = 6) {
  return Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: digits,
  });
}

function formatTime(ms) {
  const total = Math.max(0, Math.floor(Number(ms || 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

export default function MiningEngine({ user, onStart, onClaim, loading }) {
  const mining = user?.mining || {};
  const progress = Math.round((mining.progress || 0) * 100);
  const isActive = Boolean(mining.active);
  const canClaim = Boolean(mining.claimable);

  return (
    <section className="mining-engine-card glass">
      <div className="mining-engine-head">
        <div>
          <h2>🚀 SpaceNovaX Mining</h2>
          <p>Server-based Mining Engine {mining.engineVersion || '1.0.0'}</p>
        </div>
        <span className={canClaim ? 'engine-status ready' : isActive ? 'engine-status active' : 'engine-status'}>
          {canClaim ? 'CLAIM READY' : isActive ? 'MINING ACTIVE' : 'READY'}
        </span>
      </div>

      <div className="mining-ship-wrap">
        <img className={isActive ? 'mining-ship mining-on' : 'mining-ship'} src="/spnx-official-logo.jpg" alt="SPNX" />
        <div className={isActive ? 'engine-flame engine-on' : 'engine-flame'} />
      </div>

      <div className="mining-progress">
        <div className="progress-top"><span>Progress</span><b>{progress}%</b></div>
        <div className="progress-bar"><i style={{ width: `${progress}%` }} /></div>
      </div>

      <div className="mining-grid">
        <div><small>Remaining</small><b>{formatTime(mining.remainingMs)}</b></div>
        <div><small>Speed</small><b>{formatAmount(mining.speedPerHour, 4)} / h</b></div>
        <div><small>Fleet Bonus</small><b>+{mining.fleetBonus || 0}%</b></div>
        <div><small>Halving</small><b>Phase {mining.phase || 1}</b></div>
        <div><small>Earned</small><b>{formatAmount(mining.minedSoFar, 6)}</b></div>
        <div><small>Cycle Reward</small><b>{formatAmount(mining.reward, 6)}</b></div>
      </div>

      {mining.sandbox && <div className="sandbox-banner">🧪 Sandbox Mining Mode: {Math.round((mining.durationMs || 300000) / 60000)} min test cycle</div>}

      <div className="mining-actions">
        <button type="button" disabled={loading || isActive || canClaim} onClick={onStart}>🚀 START MINING</button>
        <button type="button" disabled={loading || !canClaim} onClick={onClaim}>🎁 CLAIM</button>
      </div>
    </section>
  );
}
