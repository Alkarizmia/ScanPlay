/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_AI_SCAN?: string;
  readonly VITE_ADSENSE_ENABLED?: string;
  readonly VITE_ADSENSE_CLIENT?: string;
  readonly VITE_ADSENSE_SLOT_SHOP?: string;
  readonly VITE_ADSENSE_SLOT_REWARD?: string;
  readonly VITE_ADSENSE_VERIFY_META?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_SPEECH_SERVER?: string;
  readonly VITE_STRIPE_CHECKOUT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
