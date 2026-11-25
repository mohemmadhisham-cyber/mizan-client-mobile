import { type ReactNode } from 'react';
import { ScrollView, View, type ViewStyle } from 'react-native';
import { type Edge, SafeAreaView } from 'react-native-safe-area-context';

import { TAB_BAR_HEIGHT } from '@/components/navigation/metrics';
import { spacing, useTheme } from '@/theme';

import { AppRefreshControl } from './refresh';

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  /** Horizontal gutter padding (default true). */
  padded?: boolean;
  /** Safe-area edges to inset (default top only — bottom is the tab bar). */
  edges?: readonly Edge[];
  /** Add bottom spacing so content clears the floating tab bar (default true). */
  clearsTabBar?: boolean;
  /** Full-bleed element rendered above the padded content (e.g. AppHeader). */
  header?: ReactNode;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  /** Pull to refresh, for `scroll` screens. Pass both to enable it. */
  refreshing?: boolean;
  onRefresh?: () => void;
}

export function Screen({
  children,
  scroll = false,
  padded = true,
  edges = ['top'],
  clearsTabBar = true,
  header,
  style,
  contentContainerStyle,
  refreshing = false,
  onRefresh,
}: ScreenProps) {
  const theme = useTheme();
  const bottomPad = clearsTabBar ? TAB_BAR_HEIGHT + spacing.xl : spacing.xl;
  const gutter = padded ? spacing.gutter : 0;

  return (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: theme.colors.background }, style]}>
      {header}
      {scroll ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={onRefresh ? <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
          contentContainerStyle={[
            { paddingHorizontal: gutter, paddingBottom: bottomPad, paddingTop: spacing.sm },
            contentContainerStyle,
          ]}>
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1, paddingHorizontal: gutter, paddingBottom: bottomPad }, contentContainerStyle]}>
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}
