import { registerSW } from 'virtual:pwa-register';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import './styles.css';

// Service worker con actualización explícita: nunca cambiar la versión en medio de una operación.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  const update = registerSW({
    onNeedRefresh() {
      if (window.confirm('Hay una nueva versión de ILC Origen. ¿Actualizar ahora?')) void update(true);
    },
  });
}

const root = document.getElementById('root');
if (!root) throw new Error('Falta #root');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
