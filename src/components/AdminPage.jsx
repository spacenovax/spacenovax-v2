import { useEffect, useState } from 'react';

function fmt(v) {
  return Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function AdminPage() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [notice, setNotice] = useState('Loading admin dashboard...');
  const [form, setForm] = useState({ userId: '', amount: '100', reason: 'admin bonus' });

  async function loadAdmin() {
    try {
      const [a, b] = await Promise.all([fetch('/api/admin/stats'), fetch('/api/admin/users')]);
      const statsData = await a.json();
      const usersData = await b.json();
      if (!statsData.ok || !usersData.ok) throw new Error('Admin API error');
      setStats(statsData.stats);
      setUsers(usersData.users);
      setNotice('Admin connected.');
    } catch (e) {
      setNotice(e.message);
    }
  }

  async function givePoints(e) {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || 'Failed');
      setNotice(`Points updated: ${data.user.firstName}`);
      setForm({ userId: '', amount: '100', reason: 'admin bonus' });
      loadAdmin();
    } catch (e) {
      setNotice(e.message);
    }
  }

  useEffect(() => { loadAdmin(); }, []);

  return (
    <section className="admin-page glass">
      <div className="admin-head">
        <div>
          <h2>🛠 SpaceNovaX Admin V6</h2>
          <p>{notice}</p>
        </div>
        <button type="button" onClick={loadAdmin}>Refresh</button>
      </div>

      <div className="admin-stats">
        <div><small>Total Users</small><b>{stats?.totalUsers ?? '-'}</b></div>
        <div><small>Active Mining</small><b>{stats?.activeMining ?? '-'}</b></div>
        <div><small>Total Points</small><b>{fmt(stats?.totalBalance)} SPNX</b></div>
        <div><small>Today Sessions</small><b>{stats?.todaySessions ?? '-'}</b></div>
        <div><small>Mining Starts</small><b>{stats?.todayMiningStarts ?? '-'}</b></div>
        <div><small>Claims</small><b>{stats?.todayClaims ?? '-'}</b></div>
        <div><small>Mission Claims</small><b>{stats?.todayMissions ?? '-'}</b></div>
        <div><small>Mining Phase</small><b>Phase {stats?.phase ?? '-'}</b></div>
        <div><small>Pool Used</small><b>{((stats?.miningPoolRatio || 0) * 100).toFixed(4)}%</b></div>
      </div>

      <form className="admin-form" onSubmit={givePoints}>
        <h3>Manual Point Control</h3>
        <input placeholder="User ID" value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} />
        <input placeholder="Amount" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        <input placeholder="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        <button type="submit">Give Points</button>
      </form>

      <div className="admin-users">
        <h3>Users / Top Miners</h3>
        {users.length === 0 && <p className="admin-empty">아직 사용자가 없습니다. 앱에서 접속하면 자동 생성됩니다.</p>}
        {users.map((user, idx) => (
          <div className="admin-user-row" key={user.id}>
            <div>
              <b>#{idx + 1} {user.firstName}</b>
              <small>{user.id}</small>
              <small>Fleet {user.activeFleet} · Bonus +{user.fleetBonus}% · {user.fleetGrade}</small>
            </div>
            <strong>{fmt(user.balance)} SPNX</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
