import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { radius, spacing, useTheme } from '@/theme';

function Dot({ delay, reduced }: { delay: number; reduced: boolean }) {
  const theme = useTheme();
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    if (reduced) {
      opacity.value = 0.6;
      return;
    }
    opacity.value = withDelay(
      delay,
      withRepeat(withSequence(withTiming(1, { duration: 350 }), withTiming(0.3, { duration: 350 })), -1, true),
    );
  }, [reduced, delay, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.mutedForeground }, style]} />;
}

export function TypingIndicator() {
  const theme = useTheme();
  const reduced = useReducedMotion();

  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm, alignSelf: 'flex-start' }}>
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: radius.full,
          backgroundColor: theme.colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      />
      <View
        style={[
          {
            flexDirection: 'row',
            gap: 4,
            alignItems: 'center',
            backgroundColor: theme.colors.card,
            borderRadius: radius.xl,
            borderTopLeftRadius: 4,
            paddingHorizontal: spacing.base,
            paddingVertical: spacing.md,
          },
          theme.elevation.xs,
        ]}>
        <Dot delay={0} reduced={reduced} />
        <Dot delay={150} reduced={reduced} />
        <Dot delay={300} reduced={reduced} />
      </View>
    </View>
  );
}
