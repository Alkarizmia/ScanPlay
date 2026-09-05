import type { Locale } from '../types';
import en from '../i18n/landing/en.json';
import fr from '../i18n/landing/fr.json';

export type LandingLang = 'fr' | 'en';
export type LandingCopyKey = keyof typeof fr;

const copies: Record<LandingLang, Record<LandingCopyKey, string>> = { fr, en };

/** French landing only for fr, fr-FR, fr-BE, fr-CH. Every other locale is English. */
export function landingLangFromNavigator(
  language = typeof navigator === 'undefined' ? 'en' : navigator.language,
): LandingLang {
  const tag = language.trim().toLowerCase().replace(/_/g, '-');
  if (tag === 'fr' || tag.startsWith('fr-fr') || tag.startsWith('fr-be') || tag.startsWith('fr-ch')) {
    return 'fr';
  }
  return 'en';
}

export function lt(key: LandingCopyKey, lang: LandingLang | Locale): string {
  const resolved: LandingLang = lang === 'fr' ? 'fr' : 'en';
  return copies[resolved][key] ?? copies.en[key] ?? key;
}
