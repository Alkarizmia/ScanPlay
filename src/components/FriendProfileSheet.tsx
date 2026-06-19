import { FriendAchievementsGrid } from './FriendAchievementsGrid';

import { PlayerAvatar } from './PlayerAvatar';

import { SendCoinsSheet } from './SendCoinsSheet';

import { createPortal } from 'react-dom';

import { getFriendProfile, removeFriend } from '../lib/social/friends';

import type { FriendProfile } from '../lib/social/types';

import { PlanBadge } from './PlanBadge';

import { t } from '../lib/i18n';

import type { Locale } from '../types';

import { useEffect, useState } from 'react';



interface FriendProfileSheetProps {

  open: boolean;

  userId: string | null;

  locale: Locale;

  onClose: () => void;

  onRemoved: () => void;

  onWalletChange?: () => void;

}



export function FriendProfileSheet({

  open,

  userId,

  locale,

  onClose,

  onRemoved,

  onWalletChange,

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

      onRemoved();

      onClose();

    }

  };



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

          ←

        </button>



        {loading && <p className="friends-loading">{t('scanning', locale)}</p>}



        {!loading && profile && (

          <>

            <div className="friend-profile-header">

              <PlayerAvatar

                avatarId={profile.avatarId}

                avatarUrl={profile.avatarUrl}

                className="friend-avatar friend-avatar--lg"

                imgClassName="friend-avatar-img friend-avatar-img--lg"

              />

              <h3 id="friend-profile-title" className="friend-profile-name">

                {profile.displayName}

              </h3>

              <p className="friend-profile-level">

                {t('level', locale)} {profile.level}

              </p>

              <div className="friend-profile-meta">

                <PlanBadge plan={profile.plan} locale={locale} />

                <span className="friend-profile-friends">

                  👥 {profile.friendCount} {t('friendsCountLabel', locale)}

                </span>

              </div>

            </div>



            <div className="stats-grid profile-stats-grid">

              <div className="stat-tile">

                <span className="stat-tile-val">{profile.xp}</span>

                <span className="stat-tile-label">{t('xp', locale)}</span>

              </div>

              <div className="stat-tile">

                <span className="stat-tile-val">{profile.streak}</span>

                <span className="stat-tile-label">{t('streak', locale)}</span>

              </div>

              <div className="stat-tile">

                <span className="stat-tile-val">{profile.achievementCount}</span>

                <span className="stat-tile-label">{t('friendsAchievementsShort', locale)}</span>

              </div>

            </div>



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

              🪙 {t('sendCoinsBtn', locale)}

            </button>



            <button

              type="button"

              className="btn-danger btn-lg friend-remove-btn"

              disabled={removing}

              onClick={() => void handleRemove()}

            >

              {t('friendsRemove', locale)}

            </button>

          </>

        )}



        {!loading && !profile && (

          <p className="friends-error">{t('friendsProfileUnavailable', locale)}</p>

        )}



        {sendCoinsOpen && profile && (

          <SendCoinsSheet

            locale={locale}

            friendName={profile.displayName}

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


