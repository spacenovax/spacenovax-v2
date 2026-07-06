export default function MiningPanel() {
  return (
    <section className="mining-grid">
      <div className="timer-card glass">
        <h3>MINING READY</h3>
        <strong>24:00:00</strong>
        <span>Time Remaining</span>
      </div>

      <div className="reward-card glass">
        <div className="gem">💎</div>
        <div>
          <span>Daily Reward</span>
          <strong>30.000000</strong>
          <small>SPNX / 24h</small>
        </div>
      </div>
    </section>
  );
}
