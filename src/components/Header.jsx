export default function Header({ user }) {
  return (
    <header className="header">
      <div className="header-row">
        <img className="official-logo" src="/spnx-official-logo.jpg" alt="SPNX" />
        <div className="brand">
          <h1>SpaceNovaX <span className="version">V6</span></h1>
          <p>Explore. Earn. Beyond.</p>
        </div>
      </div>

      <button className="genesis-btn" type="button">🚀 Genesis Launch</button>

      <div className="user-strip">
        <span>{user?.isGuest ? 'Guest Mode' : 'Telegram Connected'}</span>
        <b>{user?.firstName || 'Space Explorer'}</b>
      </div>
    </header>
  );
}
