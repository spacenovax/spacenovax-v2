import { useEffect, useState } from 'react';
import SpaceCanvas from './SpaceCanvas.jsx';
import Ship from './Ship.jsx';

function AnimatedBalance() {
  const [balance, setBalance] = useState(15250.0);

  useEffect(() => {
    const timer = setInterval(() => {
      setBalance((value) => value + 0.000018 + Math.random() * 0.000012);
    }, 1800);

    return () => clearInterval(timer);
  }, []);

  return balance.toLocaleString('en-US', {
    minimumFractionDigits: 6,
    maximumFractionDigits: 6,
  });
}

export default function MiningHero() {
  return (
    <section className="hero-card glass">
      <SpaceCanvas />

      <div className="balance-block">
        <div className="label">TOTAL BALANCE</div>
        <h2><AnimatedBalance /></h2>
        <h3>SPNX Points</h3>
        <span className="usd">≈ $18.43 USD</span>
      </div>

      <div className="phase-pill"><i /> Phase 1</div>
      <div className="planet planet-main" />
      <div className="planet planet-small" />
      <div className="float reward-one">+0.000032 💎</div>
      <div className="float reward-two">+0.000041</div>

      <Ship />

      <div className="today-card">
        <span>⛏️</span>
        <div>
          <small>Today's Mining</small>
          <b>+30.000000<br />SPNX</b>
        </div>
      </div>

      <div className="boost-card">
        <div><small>Mining Speed</small><b>1.25x</b></div>
        <div><small>Miners</small><b>86</b></div>
        <div><small>Power</small><b>2.80x</b></div>
      </div>
    </section>
  );
}
