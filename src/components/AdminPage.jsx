import { useEffect, useState } from 'react';

function fmt(v) {
  return Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
const getToken = () => localStorage.getItem('spnx_admin_token') || '';
const setToken = (t) => localStorage.setItem('spnx_admin_token', t);
const clearToken = () => localStorage.removeItem('spnx_admin_token');

async function adminFetch(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      ...(options.headers || {})
    }
  });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.message || 'Admin API failed');
  return data;
}

function AdminLogin({ onLogin }) {
  const [form, setForm] = useState({ id: 'admin', password: '' });
  const [notice, setNotice] = useState('Admin login required.');

  async function login(e) {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || 'Login failed');
      setToken(data.token);
      onLogin(data.admin);
    } catch (error) {
      setNotice(error.message);
    }
  }

  return (
    <section className="admin-login glass">
      <div className="admin-login-logo"><img src="/spnx-official-logo.jpg" alt="SPNX" /></div>
      <h2>SpaceNovaX Admin</h2>
      <p>{notice}</p>
      <form onSubmit={login}>
        <input placeholder="Admin ID" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} />
        <input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <button type="submit">Login</button>
      </form>
    </section>
  );
}

export default function AdminPage() {
  const [admin, setAdmin] = useState(null);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [notice, setNotice] = useState('Checking admin session...');
  const [form, setForm] = useState({ userId: '', amount: '100', reason: 'admin bonus' });

  async function loadAdmin() {
    try {
      const [a,b,c] = await Promise.all([
        adminFetch('/api/admin/stats'),
        adminFetch('/api/admin/users'),
        adminFetch('/api/admin/logs')
      ]);
      setStats(a.stats); setUsers(b.users); setLogs(c.logs || []);
      setNotice('Admin protected dashboard connected.');
    } catch (e) {
      setNotice(e.message);
      if (e.message.includes('required')) { clearToken(); setAdmin(null); }
    }
  }

  async function checkSession() {
    try {
      const data = await adminFetch('/api/admin/me');
      setAdmin(data.admin);
      loadAdmin();
    } catch {
      clearToken();
      setAdmin(null);
      setNotice('Admin login required.');
    }
  }

  async function givePoints(e) {
    e.preventDefault();
    try {
      const data = await adminFetch('/api/admin/points', { method: 'POST', body: JSON.stringify(form) });
      setNotice(`Points updated: ${data.user.firstName}`);
      setForm({ userId: '', amount: '100', reason: 'admin bonus' });
      loadAdmin();
    } catch (e) { setNotice(e.message); }
  }

  async function logout() {
    try { await adminFetch('/api/admin/logout', { method: 'POST', body: '{}' }); } catch {}
    clearToken(); setAdmin(null); setNotice('Logged out.');
  }

  useEffect(() => { checkSession(); }, []);

  if (!admin) return <AdminLogin onLogin={(a) => { setAdmin(a); loadAdmin(); }} />;

  return (
    <section className="admin-page glass">
      <div className="admin-head">
        <div>
          <h2>🛠 SpaceNovaX Admin V6.1</h2>
          <p>{notice}</p>
          <small>Logged in: {admin.id} · {admin.role}</small>
        </div>
        <div className="admin-actions">
          <button type="button" onClick={loadAdmin}>Refresh</button>
          <button type="button" onClick={logout}>Logout</button>
        </div>
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
        {users.map((user, idx) => (
          <div className="admin-user-row" key={user.id}>
            <div>
              <b>#{idx + 1} {user.firstName}</b>
              <small>{user.id}</small>
              <small>Fleet {user.activeFleet} · Bonus +{user.fleetBonus}% · {user.fleetGrade}</small>
              <small>Wallet: {user.solanaWallet || 'Not connected'}</small>
            </div>
            <strong>{fmt(user.balance)} SPNX</strong>
          </div>
        ))}
      </div>

      <div className="admin-logs">
        <h3>Audit Logs</h3>
        {logs.map((log, i) => (
          <div className="admin-log-row" key={`${log.at}-${i}`}>
            <b>{log.type}</b>
            <small>{new Date(log.at).toLocaleString()}</small>
            <code>{JSON.stringify(log)}</code>
          </div>
        ))}
      </div>
    </section>
  );
}
