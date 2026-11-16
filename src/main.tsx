import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Enregistrement du Service Worker pour mode hors connexion et chargement instantané
if ('serviceWorker' in navigator && !window.location.host.includes('localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('[SW] Service Worker enregistré avec succès:', reg.scope);
      })
      .catch((err) => {
        console.warn('[SW] Échec enregistrement:', err);
      });
  });
}
