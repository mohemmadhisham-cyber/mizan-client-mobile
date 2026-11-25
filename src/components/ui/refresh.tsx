import { RefreshControl } from 'react-native';

import { useTheme } from '@/theme';

interface AppRefreshControlProps {
  refreshing: boolean;
  onRefresh: () => void;
}

/** Pull-to-refresh spinner in the theme's colours (follows dark mode and co-branding). */
export function AppRefreshControl({ refreshing, onRefresh }: AppRefreshControlProps) {
  const theme = useTheme();
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={theme.colors.primary}
      colors={[theme.colors.primary]}
      progressBackgroundColor={theme.colors.card}
    />
  );
}
