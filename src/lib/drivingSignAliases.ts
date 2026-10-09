/** Legacy slug ids → official Belgian codes (Wikimedia catalog). */
export const DRIVING_SIGN_ALIASES: Record<string, string> = {
  'danger-curve-left': 'A1a',
  'danger-double-curve': 'A1c',
  'danger-two-way': 'A7a',
  'danger-slippery': 'A7b',
  'danger-children': 'A23',
  'danger-pedestrian': 'A21',
  'danger-cyclist': 'A25',
  'danger-narrow': 'A5',
  'forbid-no-entry': 'C1',
  'forbid-no-access': 'C3',
  'forbid-no-u-turn': 'C31a',
  'forbid-no-parking': 'E1',
  'forbid-no-stopping': 'E3',
  'park-1-15': 'E5',
  'park-16-31': 'E7',
  'priority-give-way': 'B1',
  'priority-stop': 'B5',
  'priority-road': 'B9',
  'priority-end': 'B11',
  'priority-right': 'B17',
  'oblig-right': 'D1b',
  'oblig-roundabout': 'D5',
  'oblig-straight': 'D1a',
  'info-one-way': 'F19',
  'info-dead-end': 'F45',
  'info-cycle-path': 'D7',
  'info-motorway': 'F5',
};

export function resolveDrivingSignId(id: string): string {
  return DRIVING_SIGN_ALIASES[id] ?? id;
}
