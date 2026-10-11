import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { applyDeviceAttributes, detectDeviceProfile } from './lib/device';
import { registerServiceWorker } from './lib/pwa';
import './styles/landing-boot.css';
import { Root } from './Root';

applyDeviceAttributes(detectDeviceProfile());

// Full landing CSS as a separate chunk — start immediately, don't block the JS module graph.
void import('./styles/landing.css');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <Root />
    </AppErrorBoundary>
    <Analytics />
  </StrictMode>,
);

// SW after first paint so it never races the landing critical path.
if (typeof window !== 'undefined') {
  const bootSw = () => {
    void registerServiceWorker();
  };
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(bootSw, { timeout: 4000 });
  } else {
    window.addEventListener('load', bootSw, { once: true });
  }
}
