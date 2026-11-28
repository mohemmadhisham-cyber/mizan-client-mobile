import { type ReactElement } from 'react';
import { ActivityIndicator, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppRefreshControl } from '@/components/ui';
import { useTheme } from '@/theme';

import { HORIZON_GUTTER } from './horizon-screen';

const FOOTER_SPACE = 16;

interface HorizonListProps<T> {
  data: readonly T[];
  renderItem: (item: T) => ReactElement;
  keyExtractor: (item: T) => string;
  /** Scrolls with the list, above the first row. */
  listHeader?: ReactElement;
  /** Shown instead of rows when `data` is empty: loading, failed, or nothing yet. */
  listEmpty?: ReactElement;
  /** Called near the end of the list; load the next page here. */
  onEndReached?: () => void;
  /** Shows a spinner under the last row while the next page loads. */
  loadingMore?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Keep the last row clear of the home indicator (default true). False on tab screens. */
  safeBottom?: boolean;
}

/**
 * A long list on a Horizon ground. Rows are virtualised, so hundreds stay
 * smooth. Use it inside `HorizonScreen` with `scroll={false}` and
 * `safeBottom={false}`: the list scrolls, the frame does not, and the list
 * keeps its own last row clear of the home indicator.
 */
export function HorizonList<T>({
  data,
  renderItem,
  keyExtractor,
  listHeader,
  listEmpty,
  onEndReached,
  loadingMore = false,
  refreshing = false,
  onRefresh,
  safeBottom = true,
}: HorizonListProps<T>) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <FlatList
      data={data}
      renderItem={({ item }) => renderItem(item)}
      keyExtractor={keyExtractor}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={listEmpty}
      ListFooterComponent={
        loadingMore ? (
          <ActivityIndicator color={theme.colors.foreground} style={{ paddingVertical: FOOTER_SPACE }} />
        ) : undefined
      }
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: (safeBottom ? insets.bottom : 0) + HORIZON_GUTTER }}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      refreshControl={onRefresh ? <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
    />
  );
}
