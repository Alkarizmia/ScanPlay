import { useCallback, useEffect, useState } from 'react';
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
  const [busy, setBusy] = useState(false);

  const play = useCallback(async () => {
    if (!speakable || !text.trim()) return;
    setBusy(true);
    try {
      await speakText(text, lang);
    } finally {
      setBusy(false);
    }
  }, [speakable, text, lang]);

  useEffect(() => {
    if (!autoPlay || !speakable || !text.trim()) return;
    void play();
  }, [autoPlay, speakable, text, lang, play]);

  return (
    <button
      type="button"
      className={`hear-btn ${iconOnly ? 'hear-btn--icon' : ''} ${busy ? 'hear-btn--busy' : ''} ${className}`.trim()}
      aria-label={t('hearPronunciation', locale)}
      aria-busy={busy}
      disabled={!speakable}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        void play();
      }}
    >
      <SpeakerIcon size={iconOnly ? 22 : 18} />
      {iconOnly ? null : <span>{t('hear', locale)}</span>}
    </button>
  );
}
