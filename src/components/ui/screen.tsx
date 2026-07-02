import { type ReactNode } from 'react';
import { ScrollView, View, type ViewStyle } from 'react-native';
import { type Edge, SafeAreaView } from 'react-native-safe-area-context';

import { TAB_BAR_HEIGHT } from '@/components/navigation/metrics';
import { spacing, useTheme } from '@/theme';

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  /** Horizontal gutter padding (default true). */
  padded?: boolean;
  /** Safe-area edges to inset (default top only — bottom is the tab bar). */
  edges?: readonly Edge[];
  /** Add bottom spacing so content clears the floating tab bar (default true). */
  clearsTabBar?: boolean;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
}

export function Screen({
  children,
  scroll = false,
  padded = true,
  edges = ['top'],
  clearsTabBar = true,
  style,
  contentContainerStyle,
}: ScreenProps) {
  const theme = useTheme();
  const bottomPad = clearsTabBar ? TAB_BAR_HEIGHT + spacing.xl : spacing.xl;
  const gutter = padded ? spacing.gutter : 0;

  if (scroll) {
    return (
      <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: theme.colors.background }, style]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            { paddingHorizontal: gutter, paddingBottom: bottomPad, paddingTop: spacing.sm },
            contentContainerStyle,
          ]}>
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: theme.colors.background }, style]}>
      <View style={[{ flex: 1, paddingHorizontal: gutter, paddingBottom: bottomPad }, contentContainerStyle]}>
        {children}
      </View>
    </SafeAreaView>
  );
}
