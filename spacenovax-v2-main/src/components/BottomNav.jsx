const navItems = [
  { key: 'home', icon: '🏠', label: 'Home' },
  { key: 'mining', icon: '⛏️', label: 'Mining' },
  { key: 'missions', icon: '⭐', label: 'Missions' },
  { key: 'friends', icon: '👥', label: 'Friends' },
  { key: 'ranking', icon: '🏆', label: 'Ranking' },
  { key: 'wallet', icon: '👛', label: 'Wallet' },
  { key: 'more', icon: '•••', label: 'More' },
];

export default function BottomNav({ activeTab, onChange }) {
  return (
    <nav className="bottom-nav">
      {navItems.map((item) => (
        <button
          key={item.key}
          type="button"
          className={activeTab === item.key ? 'active' : ''}
          onClick={() => onChange(item.key)}
        >
          <span>{item.icon}</span>
          <b>{item.label}</b>
        </button>
      ))}
    </nav>
  );
}
