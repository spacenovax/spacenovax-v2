import React from 'react';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import { createRoot } from 'react-dom/client';
import V15App from './V15App.jsx';
import AdminPage from './components/AdminPage.jsx';
import NovaNavigationApp from './navigation/NovaNavigationApp.jsx';
import { initializePwa } from './pwa.js';
import './styles/admin.css';

if (import.meta.env.PROD) initializePwa();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <TonConnectUIProvider manifestUrl={`${window.location.origin}/tonconnect-manifest.json`}>
      {window.location.pathname.startsWith('/admin') ? <AdminPage /> : window.location.hostname === 'nav.spacenovax.com' ? <NovaNavigationApp /> : <V15App />}
    </TonConnectUIProvider>
  </React.StrictMode>
);
