import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  getNotifications,
  getUnreadCount,
  markAllRead,
  type AppNotification,
} from '../lib/notifications';
import { getAchievementDef } from '../lib/achievementUnlocks';
import { usePreferences } from '../hooks/usePreferences';
import {
  countUnreadSocialNotifications,
  listSocialNotifications,
  markSocialNotificationRead,
  respondFriendRequest,
} from '../lib/social/friends';
import { avatarEmojiFromId } from '../lib/social/avatars';
import { isSocialAvailable } from '../lib/social/publicProfile';
import type { SocialNotification } from '../lib/social/types';
import { t } from '../lib/i18n';
import type { Locale } from '../types';

interface NotificationCenterProps {
  locale: Locale;
  refreshKey?: number;
  onSocialChange?: () => void;
}

type PanelItem =
  | { source: 'local'; data: AppNotification }
  | { source: 'social'; data: SocialNotification };

function formatNotifBody(n: AppNotification, locale: Locale): string {
  if (n.type === 'achievement' && n.achievementId) {
    const def = getAchievementDef(n.achievementId);
    if (def) return t(def.nameKey, locale);
  }
  if (n.type === 'streak' && n.streakDays) {
    return t('notifStreakBody', locale).replace('{days}', String(n.streakDays));
  }
  if (n.bodyKey) return t(n.bodyKey as Parameters<typeof t>[0], locale);
  return '';
}

function socialTitle(n: SocialNotification, locale: Locale): string {
  if (n.kind === 'friend_request') return t('notifFriendRequestTitle', locale);
  if (n.kind === 'friend_accepted') return t('notifFriendAcceptedTitle', locale);
  return '';
}

function socialBody(n: SocialNotification, locale: Locale): string {
  const name = String(n.payload.from_display_name ?? '');
  if (n.kind === 'friend_request') {
    return t('notifFriendRequestBody', locale).replace('{name}', name);
  }
  if (n.kind === 'friend_accepted') {
    return t('notifFriendAcceptedBody', locale).replace('{name}', name);
  }
  return '';
}

function mergeItems(local: AppNotification[], social: SocialNotification[]): PanelItem[] {
  const merged: PanelItem[] = [
    ...local.map((data) => ({ source: 'local' as const, data })),
    ...social.map((data) => ({ source: 'social' as const, data })),
  ];
  merged.sort((a, b) => {
    const aTime =
      a.source === 'local'
        ? new Date(a.data.createdAt).getTime()
        : new Date(a.data.createdAt).getTime();
    const bTime =
      b.source === 'local'
        ? new Date(b.data.createdAt).getTime()
        : new Date(b.data.createdAt).getTime();
    return bTime - aTime;
  });
  return merged.slice(0, 16);
}

export function NotificationCenter({
  locale,
  refreshKey = 0,
  onSocialChange,
}: NotificationCenterProps) {
  const prefs = usePreferences();
  const notifsEnabled = prefs.notifications;
  const socialOk = isSocialAvailable();
  const [open, setOpen] = useState(false);
  const [localUnread, setLocalUnread] = useState(0);
  const [socialUnread, setSocialUnread] = useState(0);
  const [localItems, setLocalItems] = useState<AppNotification[]>([]);
  const [socialItems, setSocialItems] = useState<SocialNotification[]>([]);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    setLocalUnread(getUnreadCount());
    setLocalItems(getNotifications());

    if (!socialOk) {
      setSocialUnread(0);
      setSocialItems([]);
      return;
    }

    const [social, unread] = await Promise.all([
      listSocialNotifications(),
      countUnreadSocialNotifications(),
    ]);
    setSocialItems(social);
    setSocialUnread(unread);
  }, [socialOk]);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshKey]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (bellRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const markAcceptedSocialRead = async (items: SocialNotification[]) => {
    const unreadAccepted = items.filter((n) => n.kind === 'friend_accepted' && !n.readAt);
    await Promise.all(unreadAccepted.map((n) => markSocialNotificationRead(n.id)));
  };

  const toggle = () => {
    if (!notifsEnabled) return;
    if (!open) {
      markAllRead();
      void markAcceptedSocialRead(socialItems).then(() => refresh());
    }
    setOpen((o) => !o);
  };

  const handleRespond = async (requestId: string, accept: boolean) => {
    setRespondingId(requestId);
    const ok = await respondFriendRequest(requestId, accept);
    setRespondingId(null);
    if (ok) {
      onSocialChange?.();
      await refresh();
    }
  };

  const panelItems = mergeItems(localItems, socialItems);
  const totalUnread = localUnread + (socialOk ? socialUnread : 0);

  const panel = open
    ? createPortal(
        <>
          <button
            type="button"
            className="notification-backdrop"
            aria-label={t('back', locale)}
            onClick={() => setOpen(false)}
          />
          <div className="notification-panel" ref={panelRef} role="dialog" aria-label={t('notifications', locale)}>
            <h3 className="notification-panel-title">{t('notifications', locale)}</h3>
            {panelItems.length === 0 ? (
              <p className="notification-empty">{t('notifEmpty', locale)}</p>
            ) : (
              <ul className="notification-list">
                {panelItems.map((item) => {
                  if (item.source === 'local') {
                    const n = item.data;
                    return (
                      <li key={`local-${n.id}`} className={`notification-item ${n.read ? 'read' : 'unread'}`}>
                        <span className="notification-item-icon">{n.icon}</span>
                        <div className="notification-item-body">
                          <span className="notification-item-title">
                            {t(n.titleKey as Parameters<typeof t>[0], locale)}
                          </span>
                          <span className="notification-item-sub">{formatNotifBody(n, locale)}</span>
                        </div>
                      </li>
                    );
                  }

                  const n = item.data;
                  const unread = !n.readAt;
                  const requestId = String(n.payload.request_id ?? '');
                  const avatarId = String(n.payload.from_avatar_id ?? 'avatar1');

                  return (
                    <li
                      key={`social-${n.id}`}
                      className={`notification-item notification-item--social ${unread ? 'unread' : 'read'}`}
                    >
                      <span className="notification-item-icon">
                        {n.kind === 'friend_request' ? avatarEmojiFromId(avatarId) : '🤝'}
                      </span>
                      <div className="notification-item-body">
                        <span className="notification-item-title">{socialTitle(n, locale)}</span>
                        <span className="notification-item-sub">{socialBody(n, locale)}</span>
                        {n.kind === 'friend_request' && requestId && unread && (
                          <div className="notification-actions">
                            <button
                              type="button"
                              className="btn-primary btn-sm notification-action-btn"
                              disabled={respondingId === requestId}
                              onClick={() => void handleRespond(requestId, true)}
                            >
                              {t('friendsAccept', locale)}
                            </button>
                            <button
                              type="button"
                              className="btn-secondary btn-sm notification-action-btn"
                              disabled={respondingId === requestId}
                              onClick={() => void handleRespond(requestId, false)}
                            >
                              {t('friendsReject', locale)}
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>,
        document.body,
      )
    : null;

  return (
    <>
      <div className="notification-center">
        <button
          ref={bellRef}
          type="button"
          className={`notification-bell ${!notifsEnabled ? 'notification-bell--muted' : ''} ${notifsEnabled && totalUnread > 0 ? 'has-unread pulse' : ''}`}
          onClick={toggle}
          aria-label={
            notifsEnabled ? t('notifications', locale) : t('notificationsOff', locale)
          }
          aria-expanded={open}
          aria-disabled={!notifsEnabled}
        >
          <svg className="notification-bell-svg" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18 8a6 6 0 1 0-12 0c0 6-2.5 8.5-2.5 8.5h17S18 14 18 8Z" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {notifsEnabled && totalUnread > 0 && (
            <span className="notification-badge" aria-hidden="true">
              {totalUnread > 9 ? '9+' : totalUnread}
            </span>
          )}
        </button>
      </div>
      {panel}
    </>
  );
}
