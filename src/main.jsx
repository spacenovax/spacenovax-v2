import React from 'react';
import { createRoot } from 'react-dom/client';
import V15App from './V15App.jsx';
import AdminPage from './components/AdminPage.jsx';
import { initializePwa } from './pwa.js';
import './styles/admin.css';

if (import.meta.env.PROD) initializePwa();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {window.location.pathname.startsWith('/admin') ? <AdminPage /> : <V15App />}
  </React.StrictMode>
);
