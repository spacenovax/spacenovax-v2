import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';

import Header from './components/Header.jsx';
import ExplorerCard from './components/ExplorerCard.jsx';
import MiningHero from './components/MiningHero.jsx';
import MiningPanel from './components/MiningPanel.jsx';
import BottomNav from './components/BottomNav.jsx';

function App() {
  return (
    <div className="app-shell">
      <main className="app">
        <Header />
        <ExplorerCard />
        <MiningHero />
        <MiningPanel />
      </main>
      <BottomNav />
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
