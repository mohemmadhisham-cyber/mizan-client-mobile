import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useState } from 'react';

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

/** Local-only preference (not synced across devices) for which optional
 * dashboard sections are shown. Home always keeps the hero + quick actions. */
export function useDashboardPrefs() {
  const [visible, setVisibleState] = useState<DashboardVisibility>(DEFAULT_VISIBILITY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    SecureStore.getItemAsync(STORAGE_KEY).then((raw) => {
      if (!mounted) return;
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (isDashboardVisibility(parsed)) setVisibleState(parsed);
        } catch {
          // Corrupted/legacy value — fall back to defaults silently.
        }
      }
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const setVisible = useCallback((next: DashboardVisibility) => {
    setVisibleState(next);
    void SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const toggle = useCallback(
    (section: DashboardSection) => {
      setVisible({ ...visible, [section]: !visible[section] });
    },
    [visible, setVisible],
  );

  return { visible, toggle, loading };
}
