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
  return <section className="admin-login glass"><div className="admin-login-logo"><img src="/spnx-official-logo.jpg" alt="SPNX" /></div><h2>SpaceNovaX Admin</h2><p>{notice}</p><form onSubmit={login}><input placeholder="Admin ID" value={form.id} onChange={(e)=>setForm({...form,id:e.target.value})}/><input placeholder="Password" type="password" value={form.password} onChange={(e)=>setForm({...form,password:e.target.value})}/><button type="submit">Login</button></form></section>;
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
  const [settings, setSettings] = useState({});
  const [queue, setQueue] = useState([]);
  const [simulator, setSimulator] = useState(null);
  const [ranking, setRanking] = useState(null);
  const [missions, setMissions] = useState([]);
  const [notice, setNotice] = useState('Checking admin session...');
  const [search, setSearch] = useState('');
  const [pointForm, setPointForm] = useState({ userId: '', amount: '100', reason: 'admin bonus' });
  const [kycForm, setKycForm] = useState({ userId: '', status: 'approved', note: '' });
  const [settingsForm, setSettingsForm] = useState({ convertEnabled: false, minConvert: 5000 });

  async function loadAdmin() {
    try {
      const [a,b,c,d,e,f,g,h,i,j] = await Promise.all([
        adminFetch('/api/admin/stats'),
        adminFetch('/api/admin/users/search?q=' + encodeURIComponent(search)),
        adminFetch('/api/admin/logs'),
        adminFetch('/api/admin/live-monitor'),
        adminFetch('/api/admin/risk'),
        adminFetch('/api/admin/settings'),
        adminFetch('/api/admin/convert-queue'),
        adminFetch('/api/admin/distribution-simulator'),
        adminFetch('/api/admin/ranking/full'),
        adminFetch('/api/admin/missions')
      ]);
      setStats(a.stats); setUsers(b.users || []); setLogs(c.logs || []); setMonitor(d.monitor); setRiskData(e); setSettings(f.settings || {}); setQueue(g.queue || []); setSimulator(h.simulator); setRanking(i.ranking); setMissions(j.missions || []);
      setSettingsForm({ convertEnabled: Boolean(f.settings?.convertEnabled), minConvert: f.settings?.minConvert || 5000 });
      setNotice('Admin V7 Ultimate dashboard connected.');
    } catch (e) { setNotice(e.message); if (e.message.includes('required')) { clearToken(); setAdmin(null); } }
  }

  async function checkSession() { try { const data = await adminFetch('/api/admin/me'); setAdmin(data.admin); await loadAdmin(); } catch { clearToken(); setAdmin(null); setNotice('Admin login required.'); } }
  async function givePoints(e) { e.preventDefault(); try { await adminFetch('/api/admin/points', { method:'POST', body: JSON.stringify(pointForm) }); setPointForm({ userId:'', amount:'100', reason:'admin bonus' }); loadAdmin(); } catch(e){ setNotice(e.message); } }
  async function updateKyc(e) { e.preventDefault(); try { await adminFetch('/api/admin/kyc/update', { method:'POST', body: JSON.stringify(kycForm) }); setKycForm({ userId:'', status:'approved', note:'' }); loadAdmin(); } catch(e){ setNotice(e.message); } }
  async function toggleBan(user) { try { await adminFetch('/api/admin/user/update', { method:'POST', body: JSON.stringify({ userId:user.id, banned:!user.banned }) }); loadAdmin(); } catch(e){ setNotice(e.message); } }
  async function updateSettings(e) { e.preventDefault(); try { await adminFetch('/api/admin/settings/update', { method:'POST', body: JSON.stringify(settingsForm) }); loadAdmin(); } catch(e){ setNotice(e.message); } }
  async function updateConvert(id, status) { const txHash = status === 'completed' ? (prompt('TX Hash 입력') || '') : ''; try { await adminFetch('/api/admin/convert/update', { method:'POST', body: JSON.stringify({ id, status, txHash }) }); loadAdmin(); } catch(e){ setNotice(e.message); } }
  async function updateMission(m, field, value) { try { await adminFetch('/api/admin/mission/update', { method:'POST', body: JSON.stringify({ id:m.id, [field]:value }) }); loadAdmin(); } catch(e){ setNotice(e.message); } }
  async function logout() { try { await adminFetch('/api/admin/logout', { method:'POST', body:'{}' }); } catch {} clearToken(); setAdmin(null); }

  useEffect(()=>{ checkSession(); }, []);
  useEffect(()=>{ if(!admin) return; const t=setInterval(loadAdmin,15000); return ()=>clearInterval(t); }, [admin, search]);

  if (!admin) return <AdminLogin onLogin={(a)=>{ setAdmin(a); loadAdmin(); }} />;

  const tabs = ['dashboard','users','kyc','risk','missions','ranking','convert','settings','logs'];

  return <section className="admin-page glass">
    <div className="admin-head"><div><h2>🛠 SpaceNovaX Admin V7</h2><p>{notice}</p><small>Logged in: {admin.id} · {admin.role}</small></div><div className="admin-actions"><button onClick={loadAdmin}>Refresh</button><button onClick={logout}>Logout</button></div></div>
    <div className="admin-tabs">{tabs.map((x)=><button key={x} className={tab===x?'active':''} onClick={()=>setTab(x)}>{x.toUpperCase()}</button>)}</div>

    {tab==='dashboard' && <><div className="admin-stats">
      <div><small>Total Users</small><b>{stats?.totalUsers ?? '-'}</b></div><div><small>Online 10m</small><b>{monitor?.onlineUsers ?? '-'}</b></div><div><small>Active Mining</small><b>{stats?.activeMining ?? '-'}</b></div><div><small>Total Points</small><b>{fmt(stats?.totalBalance)} SPNX</b></div><div><small>New Users 24h</small><b>{monitor?.todayNewUsers ?? '-'}</b></div><div><small>Mission Claims</small><b>{stats?.todayMissions ?? '-'}</b></div><div><small>High Risk</small><b>{monitor?.highRisk ?? '-'}</b></div><div><small>Review</small><b>{monitor?.review ?? '-'}</b></div><div><small>Trusted</small><b>{monitor?.trusted ?? '-'}</b></div><div><small>Mining Phase</small><b>Phase {stats?.phase ?? '-'}</b></div><div><small>Pool Used</small><b>{((stats?.miningPoolRatio || 0)*100).toFixed(4)}%</b></div><div><small>Claims</small><b>{stats?.todayClaims ?? '-'}</b></div>
    </div><form className="admin-form" onSubmit={givePoints}><h3>Manual Point Control</h3><input placeholder="User ID" value={pointForm.userId} onChange={(e)=>setPointForm({...pointForm,userId:e.target.value})}/><input placeholder="Amount" type="number" value={pointForm.amount} onChange={(e)=>setPointForm({...pointForm,amount:e.target.value})}/><input placeholder="Reason" value={pointForm.reason} onChange={(e)=>setPointForm({...pointForm,reason:e.target.value})}/><button type="submit">Give Points</button></form></>}

    {tab==='users' && <div className="admin-users"><h3>Users</h3><div className="admin-search"><input placeholder="Search user, telegram, wallet, KYC..." value={search} onChange={(e)=>setSearch(e.target.value)}/><button onClick={loadAdmin}>Search</button></div>{users.map((u,idx)=><div className="admin-user-row admin-user-rich" key={u.id}><div><b>#{idx+1} {u.firstName}</b><small>{u.id}</small><small>Telegram: {u.telegramId || 'Guest'} · @{u.username || '-'}</small><small>Fleet {u.activeFleet} · Bonus +{u.fleetBonus}% · {u.fleetGrade}</small><small>Wallet: {u.solanaWallet || 'Not connected'}</small><small>KYC: {u.kyc?.status || 'not_submitted'} · {u.banned ? 'BANNED' : 'ACTIVE'}</small></div><div className="admin-user-side"><strong>{fmt(u.balance)} SPNX</strong><RiskBadge risk={u.risk}/><button onClick={()=>toggleBan(u)}>{u.banned?'Unban':'Ban'}</button></div></div>)}</div>}

    {tab==='kyc' && <div className="admin-users"><h3>KYC Center</h3><form className="admin-form" onSubmit={updateKyc}><input placeholder="User ID" value={kycForm.userId} onChange={(e)=>setKycForm({...kycForm,userId:e.target.value})}/><select value={kycForm.status} onChange={(e)=>setKycForm({...kycForm,status:e.target.value})}><option value="not_submitted">Not Submitted</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select><input placeholder="KYC note" value={kycForm.note} onChange={(e)=>setKycForm({...kycForm,note:e.target.value})}/><button>Update KYC</button></form>{users.map((u)=><div className="admin-user-row" key={`kyc-${u.id}`}><div><b>{u.firstName}</b><small>{u.id}</small><small>KYC: {u.kyc?.status || 'not_submitted'} · Trust {u.risk?.trustScore}</small></div><RiskBadge risk={u.risk}/></div>)}</div>}

    {tab==='risk' && <div className="admin-users"><h3>Risk Center</h3><div className="risk-summary"><div><small>High Risk</small><b>{riskData?.highRisk?.length || 0}</b></div><div><small>Review</small><b>{riskData?.review?.length || 0}</b></div><div><small>Trusted</small><b>{riskData?.trusted?.length || 0}</b></div></div>{(riskData?.all || []).map((u)=><div className="admin-user-row admin-user-rich" key={`risk-${u.id}`}><div><b>{u.firstName}</b><small>{u.id}</small><small>Flags: {(u.risk?.flags || []).join(', ') || 'none'}</small><small>Trust: {u.risk?.trustScore} · KYC: {u.risk?.kycStatus}</small></div><RiskBadge risk={u.risk}/></div>)}</div>}

    {tab==='missions' && <div className="admin-users"><h3>Mission Manager</h3>{missions.map((m)=><div className="admin-user-row admin-user-rich" key={m.id}><div><b>{m.icon} {m.title}</b><small>{m.id} · {m.type}</small><small>URL: {m.url || '-'}</small></div><div className="admin-user-side"><input className="small-input" type="number" value={m.reward} onChange={(e)=>updateMission(m,'reward',Number(e.target.value))}/><button onClick={()=>updateMission(m,'enabled',!m.enabled)}>{m.enabled?'ON':'OFF'}</button></div></div>)}</div>}

    {tab==='ranking' && <div className="admin-users"><h3>Ranking Center</h3><h4>Global Top</h4>{(ranking?.global || []).slice(0,20).map((u,idx)=><div className="admin-user-row" key={`g-${u.id}`}><div><b>#{idx+1} {u.firstName}</b><small>{u.id}</small></div><strong>{fmt(u.balance)} SPNX</strong></div>)}<h4>Fleet Top</h4>{(ranking?.fleet || []).slice(0,20).map((u,idx)=><div className="admin-user-row" key={`f-${u.id}`}><div><b>#{idx+1} {u.firstName}</b><small>{u.id}</small></div><strong>{u.activeFleet} Fleet</strong></div>)}</div>}

    {tab==='convert' && <div className="admin-users"><h3>Convert / Distribution Queue</h3><div className="risk-summary"><div><small>Recipients</small><b>{simulator?.recipients || 0}</b></div><div><small>Total Amount</small><b>{fmt(simulator?.totalAmount || 0)}</b></div><div><small>Est. SOL Fee</small><b>{simulator?.estimatedSolFee || 0}</b></div></div><p className="admin-empty">{simulator?.note}</p>{queue.map((q)=><div className="admin-user-row admin-user-rich" key={q.id}><div><b>{q.id}</b><small>User: {q.userId}</small><small>Wallet: {q.wallet}</small><small>Status: {q.status}</small></div><div className="admin-user-side"><strong>{fmt(q.amount)} SPNX</strong><button onClick={()=>updateConvert(q.id,'approved')}>Approve</button><button onClick={()=>updateConvert(q.id,'rejected')}>Reject</button><button onClick={()=>updateConvert(q.id,'completed')}>Complete</button></div></div>)}</div>}

    {tab==='settings' && <div className="admin-users"><h3>System Settings</h3><form className="admin-form" onSubmit={updateSettings}><label className="check-row"><input type="checkbox" checked={settingsForm.convertEnabled} onChange={(e)=>setSettingsForm({...settingsForm,convertEnabled:e.target.checked})}/> Convert Enabled after listing</label><input type="number" placeholder="Minimum Convert" value={settingsForm.minConvert} onChange={(e)=>setSettingsForm({...settingsForm,minConvert:Number(e.target.value)})}/><button>Save Settings</button></form><pre className="admin-json">{JSON.stringify(settings,null,2)}</pre></div>}

    {tab==='logs' && <div className="admin-logs"><h3>Audit Logs</h3>{logs.map((log,i)=><div className="admin-log-row" key={`${log.at}-${i}`}><b>{log.type}</b><small>{new Date(log.at).toLocaleString()}</small><code>{JSON.stringify(log)}</code></div>)}</div>}
  </section>;
}
