import { useEffect, useState } from 'react';

function fmt(v) { return Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
const getToken = () => localStorage.getItem('spnx_admin_token') || '';
const setToken = (t) => localStorage.setItem('spnx_admin_token', t);
const clearToken = () => localStorage.removeItem('spnx_admin_token');

async function adminFetch(path, options = {}) {
  const res = await fetch(path, { ...options, headers: { 'Content-Type':'application/json', Authorization:`Bearer ${getToken()}`, ...(options.headers || {}) } });
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
      const res = await fetch('/api/admin/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || 'Login failed');
      setToken(data.token); onLogin(data.admin);
    } catch (error) { setNotice(error.message); }
  }
  return (
    <section className="admin-login glass">
      <div className="admin-login-logo"><img src="/spnx-official-logo.jpg" alt="SPNX" /></div>
      <h2>SpaceNovaX Admin</h2><p>{notice}</p>
      <form onSubmit={login}>
        <input placeholder="Admin ID" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} />
        <input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <button type="submit">Login</button>
      </form>
    </section>
  );
}

function RiskBadge({ risk }) {
  const level = risk?.riskLevel || 'normal';
  return <span className={`risk-badge risk-${level}`}>{level} · {risk?.riskScore ?? 0}</span>;
}

export default function AdminPage() {
  const [admin, setAdmin] = useState(null);
  const [tab, setTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [monitor, setMonitor] = useState(null);
  const [users, setUsers] = useState([]);
  const [riskData, setRiskData] = useState(null);
  const [logs, setLogs] = useState([]);
  const [notice, setNotice] = useState('Checking admin session...');
  const [search, setSearch] = useState('');
  const [pointForm, setPointForm] = useState({ userId: '', amount: '100', reason: 'admin bonus' });
  const [kycForm, setKycForm] = useState({ userId: '', status: 'approved', note: '' });

  async function loadAdmin() {
    try {
      const [a,b,c,d,e] = await Promise.all([
        adminFetch('/api/admin/stats'),
        adminFetch('/api/admin/users/search?q=' + encodeURIComponent(search)),
        adminFetch('/api/admin/logs'),
        adminFetch('/api/admin/live-monitor'),
        adminFetch('/api/admin/risk')
      ]);
      setStats(a.stats); setUsers(b.users || []); setLogs(c.logs || []); setMonitor(d.monitor); setRiskData(e);
      setNotice('Admin V6.2 dashboard connected.');
    } catch (e) {
      setNotice(e.message);
      if (e.message.includes('required')) { clearToken(); setAdmin(null); }
    }
  }

  async function checkSession() {
    try { const data = await adminFetch('/api/admin/me'); setAdmin(data.admin); await loadAdmin(); }
    catch { clearToken(); setAdmin(null); setNotice('Admin login required.'); }
  }

  async function givePoints(e) {
    e.preventDefault();
    try {
      const data = await adminFetch('/api/admin/points', { method:'POST', body: JSON.stringify(pointForm) });
      setNotice(`Points updated: ${data.user.firstName}`);
      setPointForm({ userId: '', amount: '100', reason: 'admin bonus' });
      loadAdmin();
    } catch (e) { setNotice(e.message); }
  }

  async function updateKyc(e) {
    e.preventDefault();
    try {
      const data = await adminFetch('/api/admin/kyc/update', { method:'POST', body: JSON.stringify(kycForm) });
      setNotice(`KYC updated: ${data.user.firstName}`);
      setKycForm({ userId: '', status: 'approved', note: '' });
      loadAdmin();
    } catch (e) { setNotice(e.message); }
  }

  async function toggleBan(user) {
    try {
      await adminFetch('/api/admin/user/update', { method:'POST', body: JSON.stringify({ userId: user.id, banned: !user.banned }) });
      loadAdmin();
    } catch (e) { setNotice(e.message); }
  }

  async function logout() {
    try { await adminFetch('/api/admin/logout', { method:'POST', body:'{}' }); } catch {}
    clearToken(); setAdmin(null); setNotice('Logged out.');
  }

  useEffect(() => { checkSession(); }, []);
  useEffect(() => { if (!admin) return; const t = setInterval(loadAdmin, 15000); return () => clearInterval(t); }, [admin, search]);

  if (!admin) return <AdminLogin onLogin={(a) => { setAdmin(a); loadAdmin(); }} />;

  return (
    <section className="admin-page glass">
      <div className="admin-head">
        <div><h2>🛠 SpaceNovaX Admin V6.2</h2><p>{notice}</p><small>Logged in: {admin.id} · {admin.role}</small></div>
        <div className="admin-actions"><button onClick={loadAdmin}>Refresh</button><button onClick={logout}>Logout</button></div>
      </div>

      <div className="admin-tabs">
        {['dashboard','users','kyc','risk','logs'].map((x) => <button key={x} className={tab===x?'active':''} onClick={() => setTab(x)}>{x.toUpperCase()}</button>)}
      </div>

      {tab === 'dashboard' && <>
        <div className="admin-stats">
          <div><small>Total Users</small><b>{stats?.totalUsers ?? '-'}</b></div>
          <div><small>Online 10m</small><b>{monitor?.onlineUsers ?? '-'}</b></div>
          <div><small>Active Mining</small><b>{stats?.activeMining ?? '-'}</b></div>
          <div><small>Total Points</small><b>{fmt(stats?.totalBalance)} SPNX</b></div>
          <div><small>New Users 24h</small><b>{monitor?.todayNewUsers ?? '-'}</b></div>
          <div><small>Mission Claims</small><b>{stats?.todayMissions ?? '-'}</b></div>
          <div><small>High Risk</small><b>{monitor?.highRisk ?? '-'}</b></div>
          <div><small>Review</small><b>{monitor?.review ?? '-'}</b></div>
          <div><small>Trusted</small><b>{monitor?.trusted ?? '-'}</b></div>
          <div><small>Mining Phase</small><b>Phase {stats?.phase ?? '-'}</b></div>
          <div><small>Pool Used</small><b>{((stats?.miningPoolRatio || 0)*100).toFixed(4)}%</b></div>
          <div><small>Claims</small><b>{stats?.todayClaims ?? '-'}</b></div>
        </div>
        <form className="admin-form" onSubmit={givePoints}>
          <h3>Manual Point Control</h3>
          <input placeholder="User ID" value={pointForm.userId} onChange={(e)=>setPointForm({...pointForm,userId:e.target.value})}/>
          <input placeholder="Amount" type="number" value={pointForm.amount} onChange={(e)=>setPointForm({...pointForm,amount:e.target.value})}/>
          <input placeholder="Reason" value={pointForm.reason} onChange={(e)=>setPointForm({...pointForm,reason:e.target.value})}/>
          <button type="submit">Give Points</button>
        </form>
      </>}

      {tab === 'users' && <div className="admin-users">
        <h3>Users / Top Miners</h3>
        <div className="admin-search"><input placeholder="Search user, telegram, wallet, KYC..." value={search} onChange={(e)=>setSearch(e.target.value)}/><button onClick={loadAdmin}>Search</button></div>
        {users.map((user,idx)=><div className="admin-user-row admin-user-rich" key={user.id}>
          <div><b>#{idx+1} {user.firstName}</b><small>{user.id}</small><small>Telegram: {user.telegramId || 'Guest'} · @{user.username || '-'}</small><small>Fleet {user.activeFleet} · Bonus +{user.fleetBonus}% · {user.fleetGrade}</small><small>Wallet: {user.solanaWallet || 'Not connected'}</small><small>KYC: {user.kyc?.status || 'not_submitted'} · {user.banned ? 'BANNED' : 'ACTIVE'}</small></div>
          <div className="admin-user-side"><strong>{fmt(user.balance)} SPNX</strong><RiskBadge risk={user.risk}/><button onClick={()=>toggleBan(user)}>{user.banned?'Unban':'Ban'}</button></div>
        </div>)}
      </div>}

      {tab === 'kyc' && <div className="admin-users">
        <h3>KYC Center</h3>
        <form className="admin-form" onSubmit={updateKyc}>
          <input placeholder="User ID" value={kycForm.userId} onChange={(e)=>setKycForm({...kycForm,userId:e.target.value})}/>
          <select value={kycForm.status} onChange={(e)=>setKycForm({...kycForm,status:e.target.value})}>
            <option value="not_submitted">Not Submitted</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
          </select>
          <input placeholder="KYC note" value={kycForm.note} onChange={(e)=>setKycForm({...kycForm,note:e.target.value})}/>
          <button type="submit">Update KYC</button>
        </form>
        {users.map((user)=><div className="admin-user-row" key={`kyc-${user.id}`}><div><b>{user.firstName}</b><small>{user.id}</small><small>KYC: {user.kyc?.status || 'not_submitted'} · Trust {user.risk?.trustScore}</small></div><RiskBadge risk={user.risk}/></div>)}
      </div>}

      {tab === 'risk' && <div className="admin-users">
        <h3>Risk Center</h3>
        <div className="risk-summary"><div><small>High Risk</small><b>{riskData?.highRisk?.length || 0}</b></div><div><small>Review</small><b>{riskData?.review?.length || 0}</b></div><div><small>Trusted</small><b>{riskData?.trusted?.length || 0}</b></div></div>
        {(riskData?.all || []).map((user)=><div className="admin-user-row admin-user-rich" key={`risk-${user.id}`}><div><b>{user.firstName}</b><small>{user.id}</small><small>Risk Flags: {(user.risk?.flags || []).join(', ') || 'none'}</small><small>Trust: {user.risk?.trustScore} · KYC: {user.risk?.kycStatus}</small></div><RiskBadge risk={user.risk}/></div>)}
      </div>}

      {tab === 'logs' && <div className="admin-logs"><h3>Audit Logs</h3>{logs.map((log,i)=><div className="admin-log-row" key={`${log.at}-${i}`}><b>{log.type}</b><small>{new Date(log.at).toLocaleString()}</small><code>{JSON.stringify(log)}</code></div>)}</div>}
    </section>
  );
}
