import { useEffect } from 'react';
import { speakText, canSpeak } from '../lib/speech';
import { t } from '../lib/i18n';
import { SpeakerIcon } from './icons/SpeakerIcon';
import type { LangCode, Locale } from '../types';

interface HearButtonProps {
  text: string;
  lang?: LangCode;
  locale: Locale;
  className?: string;
  iconOnly?: boolean;
  /** Joue l’audio à l’arrivée (rejouer = nouvel appui). */
  autoPlay?: boolean;
}

export function HearButton({
  text,
  lang,
  locale,
  className = '',
  iconOnly = false,
  autoPlay = false,
}: HearButtonProps) {
  const speakable = canSpeak();

  useEffect(() => {
    if (!autoPlay || !speakable || !text.trim()) return;
    void speakText(text, lang);
  }, [autoPlay, speakable, text, lang]);

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
      <SpeakerIcon size={iconOnly ? 22 : 18} />
      {iconOnly ? null : <span>{t('hear', locale)}</span>}
    </button>
  );
}
