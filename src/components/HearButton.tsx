import { speakText, canSpeak } from '../lib/speech';
import { t } from '../lib/i18n';
import type { LangCode, Locale } from '../types';

interface HearButtonProps {
  text: string;
  lang?: LangCode;
  locale: Locale;
  className?: string;
  iconOnly?: boolean;
}

export function HearButton({ text, lang, locale, className = '', iconOnly = false }: HearButtonProps) {
  const speakable = canSpeak();

  return (
    <button
      type="button"
      className={`hear-btn ${iconOnly ? 'hear-btn--icon' : ''} ${className}`.trim()}
      aria-label={t('hearPronunciation', locale)}
      disabled={!speakable}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        void speakText(text, lang);
      }}
    >
      {iconOnly ? '🔊' : `🔊 ${t('hear', locale)}`}
    </button>
  );
}
