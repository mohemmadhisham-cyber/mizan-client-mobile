import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { spacing, useTheme } from '@/theme';

const BUBBLE_RADIUS = 14;
const BUBBLE_TAIL = 3;
const DOT = 8;

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
  return <Animated.View style={[{ width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: theme.colors.mutedForeground }, style]} />;
}

/** The advisor is writing: three dots in the same outlined shape as its answers. */
export function TypingIndicator({ label }: { label?: string }) {
  const theme = useTheme();
  const reduced = useReducedMotion();

  return (
    <View
      accessible
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: 'row',
        gap: 4,
        alignItems: 'center',
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: BUBBLE_RADIUS,
        // The tight corner points at the speaker; logical, so it mirrors in Arabic.
        borderBottomStartRadius: BUBBLE_TAIL,
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.md,
      }}>
      <Dot delay={0} reduced={reduced} />
      <Dot delay={150} reduced={reduced} />
      <Dot delay={300} reduced={reduced} />
    </View>
  );
}
