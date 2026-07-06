function formatBalance(value) {
  return Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 6,
    maximumFractionDigits: 6,
  });
}

export default function TabPage({ tab, user, notice }) {
  if (tab === 'home') {
    return null;
  }

  if (tab === 'mining') {
    return (
      <section className="page-card glass">
        <h2>⛏️ Mining Center</h2>
        <p>24시간 채굴을 시작하고 완료 후 SPNX를 Claim 하세요.</p>
        <div className="page-stats">
          <div><small>Balance</small><b>{formatBalance(user?.balance || 0)}</b></div>
          <div><small>Daily Reward</small><b>{Number(user?.mining?.reward || 30).toFixed(2)} SPNX</b></div>
          <div><small>Status</small><b>{user?.mining?.active ? 'Active' : 'Ready'}</b></div>
        </div>
      </section>
    );
  }

  if (tab === 'missions') {
    return (
      <section className="page-card glass">
        <h2>⭐ Missions</h2>
        <p>미션 완료 시 추가 SPNX 포인트를 받을 수 있습니다.</p>
        <div className="mission-list">
          <button>Join Telegram +100 SPNX</button>
          <button>Follow X +100 SPNX</button>
          <button>Daily Check-in +30 SPNX</button>
          <button>Invite 3 Friends +300 SPNX</button>
        </div>
      </section>
    );
  }

  if (tab === 'friends') {
    return (
      <section className="page-card glass">
        <h2>👥 Friends</h2>
        <p>친구 초대 링크를 공유하고 추천 보상을 받을 수 있습니다.</p>
        <div className="invite-box">
          <small>Your invite code</small>
          <b>SPNX-{String(user?.id || 'GUEST').slice(-6).toUpperCase()}</b>
        </div>
        <p className="sub-text">추천인 시스템은 다음 단계에서 서버 보상과 연결됩니다.</p>
      </section>
    );
  }

  if (tab === 'ranking') {
    return (
      <section className="page-card glass">
        <h2>🏆 Ranking</h2>
        <div className="rank-list">
          <div><b>1</b><span>Nova Captain</span><strong>52,100 SPNX</strong></div>
          <div><b>2</b><span>Space Miner</span><strong>41,800 SPNX</strong></div>
          <div><b>3</b><span>{user?.firstName || 'You'}</span><strong>{formatBalance(user?.balance || 0)}</strong></div>
        </div>
      </section>
    );
  }

  if (tab === 'wallet') {
    return (
      <section className="page-card glass">
        <h2>👛 Wallet</h2>
        <p>현재는 포인트 지갑입니다. 이후 Solana 지갑 연결을 추가할 수 있습니다.</p>
        <div className="wallet-balance">
          <small>SPNX Points</small>
          <b>{formatBalance((user?.balance || 0) + (user?.mining?.minedSoFar || 0))}</b>
        </div>
        <button className="connect-wallet">Connect Wallet</button>
      </section>
    );
  }

  return (
    <section className="page-card glass">
      <h2>••• More</h2>
      <p>{notice}</p>
      <div className="more-grid">
        <button>Notice</button>
        <button>Whitepaper</button>
        <button>Community</button>
        <button>Settings</button>
      </div>
    </section>
  );
}
