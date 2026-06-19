import { useCallback } from 'react';
import { t, type TranslationKey } from '../lib/i18n';
import { setPreference } from '../lib/preferences';
import { playSound, SOUND_PREVIEW_IDS, type SoundId } from '../lib/sounds';
import { hapticTap } from '../lib/haptics';
import { usePreferences } from '../hooks/usePreferences';
import type { Locale } from '../types';

interface AudioSettingsScreenProps {
  locale: Locale;
  onBack: () => void;
}

export function AudioSettingsScreen({ locale, onBack }: AudioSettingsScreenProps) {
  const prefs = usePreferences();

  const preview = useCallback((id: SoundId) => {
    playSound(id);
    hapticTap();
  }, []);

  const updatePref = <K extends keyof typeof prefs>(key: K, value: (typeof prefs)[K]) => {
    const prev = prefs[key];
    setPreference(key, value);
    if (key === 'sound' && value && !prev) playSound('tap');
    if (key === 'masterVolume' && prefs.sound) playSound('tap');
  };

  return (
    <div className="screen tab-screen audio-settings-screen">
      <header className="top-bar">
        <button type="button" className="icon-btn" onClick={onBack} aria-label={t('back', locale)}>
          ←
        </button>
        <h2 className="screen-title">{t('audioSettingsTitle', locale)}</h2>
        <span className="top-spacer" />
      </header>

      <main className="audio-settings-main scroll-natural">
        <p className="audio-settings-intro">{t('audioSettingsIntro', locale)}</p>

        <section className="settings-section audio-settings-section">
          <div className="audio-volume-block">
            <div className="audio-volume-head">
              <span className="audio-volume-label">{t('masterVolume', locale)}</span>
              <span className="audio-volume-value">{prefs.masterVolume}%</span>
            </div>
            <input
              type="range"
              className="audio-volume-slider"
              min={0}
              max={100}
              step={5}
              value={prefs.masterVolume}
              onChange={(e) => updatePref('masterVolume', Number(e.target.value))}
              aria-label={t('masterVolume', locale)}
            />
          </div>

          <div className="settings-row">
            <div className="audio-toggle-copy">
              <span>{t('soundEffects', locale)}</span>
              <small>{t('soundEffectsHint', locale)}</small>
            </div>
            <button
              type="button"
              className={`toggle ${prefs.sound ? 'on' : ''}`}
              onClick={() => updatePref('sound', !prefs.sound)}
              role="switch"
              aria-checked={prefs.sound}
            />
          </div>

          <div className="settings-row">
            <div className="audio-toggle-copy">
              <span>{prefs.vibration ? t('vibrationOn', locale) : t('vibrationOff', locale)}</span>
              <small>{t('vibrationHint', locale)}</small>
            </div>
            <button
              type="button"
              className={`toggle ${prefs.vibration ? 'on' : ''}`}
              onClick={() => {
                updatePref('vibration', !prefs.vibration);
                if (!prefs.vibration) hapticTap();
              }}
              role="switch"
              aria-checked={prefs.vibration}
            />
          </div>
        </section>

        <section className="settings-section audio-preview-section">
          <h3 className="settings-label">{t('audioPreviewTitle', locale)}</h3>
          <p className="settings-hint">{t('audioPreviewHint', locale)}</p>
          <div className="audio-preview-grid">
            {SOUND_PREVIEW_IDS.map(({ id, labelKey }) => (
              <button
                key={id}
                type="button"
                className="audio-preview-chip"
                onClick={() => preview(id)}
              >
                {t(labelKey as TranslationKey, locale)}
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
