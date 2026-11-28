import { useEffect, useRef } from 'react';
import { Easing, type SharedValue, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { easing } from '@/theme';

/** Each headline line starts this fraction of the entrance after the one above. */
export const LINE_STAGGER = 0.12;

const ENTER_MS = 760;
const GROUND_DELAY_MS = 90;
const GROUND_MS = 420;
const LEAVE_MS = 200;
const GROUND_LEAVE_MS = 160;

export interface HorizonMotion {
  /** Entrance of the words in the field, 0 (below the line) to 1 (in place). Linear; each line eases itself. */
  inP: SharedValue<number>;
  /** Exit of the words, 0 (in place) to 1 (gone above). */
  outP: SharedValue<number>;
  /** The ground below the line, 0 (hidden) to 1 (settled). */
  ground: SharedValue<number>;
  enter: () => void;
  /** Words leave upward and the ground fades, then `then` runs to change what is shown. */
  leave: (then: () => void) => void;
}

/**
 * Motion shared by every Horizon screen: words rise from behind the line, the
 * ground settles below it. With Reduce Motion on, nothing moves.
 */
export function useHorizonMotion(reduced: boolean): HorizonMotion {
  const inP = useSharedValue(0);
  const outP = useSharedValue(0);
  const ground = useSharedValue(0);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (pending.current) clearTimeout(pending.current);
    },
    [],
  );

  const enter = () => {
    outP.value = 0;
    if (reduced) {
      inP.value = 1;
      ground.value = 1;
      return;
    }
    inP.value = 0;
    inP.value = withTiming(1, { duration: ENTER_MS, easing: Easing.linear });
    ground.value = 0;
    ground.value = withDelay(
      GROUND_DELAY_MS,
      withTiming(1, { duration: GROUND_MS, easing: Easing.bezier(...easing.outExpo) }),
    );
  };

  const leave = (then: () => void) => {
    if (reduced) {
      then();
      return;
    }
    if (pending.current) clearTimeout(pending.current);
    outP.value = withTiming(1, { duration: LEAVE_MS, easing: Easing.in(Easing.quad) });
    ground.value = withTiming(0, { duration: GROUND_LEAVE_MS });
    pending.current = setTimeout(() => {
      pending.current = null;
      then();
    }, LEAVE_MS + 10);
  };

  return { inP, outP, ground, enter, leave };
}

/** Exponential ease-out, usable inside a worklet. */
export function expoOut(x: number): number {
  'worklet';
  if (x >= 1) return 1;
  if (x <= 0) return 0;
  return 1 - Math.pow(2, -10 * x);
}

/** Exponential ease-in-out, usable inside a worklet. */
export function expoInOut(x: number): number {
  'worklet';
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2;
}

/** Progress of `t` through the span `from`..`to`, clamped to 0..1. Worklet. */
export function span(t: number, from: number, to: number): number {
  'worklet';
  return Math.min(1, Math.max(0, (t - from) / (to - from)));
}
