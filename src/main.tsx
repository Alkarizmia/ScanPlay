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
import 'katex/dist/katex.min.css';
import App from './App.tsx';
import { initAuth } from './lib/auth';
import { restoreSavedAdConsent } from './lib/ads/consent';

initTheme();
restoreSavedAdConsent();
applyDeviceAttributes(detectDeviceProfile());
void registerServiceWorker();
void initAuth();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
    <Analytics />
  </StrictMode>,
);
