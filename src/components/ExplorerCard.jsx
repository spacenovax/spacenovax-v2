export default function ExplorerCard({ user }) {
  const exp = user?.exp ?? 850;
  const level = user?.level ?? 7;
  const name = user?.firstName || 'Space Explorer';

  return (
    <section className="explorer-card glass">
      <div className="core-icon">
        {user?.photoUrl ? <img src={user.photoUrl} alt="" /> : <div className="core-inner" />}
      </div>

      <div className="explorer-info">
        <h2>{name}</h2>
        <span>Lv.{level} Captain</span>
      </div>

      <div className="experience">
        <div className="experience-head">
          <span>Experience</span>
          <b>{exp} / 1000 EXP</b>
        </div>
        <div className="exp-track"><i style={{ width: `${Math.min(100, exp / 10)}%` }} /></div>
      </div>
    </section>
  );
}
