import { useRef, useState } from 'react';

import { usePlan } from '../hooks/usePlan';
import { BrandDecor } from './BrandDecor';
import { DeviceBadge } from './DeviceBadge';
import { HomeDashboard } from './HomeDashboard';
import { HudStreakStat } from './GamificationHUD';
import { GamePath } from './GamePath';
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
import { getHistory } from '../lib/history';
import { getDateLocale, t } from '../lib/i18n';
import { SAMPLE_PAIRS } from '../lib/sample';
import { clampImagesForImport, getMaxImagesPerImport, getScansRemaining } from '../lib/planLimits';
import type { DeviceProfile } from '../lib/device';
import type { HistoryEntry, Locale, StepProgressMap } from '../types';

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
}

const GUEST_PREVIEW_PAIRS = SAMPLE_PAIRS.slice(0, 8);
const GUEST_PREVIEW_PROGRESS: StepProgressMap = {
  0: {
    pct: 100,
    tier: 'gold',
    games: { flashcards: { pct: 100, tier: 'gold' } },
  },
};

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
}: HomeScreenProps) {
  const plan = usePlan(refreshKey);
  const scansLeft = getScansRemaining();
  const isDesktop = device.kind === 'desktop';
  const isWideGuest = !isDesktop && device.viewportWidth >= 600;
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [installSheetOpen, setInstallSheetOpen] = useState(false);
  const { canNativeInstall, canShowInstall, isInstalled, install, platform, isInAppBrowser } =
    usePwaInstall();
  const loggedIn = isLoggedIn();
  const recentDecks = loggedIn ? getHistory().slice(0, 6) : [];
  const recentUnlocks = loggedIn ? getRecentUnlocks(4) : [];
  const welcomeMessage =
    recentDecks.length > 0 ? t('mascotWelcomeBackShort', locale) : t('mascotWelcomeReady', locale);

  const handleFiles = (list: FileList | null) => {
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

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleInstall = async () => {
    if (canNativeInstall) {
      const ok = await install();
      if (ok) return;
    }
    setInstallSheetOpen(true);
  };

  const showInstallButton = canShowInstall || isInAppBrowser;

  if (!loggedIn) {
    return (
      <div className={`screen home-screen home-screen-branded home-screen--guest-acquire${isWideGuest ? ' home-screen--guest-tablet' : ''}${isDesktop ? ' home-screen--desktop' : ''}`}>
        <main className="home-guest-main">
          <header className="top-bar home-guest-header">
            <div className="top-bar-brand">
              <LogoWordmark />
            </div>
            <button type="button" className="home-guest-login" onClick={() => onAuth?.()}>
              {t('connect', locale)}
            </button>
          </header>
          <div className="home-guest-copy">
            <h1 className="home-guest-title">{t('guestHeroTitle', locale)}</h1>
            <p className="home-guest-sub">{t('guestHeroSub', locale)}</p>
            <button type="button" className="btn-primary btn-lg home-guest-cta" onClick={() => onScanPlay()}>
              <span className="home-guest-cta-icon" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 8h2l1.5-2h9L18 8h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="12" cy="14" r="3.5" stroke="currentColor" strokeWidth="1.75" />
                </svg>
              </span>
              {t('guestHeroCta', locale)}
            </button>
          </div>
          <div className="home-guest-stage" aria-hidden="true" inert>
            <div className="home-guest-device">
              <aside className="home-guest-sheet">
                <p className="home-guest-sheet-title">Anglais : vocabulaire</p>
                <p>
                  <mark>chat</mark> — cat
                </p>
                <p>
                  <mark>chien</mark> — dog
                </p>
                <p>maison — house</p>
                <p className="home-guest-sheet-title">verbe être (to be)</p>
                <p>je suis — I am</p>
                <p>tu es — you are</p>
              </aside>
              <div className="home-guest-phone">
                <div className="home-guest-phone-frame" data-theme="light">
                  <span className="home-guest-island" />
                  <div className="home-guest-statusbar">
                    <span>9:41</span>
                    <span className="home-guest-statusbar-icons" />
                  </div>
                  <div className="home-guest-phone-screen">
                    <GamePath
                      locale={locale}
                      wordCount={GUEST_PREVIEW_PAIRS.length}
                      pairs={GUEST_PREVIEW_PAIRS}
                      pathStepCount={10}
                      onSelect={() => {}}
                      stepProgress={GUEST_PREVIEW_PROGRESS}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <SiteFooter locale={locale} />
        </main>
      </div>
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
            <>
              <HudStreakStat
                locale={locale}
                refreshKey={refreshKey}
                streakPulseKey={streakPulseKey}
                className="top-bar-streak"
              />
              <NotificationCenter locale={locale} refreshKey={refreshKey} onSocialChange={onSocialChange} />
            </>
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

        {loggedIn && (
          <HomeDashboard
            locale={locale}
            refreshKey={refreshKey}
            welcomeMessage={welcomeMessage}
            onRefresh={onRefresh}
          />
        )}

        {loggedIn && recentDecks[0] && onContinueLast && (
          <section className="home-continue-block">
            <p className="home-continue-hint">
              {t('homeContinueLastHint', locale).replace('{title}', recentDecks[0].title)}
            </p>
            <button type="button" className="btn-primary btn-lg home-continue-cta" onClick={onContinueLast}>
              {t('homeContinueLast', locale)}
            </button>
            <button type="button" className="btn-secondary home-continue-scan" onClick={() => onScanPlay()}>
              {t('homeScanAnother', locale)}
            </button>
          </section>
        )}

        {!(loggedIn && recentDecks[0]) && (
        <section
          className={`home-scan-hero premium-card${!loggedIn && canGuestScan() ? ' home-scan-hero--guest-trial' : ''}`}
        >
          <p className="tagline">{t('tagline', locale)}</p>
          <p className="subtagline">{t('subtagline', locale)}</p>

          {loggedIn &&
            (plan !== 'free' ? (
              <p className="scans-left scans-left--unlimited">
                ∞ {t('planPerkScansUnlimited', locale)}
              </p>
            ) : scansLeft !== Infinity ? (
              <p className="scans-left">
                {scansLeft} / 3 {t('scansToday', locale)}
              </p>
            ) : null)}

          {isDesktop ? (
            <div
              className={`home-dropzone ${dragOver ? 'home-dropzone--active' : ''}`}
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
              {!loggedIn && canGuestScan() && (
                <span className="home-dropzone-guest-badge">{t('guestScanTopPill', locale)}</span>
              )}
              <span className="home-dropzone-icon" aria-hidden="true">
                📄
              </span>
              <span className="home-dropzone-title">{t('importDrop', locale)}</span>
              <button
                type="button"
                className="btn-primary home-dropzone-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  fileRef.current?.click();
                }}
              >
                {t('scanPlayDesktop', locale)}
              </button>
            </div>
          ) : (
            <div className="camera-zone">
              <button
                type="button"
                className="camera-btn"
                onClick={() => onScanPlay()}
                aria-label={t('scanPlay', locale)}
              >
                <span className="camera-ring" />
                <span className="camera-inner">
                  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M4 8h2l1.5-2h9L18 8h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle cx="12" cy="14" r="3.5" stroke="currentColor" strokeWidth="1.75" />
                  </svg>
                </span>
              </button>
              <span className="camera-label">{t('scanPlay', locale)}</span>
              <p className="home-scan-hint">
                {!loggedIn && canGuestScan()
                  ? t('guestScanMobileHint', locale)
                  : t('homeScanHint', locale)}
              </p>
            </div>
          )}
        </section>
        )}

        {!loggedIn && canGuestScan() && onAuth && (
          <button type="button" className="guest-mobile-signup-teaser" onClick={onAuth}>
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
                  <div key={rec.id} className="home-ach-card unlocked">
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
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {showInstallButton && (
          <button type="button" className="btn-secondary home-install-btn" onClick={() => void handleInstall()}>
            {t('installApp', locale)}
          </button>
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
