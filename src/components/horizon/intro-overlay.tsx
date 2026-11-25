import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, I18nManager, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';
import { horizonColors } from '@/theme/horizon';

import { BRIDGE_WIDTH, HORIZON_GUTTER } from './horizon-screen';
import { horizonLine, introPending, markIntroPlaying, revealUnderIntro } from './intro-state';
import { expoInOut, expoOut, span } from './motion';

const MARK = require('@/assets/images/mizan-z-on-dark.png');

// Measured on the supplied mark (1254 px square): the gold bridge crosses it
// at 50.6% of its height, from 38.3% to 58.9% of its width, slanted 41 degrees.
const MARK_SIZE = 150;
const MARK_BRIDGE_Y = 0.506;
const MARK_BRIDGE_MID_X = 0.486;
const MARK_BRIDGE_WIDTH = 31;
const MARK_BRIDGE_HEIGHT = 6;
const MARK_BRIDGE_SKEW = '-41deg';
const FLAT_BRIDGE_HEIGHT = 4;

const NIGHT = '#111816';
const LINE_COLOR = 'rgba(245,243,238,0.7)';
const LABEL_COLOR = 'rgba(245,243,238,0.72)';

// The sequence, in milliseconds from the start.
const LINE: [number, number] = [125, 875];
const GOLD_IN: [number, number] = [460, 585];
const GOLD_TRAVEL: [number, number] = [460, 1170];
const MARK_RISE: [number, number] = [1040, 1710];
const GOLD_OUT: [number, number] = [1210, 1380];
const LABEL: [number, number] = [1330, 1750];
const MARK_OUT: [number, number] = [2125, 2375];
const FLAT_FROM = 2170;
const LIFT: [number, number] = [2250, 2875];
const UNDER_FADE: [number, number] = [2500, 2875];
const FADE: [number, number] = [2875, 3060];
const TOTAL = 3060;
/** The screen underneath starts its own entrance this long into the lift. */
const REVEAL_AT = LIFT[0] + 330;

type Phase = 'wait' | 'play' | 'gone';

/**
 * The launch intro, once per app start: a line draws across the dark, the gold
 * travels along it and docks, the Z rises out of the line around it, then the
 * line settles onto the horizon of the screen underneath. Tap to skip. Not
 * shown when the device asks for reduced motion.
 */
export function IntroOverlay({ ready }: { ready: boolean }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const [phase, setPhase] = useState<Phase>(() => (introPending() ? 'wait' : 'gone'));
  const colors = horizonColors(theme.colors);
  const rtl = I18nManager.isRTL;
  // Measured once: Android can report a new window height just after launch,
  // and the sequence must not restart or drift when it does.
  const [mid] = useState(() => Math.round(height / 2));

  const clock = useSharedValue(0);
  const settleAt = useSharedValue(mid);

  useEffect(() => {
    if (phase !== 'wait' || !ready) return undefined;
    let live = true;
    // No intro for people who ask for less motion, or who use a screen reader:
    // it is three seconds of picture with nothing to read.
    const decide = (skipIntro: boolean) => {
      if (!live) return;
      if (skipIntro) {
        revealUnderIntro();
        setPhase('gone');
      } else {
        setPhase('play');
      }
    };
    Promise.all([AccessibilityInfo.isReduceMotionEnabled(), AccessibilityInfo.isScreenReaderEnabled()]).then(
      ([reduced, screenReader]) => decide(reduced || screenReader),
      () => decide(false),
    );
    return () => {
      live = false;
    };
  }, [phase, ready]);

  useEffect(() => {
    if (phase !== 'play') return undefined;
    markIntroPlaying();
    clock.value = withTiming(TOTAL, { duration: TOTAL, easing: Easing.linear });
    const aim = setTimeout(() => {
      settleAt.value = horizonLine() ?? mid;
    }, LIFT[0] - 60);
    const reveal = setTimeout(revealUnderIntro, REVEAL_AT);
    const finish = setTimeout(() => setPhase('gone'), TOTAL + 40);
    return () => {
      clearTimeout(aim);
      clearTimeout(reveal);
      clearTimeout(finish);
      // If the intro is torn down part-way, the app must not stay hidden.
      revealUnderIntro();
    };
  }, [phase, mid, clock, settleAt]);

  const skip = () => {
    revealUnderIntro();
    setPhase('gone');
  };

  // Horizontal positions are offsets from the centre of the screen, so the
  // sequence never depends on left/right being swapped in Arabic.
  const dockX = (MARK_BRIDGE_MID_X - 0.5) * MARK_SIZE;
  const enterX = (width / 2 + 40) * (rtl ? 1 : -1);
  const restMid = HORIZON_GUTTER + BRIDGE_WIDTH / 2;
  const restX = rtl ? width / 2 - restMid : restMid - width / 2;
  const brand = colors.field;

  const rootStyle = useAnimatedStyle(() => ({ opacity: 1 - span(clock.value, FADE[0], FADE[1]) }));
  const overStyle = useAnimatedStyle(() => {
    const lift = expoInOut(span(clock.value, LIFT[0], LIFT[1]));
    return {
      height: mid + (settleAt.value - mid) * lift,
      backgroundColor: interpolateColor(lift, [0, 1], [NIGHT, brand]),
    };
  });
  const underStyle = useAnimatedStyle(() => {
    const lift = expoInOut(span(clock.value, LIFT[0], LIFT[1]));
    return {
      top: mid + (settleAt.value - mid) * lift,
      opacity: 1 - span(clock.value, UNDER_FADE[0], UNDER_FADE[1]),
    };
  });
  const lineStyle = useAnimatedStyle(() => {
    const lift = expoInOut(span(clock.value, LIFT[0], LIFT[1]));
    return {
      transform: [
        { translateY: (settleAt.value - mid) * lift },
        { scaleX: expoInOut(span(clock.value, LINE[0], LINE[1])) },
      ],
    };
  });
  const goldStyle = useAnimatedStyle(() => {
    const now = clock.value;
    const lift = expoInOut(span(now, LIFT[0], LIFT[1]));
    const flat = now >= FLAT_FROM;
    const travel = expoInOut(span(now, GOLD_TRAVEL[0], GOLD_TRAVEL[1]));
    const x = flat ? dockX + (restX - dockX) * lift : enterX + (dockX - enterX) * travel;
    return {
      width: flat ? MARK_BRIDGE_WIDTH + (BRIDGE_WIDTH - MARK_BRIDGE_WIDTH) * lift : MARK_BRIDGE_WIDTH,
      height: flat ? FLAT_BRIDGE_HEIGHT : MARK_BRIDGE_HEIGHT,
      marginTop: flat ? -FLAT_BRIDGE_HEIGHT / 2 : -MARK_BRIDGE_HEIGHT / 2,
      opacity: flat ? 1 : span(now, GOLD_IN[0], GOLD_IN[1]) * (1 - span(now, GOLD_OUT[0], GOLD_OUT[1])),
      transform: [
        { translateX: x },
        { translateY: (settleAt.value - mid) * lift },
        { skewX: flat ? '0deg' : MARK_BRIDGE_SKEW },
      ],
    };
  });
  const markBoxStyle = useAnimatedStyle(() => {
    const rise = expoOut(span(clock.value, MARK_RISE[0], MARK_RISE[1]));
    return {
      top: mid - MARK_SIZE * MARK_BRIDGE_Y * rise,
      opacity: 1 - span(clock.value, MARK_OUT[0], MARK_OUT[1]),
    };
  });
  const markWindowStyle = useAnimatedStyle(() => ({
    height: MARK_SIZE * expoOut(span(clock.value, MARK_RISE[0], MARK_RISE[1])),
  }));
  const markStyle = useAnimatedStyle(() => {
    const rise = expoOut(span(clock.value, MARK_RISE[0], MARK_RISE[1]));
    return { transform: [{ translateY: -MARK_SIZE * MARK_BRIDGE_Y * (1 - rise) }] };
  });
  const labelStyle = useAnimatedStyle(() => {
    const show = span(clock.value, LABEL[0], LABEL[1]);
    return {
      opacity: show * (1 - span(clock.value, MARK_OUT[0], MARK_OUT[1])),
      transform: [{ translateY: (1 - expoOut(show)) * 8 }],
    };
  });

  if (phase === 'gone') return null;

  return (
    <Animated.View accessibilityViewIsModal style={[StyleSheet.absoluteFill, styles.root, rootStyle]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('intro.skip')}
        onPress={skip}
        style={StyleSheet.absoluteFill}>
        <Animated.View style={[styles.under, underStyle]} />
        <Animated.View style={[styles.over, overStyle]} />
        <Animated.View
          style={[styles.line, { top: mid - 0.5, transformOrigin: rtl ? 'right center' : 'left center' }, lineStyle]}
        />
        <View style={[styles.anchor, { top: mid }]}>
          <Animated.View style={[{ backgroundColor: colors.bridge }, goldStyle]} />
        </View>
        <Animated.View style={[styles.anchor, markBoxStyle]}>
          <Animated.View style={[styles.markWindow, markWindowStyle]}>
            <Animated.View style={markStyle}>
              <Image source={MARK} contentFit="contain" style={styles.mark} />
            </Animated.View>
          </Animated.View>
        </Animated.View>
        <Animated.Text
          allowFontScaling={false}
          style={[styles.label, { top: mid + 98, fontFamily: theme.fonts.sans.semibold }, labelStyle]}>
          {t('intro.product')}
        </Animated.Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    zIndex: 100,
    elevation: 100,
  },
  over: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  under: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: NIGHT,
  },
  line: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: LINE_COLOR,
  },
  anchor: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  markWindow: {
    width: MARK_SIZE,
    overflow: 'hidden',
  },
  mark: {
    width: MARK_SIZE,
    height: MARK_SIZE,
  },
  label: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 12,
    letterSpacing: 4,
    textTransform: 'uppercase',
    color: LABEL_COLOR,
  },
});
