const navItems = [
  { icon: '🏠', label: 'Home' },
  { icon: '⛏️', label: 'Mining' },
  { icon: '⭐', label: 'Missions' },
  { icon: '👥', label: 'Friends' },
  { icon: '🏆', label: 'Ranking' },
  { icon: '👛', label: 'Wallet' },
  { icon: '•••', label: 'More' },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      {navItems.map((item, index) => (
        <button key={item.label} className={index === 0 ? 'active' : ''}>
          <span>{item.icon}</span>
          <b>{item.label}</b>
        </button>
      ))}
    </nav>
  );
}
