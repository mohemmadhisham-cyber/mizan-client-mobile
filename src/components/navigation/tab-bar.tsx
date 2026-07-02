import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Tabs } from 'expo-router';
import { type ComponentProps, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type LayoutRectangle, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { timingConfig } from '@/lib/motion';
import { radius, useTheme } from '@/theme';

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

// The Figma tab set + order: Home · Activity · AI Advisor · Reports · Tasks.
const TAB_ORDER = ['index', 'activity', 'ai-advisor', 'reports', 'tasks'] as const;

const TAB_META: Record<string, TabMeta> = {
  index: { labelKey: 'nav.home', icon: 'home-outline', iconActive: 'home' },
  activity: { labelKey: 'nav.activity', icon: 'pulse-outline', iconActive: 'pulse' },
  'ai-advisor': { labelKey: 'nav.aiAdvisor', icon: 'sparkles-outline', iconActive: 'sparkles' },
  reports: { labelKey: 'nav.reports', icon: 'bar-chart-outline', iconActive: 'bar-chart' },
  tasks: { labelKey: 'nav.tasks', icon: 'checkmark-circle-outline', iconActive: 'checkmark-circle' },
};

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

export function AppTabBar({ state, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { t } = useTranslation();
  const [layouts, setLayouts] = useState<Record<string, LayoutRectangle>>({});

  const indicatorX = useSharedValue(0);
  const indicatorW = useSharedValue(0);

  // Render only the Figma tabs, in order (documents/more are href:null routes).
  const tabs = TAB_ORDER.map((name) => state.routes.find((r) => r.name === name)).filter(
    (r): r is BottomTabBarProps['state']['routes'][number] => Boolean(r),
  );
  const activeName = state.routes[state.index]?.name;
  const activeKey = tabs.find((r) => r.name === activeName)?.key;
  const activeLayout = activeKey ? layouts[activeKey] : undefined;
  const activeX = activeLayout?.x;
  const activeW = activeLayout?.width;

  useEffect(() => {
    if (activeX == null || activeW == null) return;
    indicatorX.value = withTiming(activeX, timingConfig(reduced));
    indicatorW.value = withTiming(activeW, timingConfig(reduced));
  }, [activeX, activeW, reduced, indicatorX, indicatorW]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: indicatorW.value,
  }));

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.secondary,
          borderTopColor: theme.colors.border,
          paddingBottom: insets.bottom,
          height: TAB_BAR_HEIGHT + insets.bottom,
          shadowColor: '#000',
        },
      ]}>
      <View style={styles.row}>
        <Animated.View
          pointerEvents="none"
          style={[styles.indicator, { backgroundColor: theme.colors.accent }, indicatorStyle]}
        />
        {tabs.map((route) => {
          const focused = route.name === activeName;
          const meta = TAB_META[route.name];
          const color = focused ? theme.colors.primary : theme.colors.mutedForeground;

          const onPress = () => {
            if (process.env.EXPO_OS !== 'web') {
              Haptics.selectionAsync().catch(() => {});
            }
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
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
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 12,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
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
    left: 0,
    top: 10,
    height: TAB_BAR_HEIGHT - 20,
    borderRadius: radius.md,
  },
});
