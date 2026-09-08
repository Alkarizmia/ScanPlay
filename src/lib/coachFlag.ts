function envFlag(value: string | undefined): boolean | null {
  if (value == null || value === '') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
}

/** Chat Coach live in local `vite`/dev. Production stays “coming soon” unless VITE_COACH_CHAT=1. */
export function isCoachChatEnabled(): boolean {
  const override = envFlag(import.meta.env.VITE_COACH_CHAT);
  if (override != null) return override;
  return import.meta.env.DEV;
}
