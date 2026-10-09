import type { Locale } from '../types';
import en from '../i18n/landing/en.json';
import es from '../i18n/landing/es.json';
import fr from '../i18n/landing/fr.json';
import nl from '../i18n/landing/nl.json';

/** Landing stays on the four marketing languages; app UI also supports Arabic. */
export type LandingLang = Exclude<Locale, 'ar'>;
export type LandingCopyKey = keyof typeof fr;

const copies: Record<LandingLang, Record<LandingCopyKey, string>> = { fr, en, nl, es };

export const LANDING_LANGS: { id: LandingLang; label: string; short: string }[] = [
  { id: 'fr', label: 'Français', short: 'FR' },
  { id: 'en', label: 'English', short: 'EN' },
  { id: 'nl', label: 'Nederlands', short: 'NL' },
  { id: 'es', label: 'Español', short: 'ES' },
];

/** Same key as `src/lib/i18n.ts` — not imported from there to keep the landing bundle small. */
const LOCALE_KEY = 'scanplay-locale';

function isLandingLang(value: unknown): value is LandingLang {
  return value === 'fr' || value === 'en' || value === 'nl' || value === 'es';
}

/** French landing only for fr, fr-FR, fr-BE, fr-CH; Dutch and Spanish by prefix; English otherwise. */
export function landingLangFromNavigator(
  language = typeof navigator === 'undefined' ? 'en' : navigator.language,
): LandingLang {
  const tag = language.trim().toLowerCase().replace(/_/g, '-');
  if (tag === 'fr' || tag.startsWith('fr-fr') || tag.startsWith('fr-be') || tag.startsWith('fr-ch')) {
    return 'fr';
  }
  if (tag === 'nl' || tag.startsWith('nl-')) return 'nl';
  if (tag === 'es' || tag.startsWith('es-')) return 'es';
  return 'en';
}

function storedLandingLang(): LandingLang | null {
  try {
    const stored = localStorage.getItem(LOCALE_KEY);
    return isLandingLang(stored) ? stored : null;
  } catch {
    return null;
  }
}

/** A language picked earlier (landing or app) wins over the browser language. */
export function initialLandingLang(): LandingLang {
  return storedLandingLang() ?? landingLangFromNavigator();
}

/** Shared with the app so it opens in the language the visitor saw on the landing. */
export function persistLandingLang(lang: LandingLang): void {
  try {
    localStorage.setItem(LOCALE_KEY, lang);
  } catch {
    /* private mode: the landing still switches, only persistence is lost */
  }
}

export function lt(key: LandingCopyKey, lang: LandingLang | Locale): string {
  const resolved: LandingLang = lang === 'ar' ? 'en' : lang;
  return copies[resolved]?.[key] ?? copies.en[key] ?? key;
}
