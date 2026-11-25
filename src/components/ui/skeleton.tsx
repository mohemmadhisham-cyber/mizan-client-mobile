import { useEffect } from 'react';
import { type DimensionValue, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { radius as radii, useTheme } from '@/theme';

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 16, radius = radii.md, style }: SkeletonProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const reduced = useReducedMotion();
  const pulse = useSharedValue(reduced ? 0.6 : 0.4);

  useEffect(() => {
    if (reduced) {
      pulse.value = 0.6;
      return;
    }
    pulse.value = withRepeat(withTiming(0.9, { duration: 800 }), -1, true);
  }, [reduced, pulse]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      accessibilityLabel={t('common.loading')}
      style={[
        { width, height, borderRadius: radius, backgroundColor: theme.colors.muted },
        animatedStyle,
        style,
      ]}
    />
  );
}
