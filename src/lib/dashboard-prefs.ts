import { useCallback, useState } from 'react';

import { readDevicePref, writeDevicePref } from '@/lib/device-prefs';

export type DashboardSection = 'cashFlow' | 'criticalTasks' | 'thisMonth' | 'whatChanged' | 'expenseTrend';

export type DashboardVisibility = Record<DashboardSection, boolean>;

const STORAGE_KEY = 'dashboard_visible_sections';

const DEFAULT_VISIBILITY: DashboardVisibility = {
  cashFlow: true,
  criticalTasks: true,
  thisMonth: true,
  whatChanged: true,
  expenseTrend: true,
};

/** Translation key of each section's label (see `dashboard.*` in src/i18n). */
export const DASHBOARD_SECTION_LABEL_KEY: Record<DashboardSection, string> = {
  cashFlow: 'dashboard.sectionCashFlow',
  criticalTasks: 'dashboard.sectionCriticalTasks',
  thisMonth: 'dashboard.sectionThisMonth',
  whatChanged: 'dashboard.sectionWhatChanged',
  expenseTrend: 'dashboard.sectionExpenseTrend',
};

function isDashboardVisibility(value: unknown): value is DashboardVisibility {
  if (!value || typeof value !== 'object') return false;
  return Object.keys(DEFAULT_VISIBILITY).every((k) => typeof (value as Record<string, unknown>)[k] === 'boolean');
}

/** What is stored on this device, or the defaults when nothing usable is. */
function storedVisibility(): DashboardVisibility {
  const raw = readDevicePref(STORAGE_KEY);
  if (!raw) return DEFAULT_VISIBILITY;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isDashboardVisibility(parsed) ? parsed : DEFAULT_VISIBILITY;
  } catch {
    // Corrupted/legacy value — fall back to defaults silently.
    return DEFAULT_VISIBILITY;
  }
}

/** Local-only preference (not synced across devices) for which optional
 * dashboard sections are shown. Home always keeps the hero + quick actions.
 *
 * Read through device-prefs, which works on web too: calling SecureStore
 * directly threw there and covered the app with an error. The read is
 * synchronous, so the saved choice applies on the first frame. */
export function useDashboardPrefs() {
  const [visible, setVisibleState] = useState<DashboardVisibility>(storedVisibility);

  const setVisible = useCallback((next: DashboardVisibility) => {
    setVisibleState(next);
    void writeDevicePref(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const toggle = useCallback(
    (section: DashboardSection) => {
      setVisible({ ...visible, [section]: !visible[section] });
    },
    [visible, setVisible],
  );

  return { visible, toggle, loading: false };
}
