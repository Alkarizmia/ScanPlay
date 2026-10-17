import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { applyDeviceAttributes, detectDeviceProfile } from './lib/device';
import { registerServiceWorker } from './lib/pwa';
import './styles/landing-boot.css';
import { Root } from './Root';

applyDeviceAttributes(detectDeviceProfile());

const markLandingCssReady = () => {
  document.documentElement.dataset.lpCss = 'ready';
};

// Full landing CSS as a separate chunk — start immediately, don't block the JS module graph.
void import('./styles/landing.css').then(markLandingCssReady).catch(markLandingCssReady);
// Never leave the anti-FOUC gate stuck if the chunk is unusually slow.
window.setTimeout(markLandingCssReady, 2500);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <Root />
    </AppErrorBoundary>
    <Analytics />
    <SpeedInsights />
  </StrictMode>,
);

// SW after first paint so it never races the landing critical path.
const bootSw = () => {
  void registerServiceWorker();
};
const ric = window.requestIdleCallback?.bind(window);
if (ric) {
  ric(bootSw, { timeout: 4000 });
} else {
  window.setTimeout(bootSw, 1);
}
