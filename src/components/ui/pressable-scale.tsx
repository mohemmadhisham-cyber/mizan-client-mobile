import { type ReactNode } from 'react';
import { Pressable, type PressableProps } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { duration } from '@/theme';

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

interface PressableScaleProps extends PressableProps {
  children: ReactNode;
  /** Scale applied on press-in (default 0.94). */
  scaleTo?: number;
}

/**
 * Shared tactile press feedback (subtle scale-down) for icon-only touch
 * targets that otherwise have no visual response — falls back to no motion
 * when the OS reduce-motion setting is on.
 */
export function PressableScale({ children, scaleTo = 0.94, style, onPressIn, onPressOut, ...rest }: PressableScaleProps) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Reanimated shared values are mutated by design (its whole API model), but
  // the React Compiler's static analysis doesn't recognize that from inside
  // an inline event-handler closure the way it does inside useEffect bodies
  // (see tab-bar.tsx/typing-indicator.tsx for the useEffect-based pattern).
  function handlePressIn(e: Parameters<NonNullable<PressableProps['onPressIn']>>[0]) {
    // eslint-disable-next-line react-hooks/immutability -- Reanimated shared-value mutation, not React state
    if (!reduced) scale.value = withTiming(scaleTo, { duration: duration.fast });
    onPressIn?.(e);
  }

  function handlePressOut(e: Parameters<NonNullable<PressableProps['onPressOut']>>[0]) {
    // eslint-disable-next-line react-hooks/immutability -- Reanimated shared-value mutation, not React state
    if (!reduced) scale.value = withTiming(1, { duration: duration.fast });
    onPressOut?.(e);
  }

  return (
    <AnimatedPressableBase
      style={[style, reduced ? undefined : animatedStyle]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      {...rest}>
      {children}
    </AnimatedPressableBase>
  );
}
