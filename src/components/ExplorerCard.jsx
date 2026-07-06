export default function ExplorerCard() {
  return (
    <section className="explorer-card glass">
      <div className="core-icon">
        <div className="core-inner" />
      </div>

      <div className="explorer-info">
        <h2>Space Explorer</h2>
        <span>Lv.7 Captain</span>
      </div>

      <div className="experience">
        <div className="experience-head">
          <span>Experience</span>
          <b>850 / 1000 EXP</b>
        </div>
        <div className="exp-track"><i /></div>
      </div>
    </section>
  );
}
