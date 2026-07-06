import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';

import Header from './components/Header.jsx';
import ExplorerCard from './components/ExplorerCard.jsx';
import MiningHero from './components/MiningHero.jsx';
import MiningPanel from './components/MiningPanel.jsx';
import BottomNav from './components/BottomNav.jsx';

function getTelegramUser() {
  const tg = window.Telegram?.WebApp;
  try {
    tg?.ready?.();
    tg?.expand?.();
  } catch {}

  return tg?.initDataUnsafe?.user || null;
}

function App() {
  const [user, setUser] = useState(null);
  const [notice, setNotice] = useState('Connecting SpaceNovaX...');
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(Date.now());

  const telegramUser = useMemo(() => getTelegramUser(), []);

  async function api(path, body = {}) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramUser, ...body }),
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.message || 'Request failed');
    }

    return data;
  }

  async function loadSession() {
    try {
      const data = await api('/api/session');
      setUser(data.user);
      setNotice(data.user.isGuest ? 'Guest mode active. Telegram Mini App 연결 시 실제 계정으로 저장됩니다.' : 'Telegram account connected.');
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function startMining() {
    setLoading(true);
    try {
      const data = await api('/api/mining/start');
      setUser(data.user);
      setNotice(data.message || 'Mining started.');
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function claimMining() {
    setLoading(true);
    try {
      const data = await api('/api/mining/claim');
      setUser(data.user);
      setNotice(data.message || 'Claimed.');
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSession();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user?.mining?.active) return;

    const startedAt = user.mining.startedAt || (Date.now() - (user.mining.progress || 0) * 86400000);
    const endsAt = user.mining.endsAt || (Date.now() + user.mining.remainingMs);
    const duration = endsAt - startedAt;
    const elapsed = Math.max(0, Math.min(Date.now() - startedAt, duration));
    const progress = duration > 0 ? elapsed / duration : 0;
    const remainingMs = Math.max(0, endsAt - Date.now());
    const minedSoFar = (user.mining.reward || 0) * progress;

    setUser((current) => current ? ({
      ...current,
      mining: {
        ...current.mining,
        progress,
        remainingMs,
        minedSoFar,
        claimable: remainingMs <= 0,
      }
    }) : current);
  }, [tick]);

  return (
    <div className="app-shell">
      <main className="app">
        <Header user={user} />
        <div className="notice">{notice}</div>
        <ExplorerCard user={user} />
        <MiningHero user={user} onStart={startMining} onClaim={claimMining} loading={loading} />
        <MiningPanel user={user} />
      </main>
      <BottomNav />
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
