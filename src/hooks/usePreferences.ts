import { useEffect, useState } from 'react';
import {
  getPreferences,
  subscribePreferences,
  type UserPreferences,
} from '../lib/preferences';

export function usePreferences(): UserPreferences {
  const [prefs, setPrefs] = useState(getPreferences);

  useEffect(() => subscribePreferences(() => setPrefs(getPreferences())), []);

  return prefs;
}
