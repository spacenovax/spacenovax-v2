import React from 'react';
import { createRoot } from 'react-dom/client';
import V15App from './V15App.jsx';
import AdminPage from './components/AdminPage.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {window.location.pathname.startsWith('/admin') ? <AdminPage /> : <V15App />}
  </React.StrictMode>
);
