import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Tabs } from 'expo-router';
import { type ComponentProps, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { I18nManager, type LayoutRectangle, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { timingConfig } from '@/lib/motion';
import { useTheme } from '@/theme';

import { TAB_BAR_HEIGHT } from './metrics';

// Derive the tab bar prop type from expo-router's Tabs (its bundled bottom-tabs
// types aren't re-exported from the package root).
type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

type IconName = keyof typeof Ionicons.glyphMap;

interface TabMeta {
  labelKey: string;
  icon: IconName;
  iconActive: IconName;
}

// The tab set and its order: Home, Requests, Calendar, Messages, More.
const TAB_ORDER = ['index', 'tasks', 'calendar', 'messages', 'more'] as const;

const TAB_META: Record<string, TabMeta> = {
  index: { labelKey: 'nav.home', icon: 'home-outline', iconActive: 'home-outline' },
  tasks: { labelKey: 'nav.requests', icon: 'checkbox-outline', iconActive: 'checkbox-outline' },
  calendar: { labelKey: 'nav.calendar', icon: 'calendar-clear-outline', iconActive: 'calendar-clear-outline' },
  messages: { labelKey: 'nav.messages', icon: 'chatbox-outline', iconActive: 'chatbox-outline' },
  more: { labelKey: 'nav.more', icon: 'menu-outline', iconActive: 'menu-outline' },
};

/** The mark on the top rule that says which tab is open. Ink, never gold: gold is the bridge's alone. */
const MARKER_WIDTH = 28;
const MARKER_HEIGHT = 2;

function TabIcon({ focused, name, color, reduced }: { focused: boolean; name: IconName; color: string; reduced: boolean }) {
  const scale = useSharedValue(focused ? 1 : 0.92);
  useEffect(() => {
    scale.value = withTiming(focused ? 1 : 0.92, timingConfig(reduced));
  }, [focused, reduced, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={style}>
      <Ionicons name={name} size={22} color={color} />
    </Animated.View>
  );
}

export function AppTabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { t } = useTranslation();
  const [layouts, setLayouts] = useState<Record<string, LayoutRectangle>>({});
  const [rowWidth, setRowWidth] = useState(0);

  const indicatorX = useSharedValue(0);
  const indicatorW = useSharedValue(0);

  // Render the tabs above, in that order.
  const tabs = TAB_ORDER.map((name) => state.routes.find((r) => r.name === name)).filter(
    (r): r is BottomTabBarProps['state']['routes'][number] => Boolean(r),
  );
  const openName = state.routes[state.index]?.name;
  const activeName = openName;
  const activeKey = tabs.find((r) => r.name === activeName)?.key;
  const activeLayout = activeKey ? layouts[activeKey] : undefined;
  const activeX = activeLayout ? activeLayout.x + (activeLayout.width - MARKER_WIDTH) / 2 : undefined;
  const activeW = activeLayout ? MARKER_WIDTH : undefined;
  // The indicator is anchored at the start edge (left in English, right in
  // Arabic) while onLayout reports x from the physical left. In right-to-left
  // the offset is therefore measured back from the right edge of the row.
  const activeOffset =
    activeX == null || activeW == null
      ? undefined
      : I18nManager.isRTL
        ? rowWidth > 0
          ? -(rowWidth - activeX - activeW)
          : undefined
        : activeX;

  useEffect(() => {
    if (activeOffset == null || activeW == null) return;
    indicatorX.value = withTiming(activeOffset, timingConfig(reduced));
    indicatorW.value = withTiming(activeW, timingConfig(reduced));
  }, [activeOffset, activeW, reduced, indicatorX, indicatorW]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: indicatorW.value,
  }));

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background,
          borderTopColor: theme.colors.border,
          paddingBottom: insets.bottom,
          height: TAB_BAR_HEIGHT + insets.bottom,
        },
      ]}>
      <View style={styles.row} onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}>
        <Animated.View
          pointerEvents="none"
          style={[styles.indicator, { backgroundColor: theme.colors.foreground }, indicatorStyle]}
        />
        {tabs.map((route) => {
          const focused = route.name === activeName;
          const meta = TAB_META[route.name];
          const color = focused ? theme.colors.foreground : theme.colors.mutedForeground;

          const onPress = () => {
            if (process.env.EXPO_OS !== 'web') {
              Haptics.selectionAsync().catch(() => {});
            }
            const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (route.name !== openName && !event.defaultPrevented) {
              navigateToTab(route.key);
            }
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={t(meta.labelKey)}
              onPress={onPress}
              onLayout={(e) => {
                const layout = e.nativeEvent.layout;
                setLayouts((prev) => ({ ...prev, [route.key]: layout }));
              }}
              style={styles.tab}>
              <TabIcon focused={focused} name={focused ? meta.iconActive : meta.icon} color={color} reduced={reduced} />
              <Text variant="caption" weight={focused ? 'semibold' : 'medium'} style={{ color }} numberOfLines={1}>
                {t(meta.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  tab: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  indicator: {
    position: 'absolute',
    start: 0,
    top: -StyleSheet.hairlineWidth,
    height: MARKER_HEIGHT,
  },
});
