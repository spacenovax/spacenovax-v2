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

export default function FinalHomeHero({ user, onStart, onClaim, loading }) {
  const mining = user?.mining || {};
  const isActive = Boolean(mining.active);
  const canClaim = Boolean(mining.claimable);

  return (
    <section className="final-home-hero">
      <div className="final-phase">
        <span className="phase-orb" />
        Phase {mining.phase || 1}
      </div>

      <div className="balance-zone">
        <div className="balance-label">TOTAL BALANCE</div>
        <div className="balance-number">{formatAmount(user?.balance || 15250, 6)}</div>
        <div className="balance-title">SPNX Points</div>
        <div className="usd-pill">≈ $18.43 USD</div>
      </div>

      <div className="space-scene">
        <div className="planet planet-big" />
        <div className="planet planet-small" />
        <div className="meteor meteor-a" />
        <div className="meteor meteor-b" />

        <div className={isActive ? "hero-ship mining" : "hero-ship"}>
          <div className="ship-body">
            <div className="ship-nose" />
            <div className="ship-cockpit" />
            <div className="ship-wing wing-left" />
            <div className="ship-wing wing-right">
              <span>SPNX</span>
            </div>
            <div className="ship-engine engine-left" />
            <div className="ship-engine engine-center" />
            <div className="ship-engine engine-right" />
          </div>
          <div className="engine-beams">
            <i /><i /><i />
          </div>
        </div>
      </div>

      <div className="today-mining-card">
        <div className="mining-icon">⛏️</div>
        <div>
          <small>Today's Mining</small>
          <b>+{formatAmount(mining.reward || 24, 6)}</b>
          <span>SPNX</span>
        </div>
        <div className="growth-icon">↗</div>
      </div>

      <div className="hero-stats">
        <div>
          <small>Mining Speed</small>
          <b>{formatAmount(mining.speedPerHour || 1.25, 2)}x</b>
        </div>
        <div>
          <small>Miners</small>
          <b>86</b>
        </div>
        <div>
          <small>Power</small>
          <b>2.80x</b>
        </div>
      </div>

      <div className="network-card">
        <div>
          <span className="network-icon">⚡</span>
          <p>Network Power</p>
          <b>125.68 TH/s</b>
        </div>
        <div>
          <span className="coin-icon">🪙</span>
          <p>Total Mined</p>
          <b>2,845,260 SPNX</b>
        </div>
      </div>

      <div className="claim-zone">
        <div>
          <small>{canClaim ? 'Claim Ready' : isActive ? 'Next Claim' : 'Ready'}</small>
          <b>{canClaim ? '00:00:00' : formatTime(mining.remainingMs || mining.durationMs || 86400000)}</b>
        </div>
        <button
          type="button"
          disabled={loading || isActive}
          onClick={canClaim ? onClaim : onStart}
          className={canClaim ? 'claim-ready' : ''}
        >
          {canClaim ? '🎁 Claim' : isActive ? 'Mining...' : 'Start Mining'}
        </button>
      </div>
    </section>
  );
}
