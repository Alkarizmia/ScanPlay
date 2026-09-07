import { FriendAchievementsGrid } from './FriendAchievementsGrid';
import { BackIcon } from './icons/BackIcon';
import { LootCoin } from './icons/EconomyIcons';
import { PlayerAvatar } from './PlayerAvatar';
import { ProfileCard } from './ProfileCard';
import { SendCoinsSheet } from './SendCoinsSheet';
import { createPortal } from 'react-dom';
import { getFriendProfile, removeFriend } from '../lib/social/friends';
import type { FriendProfile, FriendStatus, PublicPlayer } from '../lib/social/types';
import { t } from '../lib/i18n';
import type { Locale } from '../types';
import { useEffect, useState } from 'react';
import { getAchievementDef } from '../lib/achievementUnlocks';

interface FriendProfileSheetProps {
  open: boolean;
  userId: string | null;
  locale: Locale;
  onClose: () => void;
  onRemoved?: () => void;
  onWalletChange?: () => void;
  preview?: boolean;
  friendStatus?: FriendStatus;
  seed?: PublicPlayer | null;
  onAdd?: () => void;
}

export function FriendProfileSheet({
  open,
  userId,
  locale,
  onClose,
  onRemoved,
  onWalletChange,
  preview = false,
  friendStatus = 'friends',
  seed = null,
  onAdd,
}: FriendProfileSheetProps) {
  const [profile, setProfile] = useState<FriendProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [sendCoinsOpen, setSendCoinsOpen] = useState(false);
  const [showAllAchievements, setShowAllAchievements] = useState(false);

  useEffect(() => {
    if (!open || !userId) {
      setProfile(null);
      setShowAllAchievements(false);
      return;
    }
    setLoading(true);
    void getFriendProfile(userId).then((p) => {
      setProfile(p);
      setLoading(false);
    });
  }, [open, userId]);

  if (!open || !userId) return null;

  const handleRemove = async () => {
    setRemoving(true);
    const ok = await removeFriend(userId);
    setRemoving(false);
    if (ok) {
      onRemoved?.();
      onClose();
    }
  };

  const featured = (profile?.achievementUnlocks ?? [])
    .slice(0, 4)
    .map((u) => getAchievementDef(u.id))
    .filter((d): d is NonNullable<typeof d> => Boolean(d));

  return createPortal(
    <>
      <button
        type="button"
        className="install-sheet-backdrop"
        aria-label={t('back', locale)}
        onClick={onClose}
      />
      <div className="friend-profile-sheet" role="dialog" aria-labelledby="friend-profile-title">
        <button type="button" className="icon-btn friend-profile-close" onClick={onClose} aria-label={t('back', locale)}>
          <BackIcon />
        </button>

        {loading && <p className="friends-loading">{t('scanning', locale)}</p>}

        {!loading && profile && (
          <>
            <h3 id="friend-profile-title" className="sr-only">
              {profile.displayName}
            </h3>
            <ProfileCard
              locale={locale}
              displayName={profile.displayName}
              level={profile.level}
              xp={profile.xp}
              streak={profile.streak}
              friendCount={profile.friendCount}
              plan={profile.plan}
              featuredAchievements={featured}
              stats={[
                { label: t('xp', locale), value: String(profile.xp) },
                { label: t('streak', locale), value: String(profile.streak) },
                { label: t('friendsAchievementsShort', locale), value: String(profile.achievementCount) },
              ]}
              avatar={
                <PlayerAvatar
                  avatarId={profile.avatarId}
                  avatarUrl={profile.avatarUrl}
                  className="friend-avatar friend-avatar--lg"
                  imgClassName="friend-avatar-img friend-avatar-img--lg"
                />
              }
            />

            <section className="friend-achievements-section">
              <h4 className="settings-label">{t('friendAchievementsTitle', locale)}</h4>
              {showAllAchievements ? (
                <>
                  <FriendAchievementsGrid unlocks={profile.achievementUnlocks} locale={locale} />
                  <button
                    type="button"
                    className="btn-ghost friend-achievements-toggle"
                    onClick={() => setShowAllAchievements(false)}
                  >
                    {t('friendAchievementsHide', locale)}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn-secondary btn-lg friend-achievements-toggle"
                  disabled={profile.achievementCount <= 0}
                  onClick={() => setShowAllAchievements(true)}
                >
                  {t('friendViewAllAchievements', locale).replace('{count}', String(profile.achievementCount))}
                </button>
              )}
            </section>

            <button
              type="button"
              className="btn-secondary btn-lg friend-send-coins-btn"
              onClick={() => setSendCoinsOpen(true)}
            >
              <LootCoin size={16} /> {t('sendCoinsBtn', locale)}
            </button>

            {preview && friendStatus !== 'friends' ? (
              <button
                type="button"
                className="btn-primary btn-lg"
                disabled={friendStatus === 'pending_sent'}
                onClick={() => onAdd?.()}
              >
                {friendStatus === 'pending_received'
                  ? t('friendsAccept', locale)
                  : friendStatus === 'pending_sent'
                    ? t('friendsStatusPendingSent', locale)
                    : t('friendsPreviewAdd', locale)}
              </button>
            ) : (
              <button
                type="button"
                className="btn-danger btn-lg friend-remove-btn"
                disabled={removing}
                onClick={() => void handleRemove()}
              >
                {t('friendsRemove', locale)}
              </button>
            )}
          </>
        )}

        {!loading && !profile && seed && (
          <>
            <ProfileCard
              locale={locale}
              displayName={seed.displayName}
              level={seed.level}
              xp={seed.xp ?? 0}
              streak={seed.streak ?? 0}
              featuredAchievements={[]}
              stats={[{ label: t('level', locale), value: String(seed.level) }]}
              avatar={
                <PlayerAvatar
                  avatarId={seed.avatarId}
                  avatarUrl={seed.avatarUrl}
                  className="friend-avatar friend-avatar--lg"
                  imgClassName="friend-avatar-img friend-avatar-img--lg"
                />
              }
            />
            <section className="friend-achievements-section">
              <h4 className="settings-label">{t('friendAchievementsTitle', locale)}</h4>
              <button
                type="button"
                className="btn-secondary btn-lg friend-achievements-toggle"
                disabled={(seed.achievementCount ?? 0) <= 0}
              >
                {t('friendViewAllAchievements', locale).replace('{count}', String(seed.achievementCount ?? 0))}
              </button>
            </section>
            <button
              type="button"
              className="btn-secondary btn-lg friend-send-coins-btn"
              onClick={() => setSendCoinsOpen(true)}
            >
              <LootCoin size={16} /> {t('sendCoinsBtn', locale)}
            </button>
            {preview && friendStatus !== 'friends' && (
              <button
                type="button"
                className="btn-primary btn-lg friend-send-coins-btn"
                disabled={friendStatus === 'pending_sent'}
                onClick={() => onAdd?.()}
              >
                {t('friendsPreviewAdd', locale)}
              </button>
            )}
          </>
        )}

        {!loading && !profile && !seed && (
          <p className="friends-error">{t('friendsProfileUnavailable', locale)}
          </p>
        )}

        {sendCoinsOpen && (profile || seed) && (
          <SendCoinsSheet
            locale={locale}
            friendName={profile?.displayName ?? seed?.displayName ?? ''}
            friendUserId={userId}
            onClose={() => setSendCoinsOpen(false)}
            onSuccess={() => {
              onWalletChange?.();
            }}
          />
        )}
      </div>
    </>,
    document.body,
  );
}
