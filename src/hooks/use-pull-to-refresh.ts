import { useCallback, useState } from 'react';

/**
 * Pull-to-refresh state for a screen. The spinner shows only for a pull the
 * person started, never for a background refetch. A refresh that fails still
 * ends the spinner; the screen's own error state reports the failure.
 */
export function usePullToRefresh(refresh: () => Promise<unknown>): { refreshing: boolean; onRefresh: () => void } {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refresh()
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }, [refresh]);

  return { refreshing, onRefresh };
}
