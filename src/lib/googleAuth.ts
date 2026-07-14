type GoogleCredentialResponse = {
  credential: string;
};

type GoogleMomentNotification = {
  isNotDisplayed: () => boolean;
  isSkippedMoment: () => boolean;
};

type GoogleIdApi = {
  initialize: (config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    cancel_on_tap_outside?: boolean;
    use_fedcm_for_prompt?: boolean;
    nonce?: string;
  }) => void;
  prompt: (listener?: (notification: GoogleMomentNotification) => void) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      type?: string;
      theme?: string;
      size?: string;
      text?: string;
      shape?: string;
      width?: number;
    },
  ) => void;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: GoogleIdApi;
      };
    };
  }
}

const GSI_SCRIPT = 'https://accounts.google.com/gsi/client';

export function getGoogleClientId(): string | null {
  const id = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  return typeof id === 'string' && id.trim().length > 0 ? id.trim() : null;
}

export interface GoogleIdTokenResult {
  token: string;
  /** Raw nonce — pass to Supabase signInWithIdToken (not the hashed value). */
  nonce: string;
}

/** Supabase expects raw nonce; Google GSI expects SHA-256 hex of that nonce. */
export async function createGoogleNoncePair(): Promise<{ raw: string; hashed: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const raw = btoa(String.fromCharCode(...bytes));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return { raw, hashed };
}

function loadGsiScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();

  const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SCRIPT}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      if (window.google?.accounts?.id) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('gsi_load_failed')), { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GSI_SCRIPT;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('gsi_load_failed'));
    document.head.appendChild(script);
  });
}

/** Demande un ID token Google (popup ScanPlay) pour signInWithIdToken Supabase. */
export async function requestGoogleIdToken(clientId: string): Promise<GoogleIdTokenResult> {
  await loadGsiScript();
  const googleId = window.google?.accounts?.id;
  if (!googleId) throw new Error('gsi_unavailable');

  const { raw: nonce, hashed: hashedNonce } = await createGoogleNoncePair();

  return new Promise((resolve, reject) => {
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    };

    const overlay = document.createElement('div');
    overlay.className = 'google-auth-overlay';
    const panel = document.createElement('div');
    panel.className = 'google-auth-panel';
    const title = document.createElement('p');
    title.className = 'google-auth-panel-title';
    title.textContent = 'ScanPlay';
    const host = document.createElement('div');
    host.className = 'google-auth-button-host';

    const cleanup = () => {
      overlay.remove();
      panel.remove();
    };

    overlay.addEventListener('click', () => {
      finish(() => reject(new Error('google_signin_cancelled')));
    });

    panel.addEventListener('click', (e) => e.stopPropagation());
    panel.append(title, host);
    document.body.append(overlay, panel);

    googleId.initialize({
      client_id: clientId,
      nonce: hashedNonce,
      callback: (response) => {
        finish(() => {
          if (!response.credential) {
            reject(new Error('google_no_credential'));
            return;
          }
          resolve({ token: response.credential, nonce });
        });
      },
      cancel_on_tap_outside: true,
      // FedCM can inject its own nonce and break Supabase validation in some browsers.
      use_fedcm_for_prompt: false,
    });

    googleId.renderButton(host, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'pill',
      width: 280,
    });

    googleId.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) return;
    });
  });
}
