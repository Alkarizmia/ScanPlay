function envFlag(value: string | undefined): boolean | null {
  if (value == null || value === '') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
}

/** Chat Coach is live everywhere. Set VITE_COACH_CHAT=0 to show the coming-soon screen. */
export function isCoachChatEnabled(): boolean {
  const override = envFlag(import.meta.env.VITE_COACH_CHAT);
  if (override != null) return override;
  return true;
}
