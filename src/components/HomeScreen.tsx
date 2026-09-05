import { useEffect, useRef, useState } from 'react';

import { usePlan } from '../hooks/usePlan';
import { BrandDecor } from './BrandDecor';
import { DeviceBadge } from './DeviceBadge';
import { HomeDashboard } from './HomeDashboard';
import { LandingPage } from './landing/LandingPage';
import { LogoWordmark } from './Logo';
import { NotificationCenter } from './NotificationCenter';
import { PlanBadge } from './PlanBadge';
import { PlanCard } from './PlanCard';
import { SiteFooter } from './SiteFooter';
import { InstallAppSheet } from './InstallAppSheet';
import { GuestScanBanner } from './GuestScanBanner';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { getAchievementDef, getRecentUnlocks } from '../lib/achievementUnlocks';
import { canGuestScan } from '../lib/guestTrial';
import { isLoggedIn } from '../lib/auth';
import { getHistory, peekLastHomeDeck } from '../lib/history';
import { trackEvent } from '../lib/analytics';
import { getDateLocale, t } from '../lib/i18n';
import { collectDroppedImageFiles } from '../lib/droppedFiles';
import { clampImagesForImport, getMaxImagesPerImport, getScansRemaining, PLAN_LIMITS } from '../lib/planLimits';
import type { DeviceProfile } from '../lib/device';
import type { HistoryEntry, Locale } from '../types';

const INSTALL_SNOOZE_KEY = 'scanplay-install-snooze';
const INSTALL_AUTO_KEY = 'scanplay-install-auto-at';
const DAY_MS = 86_400_000;

function isInstallSnoozed(): boolean {
  const raw = localStorage.getItem(INSTALL_SNOOZE_KEY);
  if (!raw) return false;
  const at = Number(raw);
  return Number.isFinite(at) && Date.now() - at < 5 * DAY_MS;
}

function markInstallSnooze() {
  localStorage.setItem(INSTALL_SNOOZE_KEY, String(Date.now()));
}

interface HomeScreenProps {
  locale: Locale;
  refreshKey: number;
  streakPulseKey?: number;
  device: DeviceProfile;
  onScanPlay: (files?: File[]) => void;
  onTrySample: () => void;
  onPricing: () => void;
  onSocialChange?: () => void;
  onToast?: (message: string) => void;
  onAuth?: () => void;
  onRefresh?: () => void;
  onContinueLast?: () => void;
  onOpenDeck?: (entry: HistoryEntry) => void;
  onOpenAchievements?: () => void;
  onOpenShop?: () => void;
}

export function HomeScreen({
  locale,
  refreshKey,
  streakPulseKey = 0,
  device,
  onScanPlay,
  onTrySample,
  onPricing,
  onSocialChange,
  onToast,
  onAuth,
  onRefresh,
  onContinueLast,
  onOpenDeck,
  onOpenAchievements,
  onOpenShop,
}: HomeScreenProps) {
  void streakPulseKey;
  const plan = usePlan(refreshKey);
  const scansLeft = getScansRemaining();
  const isDesktop = device.kind === 'desktop';
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [installSheetOpen, setInstallSheetOpen] = useState(false);
  const [installSnoozed, setInstallSnoozed] = useState(isInstallSnoozed);
  const { canNativeInstall, canShowInstall, isInstalled, install, platform, isInAppBrowser } =
    usePwaInstall();
  const loggedIn = isLoggedIn();
  const recentDecks = loggedIn ? getHistory().slice(0, 6) : [];
  const lastDeck = recentDecks[0] ?? (loggedIn ? peekLastHomeDeck() : null);
  const recentUnlocks = loggedIn ? getRecentUnlocks(4) : [];
  const welcomeMessage =
    lastDeck ? t('mascotWelcomeBackShort', locale) : t('mascotWelcomeReady', locale);

  const handleFiles = (list: FileList | File[] | null) => {
    if (!list) return;
    const { files: images, dropped } = clampImagesForImport(Array.from(list));
    if (images.length === 0) return;
    if (dropped > 0) {
      onToast?.(
        t('scanPhotosLimited', locale)
          .replace('{max}', String(getMaxImagesPerImport()))
          .replace('{dropped}', String(dropped)),
      );
    }
    onScanPlay(images);
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const images = await collectDroppedImageFiles(e.dataTransfer);
    if (images.length === 0) {
      onToast?.(t('importDropNoImages', locale));
      return;
    }
    handleFiles(images);
  };

  const showInstallButton = canShowInstall || isInAppBrowser;
  const showInstallNudge = loggedIn && showInstallButton && !isInstalled && !installSnoozed;

  const handleInstall = async () => {
    trackEvent('clic_installer');
    if (canNativeInstall) {
      const ok = await install();
      if (ok) return;
    }
    setInstallSheetOpen(true);
  };

  const snoozeInstall = () => {
    markInstallSnooze();
    setInstallSnoozed(true);
    setInstallSheetOpen(false);
  };

  useEffect(() => {
    if (!showInstallNudge) return;
    const lastAuto = Number(localStorage.getItem(INSTALL_AUTO_KEY) ?? '0');
    if (Number.isFinite(lastAuto) && Date.now() - lastAuto < 7 * DAY_MS) return;
    const timer = window.setTimeout(() => {
      localStorage.setItem(INSTALL_AUTO_KEY, String(Date.now()));
      setInstallSheetOpen(true);
      trackEvent('install_prompt_auto');
    }, 2800);
    return () => window.clearTimeout(timer);
  }, [showInstallNudge]);

  if (!loggedIn) {
    return (
      <LandingPage
        locale={locale}
        device={device}
        onScanPlay={() => onScanPlay()}
        onAuth={() => onAuth?.()}
      />
    );
  }

  return (
    <div
      className={`screen tab-screen home-screen home-screen-branded home-screen--premium${isDesktop ? ' home-screen--desktop' : ''}`}
    >
      <BrandDecor />

      <header className="top-bar top-bar-raised">
        <div className="top-bar-brand">
          <LogoWordmark />
        </div>
        <div className="top-bar-actions">
          {loggedIn && (
            <NotificationCenter locale={locale} refreshKey={refreshKey} onSocialChange={onSocialChange} />
          )}
          {!loggedIn && canGuestScan() && isDesktop && (
            <span className="top-bar-guest-pill" title={t('guestScanBannerTitle', locale)}>
              {t('guestScanTopPill', locale)}
            </span>
          )}
          <PlanBadge plan={plan} locale={locale} />
        </div>
        {isDesktop && <DeviceBadge locale={locale} profile={device} compact />}
      </header>

      <main className={`home-main scroll-natural${!loggedIn ? ' home-main--guest' : ''}`}>
        {!loggedIn && (
          <GuestScanBanner
            locale={locale}
            onAuth={onAuth}
            className="guest-scan-banner--home-top"
            variant={isDesktop ? 'default' : 'mobile'}
          />
        )}

        {lastDeck && onContinueLast && (
          <section className="home-continue-block">
            <p className="home-continue-hint">
              {t('homeContinueLastHint', locale).replace('{title}', lastDeck.title)}
            </p>
            <button type="button" className="btn-primary btn-lg home-continue-cta" onClick={onContinueLast}>
              {t('homeContinueLast', locale)}
            </button>
            <button type="button" className="btn-secondary home-continue-scan" onClick={() => onScanPlay()}>
              {t('homeScanAnother', locale)}
            </button>
          </section>
        )}

        {!lastDeck && (
          <section className="home-continue-block">
            {loggedIn && scansLeft !== Infinity && (
              <p className="home-continue-hint">
                {scansLeft} / {PLAN_LIMITS[plan].scansPerDay} {t('scansToday', locale)}
              </p>
            )}
            <button type="button" className="btn-primary btn-lg home-continue-cta" onClick={() => onScanPlay()}>
              {t('lpHeroCta', locale)}
            </button>
            {isDesktop && (
              <div
                className={`home-dropzone home-dropzone--compact ${dragOver ? 'home-dropzone--active' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click();
                }}
              >
                <span className="home-dropzone-title">{t('importDrop', locale)}</span>
              </div>
            )}
          </section>
        )}

        {showInstallNudge && (
          <section className="home-install-card">
            <p className="home-install-card-title">{t('installHomeTitle', locale)}</p>
            <p className="home-install-card-body">{t('installHomeBody', locale)}</p>
            <button type="button" className="btn-primary home-install-card-cta" onClick={() => void handleInstall()}>
              {t('installApp', locale)}
            </button>
            <button type="button" className="text-link home-install-card-later" onClick={snoozeInstall}>
              {t('installAppLater', locale)}
            </button>
          </section>
        )}

        {loggedIn && (
          <HomeDashboard
            locale={locale}
            refreshKey={refreshKey}
            welcomeMessage={welcomeMessage}
            onRefresh={onRefresh}
            onOpenShop={onOpenShop}
            onOpenAchievements={onOpenAchievements}
          />
        )}

        {!loggedIn && canGuestScan() && onAuth && (
          <button
            type="button"
            className="guest-mobile-signup-teaser"
            onClick={() => {
              trackEvent('ouverture_inscription', { etape: 'page_de_garde' });
              onAuth();
            }}
          >
            {t('guestSignupTeaser', locale)}
          </button>
        )}

        {loggedIn && recentDecks.length > 0 && (
          <section className="home-section home-section--premium">
            <div className="home-section-head">
              <h3 className="home-section-title">{t('homeRecentScans', locale)}</h3>
            </div>
            <div className="home-recent-scroll">
              {recentDecks.map((deck) => (
                <article
                  key={deck.id}
                  className="home-recent-card"
                  role={onOpenDeck ? 'button' : undefined}
                  tabIndex={onOpenDeck ? 0 : undefined}
                  onClick={() => onOpenDeck?.(deck)}
                  onKeyDown={(e) => {
                    if (onOpenDeck && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      onOpenDeck(deck);
                    }
                  }}
                >
                  {deck.thumbnail ? (
                    <img src={deck.thumbnail} alt="" className="home-recent-thumb" />
                  ) : (
                    <div className="home-recent-thumb home-recent-thumb--placeholder" aria-hidden="true">
                      📋
                    </div>
                  )}
                  <div className="home-recent-body">
                    <span className="home-recent-title">{deck.title}</span>
                    {deck.lastScorePct != null && (
                      <span className="home-recent-meta">
                        {deck.lastScorePct}%
                        {deck.lastXpEarned != null && ` · +${deck.lastXpEarned} XP`}
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {loggedIn && recentUnlocks.length > 0 && (
          <section className="home-section home-section--premium">
            <div className="home-section-head">
              <h3 className="home-section-title">{t('homeRecentAchievements', locale)}</h3>
            </div>
            <div className="home-ach-grid">
              {recentUnlocks.map((rec) => {
                const def = getAchievementDef(rec.id);
                if (!def) return null;
                return (
                  <button
                    key={rec.id}
                    type="button"
                    className="home-ach-card unlocked"
                    onClick={onOpenAchievements}
                  >
                    <span className="home-ach-card-icon" aria-hidden="true">
                      {def.icon}
                    </span>
                    <span className="home-ach-card-name">{t(def.nameKey, locale)}</span>
                    <time className="home-ach-card-date" dateTime={rec.unlockedAt}>
                      {new Date(rec.unlockedAt).toLocaleDateString(getDateLocale(locale), {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </time>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {isInstalled && <p className="home-install-done">{t('installAppInstalled', locale)}</p>}

        <button type="button" className="text-link" onClick={onTrySample}>
          {t('tryDemo', locale)}
        </button>

        {!( !loggedIn && canGuestScan() ) && (
          <PlanCard locale={locale} refreshKey={refreshKey} onUpgrade={onPricing} onToast={onToast} />
        )}

        <SiteFooter locale={locale} />
      </main>

      {isDesktop && (
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple={getMaxImagesPerImport() > 1}
          className="sr-only"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      )}
      <InstallAppSheet
        open={installSheetOpen}
        locale={locale}
        platform={platform}
        canNativeInstall={canNativeInstall}
        isInAppBrowser={isInAppBrowser}
        onClose={() => setInstallSheetOpen(false)}
        onNativeInstall={install}
      />
    </div>
  );
}
