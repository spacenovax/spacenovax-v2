import SpaceCanvas from './SpaceCanvas.jsx';
import Ship from './Ship.jsx';

function formatBalance(value) {
  return Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 6,
    maximumFractionDigits: 6,
  });
}

function formatTime(ms) {
  if (!ms || ms <= 0) return '00:00:00';
  const total = Math.floor(ms / 1000);
  const h = String(Math.floor(total / 3600)).padStart(2, '0');
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export default function MiningHero({ user, onStart, onClaim, loading }) {
  const mining = user?.mining || {};
  const liveBalance = (user?.balance || 0) + (mining.minedSoFar || 0);
  const canClaim = mining.claimable;

  return (
    <section className="hero-card glass">
      <SpaceCanvas />

      <div className="hero-top">
        <div className="balance-block">
          <div className="label">TOTAL BALANCE</div>
          <h2>{formatBalance(liveBalance)}</h2>
          <h3>SPNX Points</h3>
          <span className="usd">≈ $18.43 USD</span>
        </div>
        <div className="phase-pill"><i /> Phase 1</div>
      </div>
      <div className="planet planet-main" />
      <div className="planet planet-small" />
      <div className="float reward-one">+0.000032 💎</div>
      <div className="float reward-two">+0.000041</div>

      <Ship />

      <div className="today-card">
        <span>⛏️</span>
        <div>
          <small>{mining.active ? 'Mining Active' : 'Today\'s Mining'}</small>
          <b>+{Number(mining.reward || 30).toFixed(6)}<br />SPNX</b>
        </div>
      </div>

      <div className="boost-card">
        <div><small>Mining Speed</small><b>{Number(user?.speed || 1.25).toFixed(2)}x</b></div>
        <div><small>Miners</small><b>{user?.miners ?? 86}</b></div>
        <div><small>Power</small><b>{Number(user?.power || 2.8).toFixed(2)}x</b></div>
      </div>

      <div className="mining-action">
        <div>
          <small>{mining.active ? 'Remaining' : 'Ready'}</small>
          <b>{mining.active ? formatTime(mining.remainingMs) : '24:00:00'}</b>
        </div>
        <button onClick={canClaim ? onClaim : onStart} disabled={loading || (mining.active && !canClaim)}>
          {loading ? 'Loading...' : canClaim ? 'Claim SPNX' : mining.active ? 'Mining...' : 'Start Mining'}
        </button>
      </div>
    </section>
  );
}
