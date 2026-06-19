import type { AchievementId } from './achievements';
import { isLoggedIn } from './auth';
import { hapticNotification } from './haptics';
import { areNotificationsEnabled } from './preferences';

const KEY = 'scanplay-notifications';
const MAX = 40;

export type NotificationType = 'achievement' | 'streak' | 'gold' | 'weekly' | 'reminder';

export interface AppNotification {
  id: string;
  type: NotificationType;
  icon: string;
  titleKey: string;
  bodyKey?: string;
  achievementId?: AchievementId;
  streakDays?: number;
  read: boolean;
  createdAt: string;
}

export function loadNotificationsRaw(): AppNotification[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function saveNotificationsRaw(items: AppNotification[]): void {
  localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
}

function persist(items: AppNotification[]): void {
  if (!isLoggedIn()) return;
  saveNotificationsRaw(items);
  void import('./sync').then((m) => m.scheduleSync());
}

export function getNotifications(): AppNotification[] {
  return loadNotificationsRaw().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function getUnreadCount(): number {
  return getNotifications().filter((n) => !n.read).length;
}

export function markAllRead(): void {
  const items = getNotifications().map((n) => ({ ...n, read: true }));
  persist(items);
}

export function addNotification(
  partial: Omit<AppNotification, 'id' | 'read' | 'createdAt'>,
): void {
  if (!isLoggedIn() || !areNotificationsEnabled()) return;
  const item: AppNotification = {
    ...partial,
    id: crypto.randomUUID(),
    read: false,
    createdAt: new Date().toISOString(),
  };
  void import('./sounds').then((m) => m.playSound('notification'));
  hapticNotification();
  persist([item, ...getNotifications()]);
}

export function notifyAchievementUnlock(achievementId: AchievementId, icon: string): void {
  addNotification({
    type: 'achievement',
    icon,
    titleKey: 'notifAchievementTitle',
    bodyKey: 'notifAchievementBody',
    achievementId,
  });
}

export function notifyStreakMilestone(days: number): void {
  addNotification({
    type: 'streak',
    icon: '🔥',
    titleKey: 'notifStreakTitle',
    bodyKey: 'notifStreakBody',
    streakDays: days,
  });
}

export function notifyGoldStep(): void {
  addNotification({
    type: 'gold',
    icon: '🥇',
    titleKey: 'notifGoldTitle',
    bodyKey: 'notifGoldBody',
  });
}
