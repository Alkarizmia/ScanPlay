import type { Locale } from '../types';
import ar from '../i18n/landing/ar.json';
import en from '../i18n/landing/en.json';
import es from '../i18n/landing/es.json';
import fr from '../i18n/landing/fr.json';
import nl from '../i18n/landing/nl.json';

/** Landing languages (includes Arabic; app UI already had ar strings). */
export type LandingLang = Locale;
export type LandingCopyKey = keyof typeof fr;

const copies: Record<LandingLang, Record<string, string>> = { fr, en, nl, es, ar };

export const LANDING_LANGS: { id: LandingLang; label: string; short: string }[] = [
  { id: 'fr', label: 'Français', short: 'FR' },
  { id: 'en', label: 'English', short: 'EN' },
  { id: 'nl', label: 'Nederlands', short: 'NL' },
  { id: 'es', label: 'Español', short: 'ES' },
  { id: 'ar', label: 'العربية', short: 'AR' },
];

/** Same key as `src/lib/i18n.ts` (keep landing bundle free of i18n.ts). */
const LOCALE_KEY = 'scanplay-locale';

function isLandingLang(value: unknown): value is LandingLang {
  return value === 'fr' || value === 'en' || value === 'nl' || value === 'es' || value === 'ar';
}

/** Match browser language; any fr-* is French, any ar-* is Arabic. */
export function landingLangFromNavigator(
  language = typeof navigator === 'undefined' ? 'en' : navigator.language,
): LandingLang {
  const tag = language.trim().toLowerCase().replace(/_/g, '-');
  if (tag === 'fr' || tag.startsWith('fr-')) return 'fr';
  if (tag === 'nl' || tag.startsWith('nl-')) return 'nl';
  if (tag === 'es' || tag.startsWith('es-')) return 'es';
  if (tag === 'ar' || tag.startsWith('ar-')) return 'ar';
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
  const table = copies[lang] ?? copies.en;
  return table[key] ?? copies.en[key] ?? copies.fr[key] ?? key;
}
