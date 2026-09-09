import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { applyDeviceAttributes, detectDeviceProfile } from './lib/device';
import { registerServiceWorker } from './lib/pwa';
import './styles/landing-boot.css';
import './styles/landing.css';
import { Root } from './Root';

applyDeviceAttributes(detectDeviceProfile());
void registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <Root />
    </AppErrorBoundary>
    <Analytics />
  </StrictMode>,
);
