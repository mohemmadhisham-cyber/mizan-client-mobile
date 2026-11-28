import { type ReactElement, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { type Edge, SafeAreaView } from 'react-native-safe-area-context';

import { TAB_BAR_HEIGHT } from '@/components/navigation/metrics';
import { spacing, useTheme } from '@/theme';

import { AppRefreshControl } from './refresh';

interface ScreenListProps<T> {
  data: readonly T[];
  renderItem: (item: T) => ReactElement;
  keyExtractor: (item: T) => string;
  /** Full-bleed element above the list (e.g. AppHeader). */
  header?: ReactNode;
  /** Scrolls with the list, above the first row (title, primary action). */
  listHeader?: ReactElement;
  /** Shown instead of rows when `data` is empty (skeleton or empty state). */
  listEmpty?: ReactElement;
  /** Scrolls with the list, below the last row. */
  listFooter?: ReactElement;
  /** Space between rows (default `spacing.sm`). */
  gap?: number;
  edges?: readonly Edge[];
  /** Add bottom spacing so the last row clears the tab bar (default true). */
  clearsTabBar?: boolean;
  /** Called near the end of the list; load the next page here. */
  onEndReached?: () => void;
  /** Shows a spinner under the last row while the next page loads. */
  loadingMore?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}

/**
 * The list counterpart of `Screen scroll`: the same gutters and tab-bar
 * clearance, but rows are virtualised, so a list of hundreds stays smooth and
 * light on memory. Use it for any screen whose main content is one list.
 */
export function ScreenList<T>({
  data,
  renderItem,
  keyExtractor,
  header,
  listHeader,
  listEmpty,
  listFooter,
  gap = spacing.sm,
  edges = ['top'],
  clearsTabBar = true,
  onEndReached,
  loadingMore = false,
  refreshing = false,
  onRefresh,
}: ScreenListProps<T>) {
  const theme = useTheme();
  const bottomPad = clearsTabBar ? TAB_BAR_HEIGHT + spacing.xl : spacing.xl;

  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {header}
      <FlatList
        data={data}
        renderItem={({ item }) => renderItem(item)}
        keyExtractor={keyExtractor}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty ?? undefined}
        ListFooterComponent={
          loadingMore || listFooter ? (
            <View>
              {loadingMore ? <ActivityIndicator color={theme.colors.primary} style={{ paddingVertical: spacing.md }} /> : null}
              {listFooter}
            </View>
          ) : undefined
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.gutter, paddingTop: spacing.sm, paddingBottom: bottomPad, gap }}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        refreshControl={onRefresh ? <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
      />
    </SafeAreaView>
  );
}
