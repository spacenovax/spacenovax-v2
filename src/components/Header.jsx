import Logo from './Logo.jsx';

export default function Header() {
  return (
    <header className="header">
      <div className="header-row">
        <Logo />
        <div className="brand">
          <h1>SpaceNovaX <span className="version">V2</span></h1>
          <p>Explore. Earn. Beyond.</p>
        </div>
        <button className="genesis-btn" type="button">🚀 Genesis Launch</button>
      </div>
    </header>
  );
}
