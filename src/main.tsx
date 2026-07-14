import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { initTheme } from './hooks/useTheme';
import { applyDeviceAttributes, detectDeviceProfile } from './lib/device';
import { registerServiceWorker } from './lib/pwa';
import './index.css';
import './styles/design-system.css';
import './styles/responsive.css';
import './styles/lesson-profile.css';
import './styles/mascot.css';
import App from './App.tsx';

initTheme();
applyDeviceAttributes(detectDeviceProfile());
void registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
    <Analytics />
  </StrictMode>,
);
