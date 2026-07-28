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
  const [miningEngine, setMiningEngine] = useState(null);
  const [operations, setOperations] = useState(null);
  const [conversionRuntime, setConversionRuntime] = useState(null);
  const [notice, setNotice] = useState('Checking admin session...');
  const [search, setSearch] = useState('');
  const [pointForm, setPointForm] = useState({ userId: '', amount: '100', reason: 'admin bonus' });
  const [settingsForm, setSettingsForm] = useState({
    convertEnabled: false,
    kycEnabled: false,
    autoPayoutEnabled: false,
    minConvert: 5000,
    gameRewardsEnabled: true,
    gameDailyLimit: 30,
    novaAiEnabled: true,
    novaDailyMessageLimit: 10,
    maintenanceMode: false,
  });

  async function loadAdmin() {
    try {
      const [a,b,c,d,e,f,g,h,i,j,k,l] = await Promise.all([
        adminFetch('/api/admin/stats'),
        adminFetch('/api/admin/users/search?q=' + encodeURIComponent(search)),
        adminFetch('/api/admin/logs'),
        adminFetch('/api/admin/live-monitor'),
        adminFetch('/api/admin/risk'),
        adminFetch('/api/admin/settings'),
        adminFetch('/api/admin/convert-queue'),
        adminFetch('/api/admin/distribution-simulator'),
        adminFetch('/api/admin/ranking/full'),
        adminFetch('/api/admin/missions'),
        adminFetch('/api/admin/mining/engine'),
        adminFetch('/api/admin/operations')
      ]);
      setStats(a.stats); setUsers(b.users || []); setLogs(c.logs || []); setMonitor(d.monitor); setRiskData(e); setSettings(f.settings || {}); setConversionRuntime(f.conversionRuntime || g.runtime || null); setQueue(g.queue || []); setSimulator(h.simulator); setRanking(i.ranking); setMissions(j.missions || []); setMiningEngine(k.engine); setOperations(l.operations || null);
      setSettingsForm({
        convertEnabled: Boolean(f.settings?.convertEnabled),
        kycEnabled: Boolean(f.settings?.kycEnabled),
        autoPayoutEnabled: Boolean(f.settings?.autoPayoutEnabled),
        minConvert: f.settings?.minConvert || 5000,
        gameRewardsEnabled: f.settings?.gameRewardsEnabled !== false,
        gameDailyLimit: f.settings?.gameDailyLimit || 30,
        novaAiEnabled: f.settings?.novaAiEnabled !== false,
        novaDailyMessageLimit: 10,
        maintenanceMode: Boolean(f.settings?.maintenanceMode),
      });
      setNotice('NOVA Command Admin V16.5 connected.');
    } catch (e) { setNotice(e.message); if (e.message.includes('required')) { clearToken(); setAdmin(null); } }
  }

  async function checkSession() { try { const data = await adminFetch('/api/admin/me'); setAdmin(data.admin); await loadAdmin(); } catch { clearToken(); setAdmin(null); setNotice('Admin login required.'); } }
  async function givePoints(e) { e.preventDefault(); try { await adminFetch('/api/admin/points', { method:'POST', body: JSON.stringify(pointForm) }); setPointForm({ userId:'', amount:'100', reason:'admin bonus' }); loadAdmin(); } catch(e){ setNotice(e.message); } }
  async function toggleBan(user) { try { await adminFetch('/api/admin/user/update', { method:'POST', body: JSON.stringify({ userId:user.id, banned:!user.banned }) }); loadAdmin(); } catch(e){ setNotice(e.message); } }
  async function updateSettings(e) { e.preventDefault(); try { await adminFetch('/api/admin/settings/update', { method:'POST', body: JSON.stringify(settingsForm) }); loadAdmin(); } catch(e){ setNotice(e.message); } }
  async function updateConvert(id, action) { try { await adminFetch('/api/admin/convert/update', { method:'POST', body: JSON.stringify({ id, action }) }); loadAdmin(); } catch(e){ setNotice(e.message); } }
  async function updateMission(m, field, value) { try { await adminFetch('/api/admin/mission/update', { method:'POST', body: JSON.stringify({ id:m.id, [field]:value }) }); loadAdmin(); } catch(e){ setNotice(e.message); } }
    async function updateMiningSettings(next) {
    try {
      await adminFetch('/api/admin/mining/settings', { method:'POST', body: JSON.stringify(next) });
      loadAdmin();
    } catch(e) { setNotice(e.message); }
  }

  async function resetMiner(userId) {
    try {
      await adminFetch('/api/admin/mining/force-reset', { method:'POST', body: JSON.stringify({ userId }) });
      loadAdmin();
    } catch(e) { setNotice(e.message); }
  }

  async function logout() { try { await adminFetch('/api/admin/logout', { method:'POST', body:'{}' }); } catch {} clearToken(); setAdmin(null); }

  useEffect(()=>{ checkSession(); }, []);
  useEffect(()=>{ if(!admin) return; const t=setInterval(loadAdmin,15000); return ()=>clearInterval(t); }, [admin, search]);

  if (!admin) return <AdminLogin onLogin={(a)=>{ setAdmin(a); loadAdmin(); }} />;

  const tabs = ['dashboard','nova','game','mining','users','kyc','risk','missions','ranking','convert','settings','logs'];

  return <section className="admin-page glass">
    <div className="admin-head"><div><h2>✦ NOVA Command Admin V16.5</h2><p>{notice}</p><small>Logged in: {admin.id} · {admin.role}</small></div><div className="admin-actions"><button onClick={loadAdmin}>Refresh</button><button onClick={logout}>Logout</button></div></div>
    <div className="admin-tabs">{tabs.map((x)=><button key={x} className={tab===x?'active':''} onClick={()=>setTab(x)}>{x.toUpperCase()}</button>)}</div>

    {tab==='dashboard' && <><div className="admin-stats">
      <div><small>Total Users</small><b>{stats?.totalUsers ?? '-'}</b></div><div><small>Online 10m</small><b>{monitor?.onlineUsers ?? '-'}</b></div><div><small>Active Mining</small><b>{stats?.activeMining ?? '-'}</b></div><div><small>Total Points</small><b>{fmt(stats?.totalBalance)} SPNX</b></div><div><small>New Users 24h</small><b>{monitor?.todayNewUsers ?? '-'}</b></div><div><small>Mission Claims</small><b>{stats?.todayMissions ?? '-'}</b></div><div><small>High Risk</small><b>{monitor?.highRisk ?? '-'}</b></div><div><small>Review</small><b>{monitor?.review ?? '-'}</b></div><div><small>Trusted</small><b>{monitor?.trusted ?? '-'}</b></div><div><small>Mining Phase</small><b>Phase {stats?.phase ?? '-'}</b></div><div><small>Pool Used</small><b>{((stats?.miningPoolRatio || 0)*100).toFixed(4)}%</b></div><div><small>Ledger Chain</small><b>{operations?.system?.ledgerIntegrity?.valid ? `VALID · ${operations.system.ledgerIntegrity.count}` : 'CHECK REQUIRED'}</b></div>
    </div><form className="admin-form" onSubmit={givePoints}><h3>Manual Point Control</h3><input placeholder="User ID" value={pointForm.userId} onChange={(e)=>setPointForm({...pointForm,userId:e.target.value})}/><input placeholder="Amount" type="number" value={pointForm.amount} onChange={(e)=>setPointForm({...pointForm,amount:e.target.value})}/><input placeholder="Reason" value={pointForm.reason} onChange={(e)=>setPointForm({...pointForm,reason:e.target.value})}/><button type="submit">Give Points</button></form></>}

    {tab==='nova' && <div className="admin-users">
      <h3>✦ NOVA AI Control</h3>
      <div className="admin-stats">
        <div><small>AI Core</small><b>{operations?.nova?.configured ? 'CONNECTED' : 'API KEY NEEDED'}</b></div>
        <div><small>Service</small><b>{operations?.nova?.enabled ? 'ONLINE' : 'OFFLINE'}</b></div>
        <div><small>Requests 24h</small><b>{operations?.nova?.requests24h || 0}</b></div>
        <div><small>Captains 24h</small><b>{operations?.nova?.uniqueCaptains24h || 0}</b></div>
        <div><small>Daily Limit</small><b>{operations?.nova?.dailyMessageLimit || 10}</b></div>
        <div><small>Model</small><b>{operations?.nova?.model || '-'}</b></div>
      </div>
      <div className="admin-command-panel">
        <p>NOVA AI 사용 상태와 일일 회원별 대화 한도를 통제합니다. API 키는 서버 환경변수에만 보관됩니다.</p>
        <button onClick={async()=>{ const next={...settingsForm,novaAiEnabled:!settingsForm.novaAiEnabled}; setSettingsForm(next); try{await adminFetch('/api/admin/settings/update',{method:'POST',body:JSON.stringify(next)});loadAdmin();}catch(e){setNotice(e.message);} }}>
          NOVA AI {settingsForm.novaAiEnabled ? 'DISABLE' : 'ENABLE'}
        </button>
      </div>
    </div>}

    {tab==='game' && <div className="admin-users">
      <h3>🚀 Game Reward Control</h3>
      <div className="admin-stats">
        <div><small>Reward Service</small><b>{operations?.game?.enabled ? 'ONLINE' : 'OFFLINE'}</b></div>
        <div><small>Sessions 24h</small><b>{operations?.game?.sessions24h || 0}</b></div>
        <div><small>Players 24h</small><b>{operations?.game?.uniquePlayers24h || 0}</b></div>
        <div><small>Rewards 24h</small><b>{fmt(operations?.game?.rewards24h || 0)}</b></div>
        <div><small>Top Score 24h</small><b>{operations?.game?.topScore24h || 0}</b></div>
        <div><small>Daily Limit</small><b>{operations?.game?.dailyLimit || 30} SPNX</b></div>
      </div>
      <div className="admin-command-panel">
        <p>게임 보상은 일일 한도를 초과할 수 없으며 모든 지급 내역이 감사 로그에 기록됩니다.</p>
        <button onClick={async()=>{ const next={...settingsForm,gameRewardsEnabled:!settingsForm.gameRewardsEnabled}; setSettingsForm(next); try{await adminFetch('/api/admin/settings/update',{method:'POST',body:JSON.stringify(next)});loadAdmin();}catch(e){setNotice(e.message);} }}>
          GAME REWARDS {settingsForm.gameRewardsEnabled ? 'DISABLE' : 'ENABLE'}
        </button>
      </div>
    </div>}


    {tab==='mining' && <div className="admin-users">
      <h3>⛏️ Mining Engine Monitor</h3>
      <div className="admin-stats">
        <div><small>Engine</small><b>{miningEngine?.version || '1.0.0'}</b></div>
        <div><small>Sandbox</small><b>{miningEngine?.sandbox ? 'ON' : 'OFF'}</b></div>
        <div><small>Active Miners</small><b>{miningEngine?.activeMiners || 0}</b></div>
        <div><small>Today Mined</small><b>{fmt(miningEngine?.todayMined || 0)}</b></div>
        <div><small>Pool Remaining</small><b>{fmt(miningEngine?.poolRemaining || 0)}</b></div>
        <div><small>Phase</small><b>{miningEngine?.phase || 1}</b></div>
      </div>
      <div className="mining-admin-controls">
        <button onClick={()=>updateMiningSettings({ miningSandboxEnabled: !miningEngine?.sandbox })}>Sandbox {miningEngine?.sandbox ? 'ON' : 'OFF'}</button>
        <button onClick={()=>updateMiningSettings({ miningSandboxMinutes: 5 })}>5 Min Test</button>
        <button onClick={()=>updateMiningSettings({ eventMultiplier: 1 })}>Event 1x</button>
      </div>
      {(miningEngine?.active || []).map((row)=><div className="admin-user-row admin-user-rich" key={row.user.id}>
        <div><b>{row.user.firstName}</b><small>{row.user.id}</small><small>Remaining: {Math.ceil((row.mining.remainingMs || 0)/1000)} sec · Earned {fmt(row.mining.minedSoFar)}</small></div>
        <div className="admin-user-side"><strong>{fmt(row.mining.reward)} SPNX</strong><button onClick={()=>resetMiner(row.user.id)}>Reset</button></div>
      </div>)}
    </div>}


    {tab==='users' && <div className="admin-users"><h3>Users</h3><div className="admin-search"><input placeholder="Search user, telegram, wallet, KYC..." value={search} onChange={(e)=>setSearch(e.target.value)}/><button onClick={loadAdmin}>Search</button></div>{users.map((u,idx)=><div className="admin-user-row admin-user-rich" key={u.id}><div><b>#{idx+1} {u.firstName}</b><small>{u.id}</small><small>Telegram: {u.telegramId || 'Guest'} · @{u.username || '-'}</small><small>Fleet {u.activeFleet} · Bonus +{u.fleetBonus}% · {u.fleetGrade}</small><small>Wallet: {u.solanaWallet || 'Not connected'}</small><small>KYC: {u.kyc?.status || 'not_submitted'} · {u.banned ? 'BANNED' : 'ACTIVE'}</small></div><div className="admin-user-side"><strong>{fmt(u.balance)} SPNX</strong><RiskBadge risk={u.risk}/><button onClick={()=>toggleBan(u)}>{u.banned?'Unban':'Ban'}</button></div></div>)}</div>}

    {tab==='kyc' && <div className="admin-users"><h3>KYC · Coming Soon</h3><p className="admin-empty">Identity collection and manual approval are disabled. This module will open only after a professional KYC provider, signed webhook verification, privacy policy, and user-paid checkout are configured.</p>{users.map((u)=><div className="admin-user-row" key={`kyc-${u.id}`}><div><b>{u.firstName}</b><small>{u.id}</small><small>KYC: NOT AVAILABLE · Trust {u.risk?.trustScore}</small></div><RiskBadge risk={u.risk}/></div>)}</div>}

    {tab==='risk' && <div className="admin-users"><h3>Risk Center</h3><div className="risk-summary"><div><small>High Risk</small><b>{riskData?.highRisk?.length || 0}</b></div><div><small>Review</small><b>{riskData?.review?.length || 0}</b></div><div><small>Trusted</small><b>{riskData?.trusted?.length || 0}</b></div></div>{(riskData?.all || []).map((u)=><div className="admin-user-row admin-user-rich" key={`risk-${u.id}`}><div><b>{u.firstName}</b><small>{u.id}</small><small>Flags: {(u.risk?.flags || []).join(', ') || 'none'}</small><small>Trust: {u.risk?.trustScore} · KYC: {u.risk?.kycStatus}</small></div><RiskBadge risk={u.risk}/></div>)}</div>}

    {tab==='missions' && <div className="admin-users"><h3>Mission Manager</h3>{missions.map((m)=><div className="admin-user-row admin-user-rich" key={m.id}><div><b>{m.icon} {m.id} · {m.type}</b><input className="small-input" value={m.title} onChange={(e)=>setMissions((current)=>current.map((item)=>item.id===m.id?{...item,title:e.target.value}:item))} onBlur={(e)=>updateMission(m,'title',e.target.value)}/><input className="small-input" value={m.url || ''} onChange={(e)=>setMissions((current)=>current.map((item)=>item.id===m.id?{...item,url:e.target.value}:item))} onBlur={(e)=>updateMission(m,'url',e.target.value)}/></div><div className="admin-user-side"><input className="small-input" type="number" value={m.reward} onChange={(e)=>setMissions((current)=>current.map((item)=>item.id===m.id?{...item,reward:Number(e.target.value)}:item))} onBlur={(e)=>updateMission(m,'reward',Number(e.target.value))}/><button onClick={()=>updateMission(m,'enabled',!m.enabled)}>{m.enabled?'ON':'OFF'}</button></div></div>)}</div>}

    {tab==='ranking' && <div className="admin-users"><h3>Ranking Center</h3><h4>Global Top</h4>{(ranking?.global || []).slice(0,20).map((u,idx)=><div className="admin-user-row" key={`g-${u.id}`}><div><b>#{idx+1} {u.firstName}</b><small>{u.id}</small></div><strong>{fmt(u.balance)} SPNX</strong></div>)}<h4>Fleet Top</h4>{(ranking?.fleet || []).slice(0,20).map((u,idx)=><div className="admin-user-row" key={`f-${u.id}`}><div><b>#{idx+1} {u.firstName}</b><small>{u.id}</small></div><strong>{u.activeFleet} Fleet</strong></div>)}</div>}

    {tab==='convert' && <div className="admin-users"><h3>Solana SPNX Payout Center</h3><p className="admin-empty">The payout engine remains locked until signed KYC webhooks, wallet ownership verification, the SPNX mint, RPC, treasury signer, and all three admin switches are ready. Never paste a treasury private key into this page.</p>
      <div className="risk-summary"><div><small>Queued / Review</small><b>{queue.length}</b></div><div><small>Token Amount</small><b>{fmt(simulator?.totalAmount || 0)}</b></div><div><small>Mode</small><b>{simulator?.mode || 'LOCKED'}</b></div></div>
      <div className="admin-stats">
        <div><small>KYC Webhook</small><b>{conversionRuntime?.kycRuntimeReady ? 'READY' : 'NOT READY'}</b></div>
        <div><small>Solana Runtime</small><b>{conversionRuntime?.solana?.valid ? 'READY' : 'NOT READY'}</b></div>
        <div><small>Signer Switch</small><b>{conversionRuntime?.solana?.enabled ? 'ENABLED' : 'OFF'}</b></div>
        <div><small>Automatic Payout</small><b>{conversionRuntime?.ready ? 'READY' : 'LOCKED'}</b></div>
      </div>
      {queue.map((request)=><div className="admin-user-row admin-user-rich" key={request.id}><div><b>{request.user?.firstName || request.userId}</b><small>{request.id} · {request.status}</small><small>{fmt(request.pointAmount || request.amount)} Point → {fmt(request.tokenAmount)} SPNX</small><small>Wallet: {request.wallet}</small><small>TX: {request.payout?.txSignature || 'Not broadcast'} · {request.payout?.lastError || 'No error'}</small></div><div className="admin-user-side"><strong>{request.payout?.status || request.status}</strong>{['queued','broadcasting'].includes(request.payout?.status) && <button onClick={()=>updateConvert(request.id,'process')}>Process</button>}{request.payout?.status==='needs_review' && !request.payout?.txSignature && <button onClick={()=>updateConvert(request.id,'retry')}>Retry</button>}{['queued','retry','needs_review'].includes(request.payout?.status) && !request.payout?.txSignature && <button onClick={()=>updateConvert(request.id,'cancel')}>Cancel &amp; release points</button>}</div></div>)}
    </div>}

    {tab==='settings' && <div className="admin-users"><h3>Unified System Settings</h3><form className="admin-form" onSubmit={updateSettings}>
      <label className="check-row"><input type="checkbox" checked={settingsForm.maintenanceMode} onChange={(e)=>setSettingsForm({...settingsForm,maintenanceMode:e.target.checked})}/> Maintenance Mode</label>
      <label className="check-row"><input type="checkbox" checked={settingsForm.novaAiEnabled} onChange={(e)=>setSettingsForm({...settingsForm,novaAiEnabled:e.target.checked})}/> NOVA AI Enabled</label>
      <input type="number" value="10" disabled aria-label="NOVA AI daily message limit locked at 10"/>
      <label className="check-row"><input type="checkbox" checked={settingsForm.gameRewardsEnabled} onChange={(e)=>setSettingsForm({...settingsForm,gameRewardsEnabled:e.target.checked})}/> Game Rewards Enabled</label>
      <input type="number" value="30" disabled aria-label="Game daily SPNX limit locked at 30"/>
      <label className="check-row"><input type="checkbox" checked={settingsForm.kycEnabled} onChange={(e)=>setSettingsForm({...settingsForm,kycEnabled:e.target.checked})}/> KYC provider webhook enabled</label>
      <label className="check-row"><input type="checkbox" checked={settingsForm.convertEnabled} onChange={(e)=>setSettingsForm({...settingsForm,convertEnabled:e.target.checked})}/> Official conversion window enabled</label>
      <label className="check-row"><input type="checkbox" checked={settingsForm.autoPayoutEnabled} onChange={(e)=>setSettingsForm({...settingsForm,autoPayoutEnabled:e.target.checked})}/> Automatic Solana payouts enabled</label>
      <button>Save Unified Settings</button>
    </form><pre className="admin-json">{JSON.stringify(settings,null,2)}</pre></div>}

    {tab==='logs' && <div className="admin-logs"><h3>Audit Logs</h3>{logs.map((log,i)=><div className="admin-log-row" key={`${log.at}-${i}`}><b>{log.type}</b><small>{new Date(log.at).toLocaleString()}</small><code>{JSON.stringify(log)}</code></div>)}</div>}
  </section>;
}
