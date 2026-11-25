import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { type ReactNode, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { I18nManager, Pressable, ScrollView, StyleSheet, Text as RNText, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { AppRefreshControl } from '@/components/ui/refresh';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { chevronBack } from '@/lib/direction';
import { useTheme } from '@/theme';
import { horizonColors, type HorizonColors } from '@/theme/horizon';

import { FieldLight } from './field-light';
import { Headline, type HeadlineLine } from './headline';
import { introCovering, onIntroReveal, reportHorizonLine } from './intro-state';
import { expoOut, type HorizonMotion, useHorizonMotion } from './motion';

/** Side margin shared by the field and the ground. */
export const HORIZON_GUTTER = 24;
/** Width of the gold bridge at rest. */
export const BRIDGE_WIDTH = 44;
/**
 * The field has a fixed height, so its words follow the system text size only
 * this far. The ground below, where the reading is, scales without a limit.
 */
export const MAX_FIELD_TEXT_SCALE = 1.2;

const BRIDGE_HEIGHT = 4;
const BRIDGE_MS = 600;
const TOP_ROW_HEIGHT = 36;
const FIELD_TOP_GAP = 10;
const FIELD_BOTTOM_GAP = 26;
const GROUND_SETTLE = 12;
const ART_SIZE = 136;
const ART_OPACITY = 0.085;
const ART_DRIFT = 48;
const ART_BOX = 900;
/** If the intro never reveals the app, the screen shows itself after this long. */
const REVEAL_FALLBACK_MS = 6000;

/** Height of the field on screen: the status bar plus the field itself. */
export function horizonFieldHeight(insetTop: number, field: number): number {
  return insetTop + field;
}

export interface Bridge {
  /** Distance from the leading edge (left in English, right in Arabic). */
  start: number;
  width: number;
}

interface HorizonScreenProps {
  /** Height of the field above the line, not counting the status bar. */
  field: number;
  lines: HeadlineLine[];
  /** One quiet line under the headline. */
  sub?: string;
  /**
   * Cap the quiet line, for a value that can be long, such as an email
   * address: it is then cut in the middle instead of pushing the headline up.
   */
  subLines?: number;
  /** The row at the top of the field: the mark, a back control, a switch. */
  top?: ReactNode;
  /** A large, faint figure in the field, cropped by the screen edge. Decoration only. */
  art?: string;
  /** Where the gold bridge sits. `null` when nothing here needs the person. */
  bridge: Bridge | null;
  small?: boolean;
  /** The ground below the line. */
  children: ReactNode;
  /** Scroll the ground (default true). */
  scroll?: boolean;
  /** Extra space under the ground content. */
  bottomInset?: number;
  /** Keep clear of the home indicator (default true). False on tab screens: the tab bar already does. */
  safeBottom?: boolean;
  /** Pull to refresh, for scrolling grounds. Pass both to enable it. */
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Pass a motion from `useHorizonMotion` to drive `leave()` from the screen. */
  motion?: HorizonMotion;
  /** The entrance plays again whenever this changes. */
  animateKey?: string | number;
}

/**
 * The frame every Mizan Connect screen is built on. One line splits it: the
 * field above says what is true, the ground below holds the detail and what
 * needs the person. The gold bridge on the line marks the one place to act.
 */
export function HorizonScreen({
  field,
  lines,
  sub,
  subLines,
  top,
  art,
  bridge,
  small = false,
  children,
  scroll = true,
  bottomInset = 0,
  safeBottom = true,
  refreshing = false,
  onRefresh,
  motion: givenMotion,
  animateKey,
}: HorizonScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const ownMotion = useHorizonMotion(reduced);
  const motion = givenMotion ?? ownMotion;
  const colors = horizonColors(theme.colors);
  const rtl = I18nManager.isRTL;
  const fieldHeight = horizonFieldHeight(insets.top, field);
  const bottomSpace = (safeBottom ? insets.bottom : 0) + bottomInset;

  useEffect(() => {
    reportHorizonLine(fieldHeight);
  }, [fieldHeight]);

  // Hold the entrance while the launch intro still covers the app.
  const { enter } = motion;
  useEffect(() => {
    if (!introCovering()) {
      enter();
      return undefined;
    }
    // Whichever comes first, the reveal or the fallback, enters once.
    let stop = () => {};
    const fallback = setTimeout(() => {
      stop();
      enter();
    }, REVEAL_FALLBACK_MS);
    stop = onIntroReveal(() => {
      clearTimeout(fallback);
      enter();
    });
    return () => {
      clearTimeout(fallback);
      stop();
    };
    // `enter` is rebuilt each render; the entrance belongs to the key, not to it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animateKey, reduced]);

  const bridgeStart = useSharedValue(bridge?.start ?? HORIZON_GUTTER);
  const bridgeWidth = useSharedValue(bridge?.width ?? BRIDGE_WIDTH);
  const bridgeOpacity = useSharedValue(bridge ? 1 : 0);
  const targetStart = bridge?.start ?? HORIZON_GUTTER;
  const targetWidth = bridge?.width ?? BRIDGE_WIDTH;
  const shown = bridge !== null;
  useEffect(() => {
    const config = reduced ? { duration: 0 } : { duration: BRIDGE_MS, easing: Easing.inOut(Easing.exp) };
    bridgeStart.value = withTiming(targetStart, config);
    bridgeWidth.value = withTiming(targetWidth, config);
    bridgeOpacity.value = withTiming(shown ? 1 : 0, config);
  }, [targetStart, targetWidth, shown, reduced, bridgeStart, bridgeWidth, bridgeOpacity]);

  // Anchored at the leading edge and moved with a transform, which is physical:
  // in Arabic the leading edge is the right, so the bridge travels leftward.
  const bridgeStyle = useAnimatedStyle(() => ({
    width: bridgeWidth.value,
    opacity: bridgeOpacity.value,
    transform: [{ translateX: bridgeStart.value * (rtl ? -1 : 1) }],
  }));
  const groundStyle = useAnimatedStyle(() => ({
    opacity: motion.ground.value * (1 - motion.outP.value),
    transform: [{ translateY: (1 - motion.ground.value) * -GROUND_SETTLE }],
  }));
  const subStyle = useAnimatedStyle(() => ({
    opacity: expoOut(motion.inP.value) * (1 - motion.outP.value),
  }));
  const artStyle = useAnimatedStyle(() => ({
    opacity: expoOut(motion.inP.value) * (1 - motion.outP.value) * ART_OPACITY,
    transform: [{ translateX: (1 - expoOut(motion.inP.value)) * (rtl ? -ART_DRIFT : ART_DRIFT) }],
  }));

  const bridgeMid = targetStart + targetWidth / 2;
  const lightX = rtl ? width - bridgeMid : bridgeMid;

  return (
    <View style={{ flex: 1, backgroundColor: colors.ground }}>
      <View style={{ height: fieldHeight, overflow: 'hidden' }}>
        <FieldLight colors={colors} lightX={lightX} active={shown} />
        {art ? (
          <Animated.Text
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            allowFontScaling={false}
            style={[
              styles.art,
              {
                top: insets.top + 92,
                color: colors.onField,
                fontFamily: theme.fonts.mono.regular,
                textAlign: rtl ? 'right' : 'left',
              },
              artStyle,
            ]}>
            {art}
          </Animated.Text>
        ) : null}
        <View style={[styles.fieldBody, { paddingTop: insets.top + FIELD_TOP_GAP }]}>
          <View style={styles.topRow}>{top}</View>
          <View style={styles.words}>
            <Headline lines={lines} small={small} colors={colors} motion={motion} />
            {sub ? (
              <Animated.View style={subStyle}>
                <Text
                  variant="callout"
                  numberOfLines={subLines}
                  ellipsizeMode="middle"
                  style={{ color: colors.fieldMuted }}>
                  {sub}
                </Text>
              </Animated.View>
            ) : null}
          </View>
        </View>
      </View>
      <Animated.View
        pointerEvents="none"
        style={[styles.bridge, { top: fieldHeight - BRIDGE_HEIGHT / 2, backgroundColor: colors.bridge }, bridgeStyle]}
      />
      <Animated.View style={[{ flex: 1 }, groundStyle]}>
        {scroll ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            alwaysBounceVertical={onRefresh !== undefined}
            refreshControl={
              onRefresh ? <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined
            }
            contentContainerStyle={{ paddingBottom: bottomSpace + HORIZON_GUTTER }}>
            {children}
          </ScrollView>
        ) : (
          <View style={{ flex: 1, paddingBottom: bottomSpace }}>{children}</View>
        )}
      </Animated.View>
    </View>
  );
}

const MARK = require('@/assets/images/mizan-z-on-dark.png');
const MARK_SIZE = 34;

/** The supplied Z mark, as it sits at the top of the field. Never redrawn or recoloured. */
export function FieldMark() {
  const { t } = useTranslation();
  return (
    <Image
      source={MARK}
      accessibilityLabel={t('common.appName')}
      contentFit="contain"
      style={{ width: MARK_SIZE, height: MARK_SIZE, marginStart: -6 }}
    />
  );
}

/** Back, at the top of the field, on a screen that was opened from another. */
export function FieldBack({ colors, onPress }: { colors: HorizonColors; onPress?: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('common.back')}
      onPress={onPress ?? (() => router.back())}
      hitSlop={11}
      style={({ pressed }) => ({ marginStart: -4, opacity: pressed ? 0.6 : 1 })}>
      <Ionicons name={chevronBack()} size={24} color={colors.onField} />
    </Pressable>
  );
}

/** A small note in the field's top row, for example "1 / 3". */
export function FieldNote({ children, colors }: { children: string; colors: HorizonColors }) {
  const theme = useTheme();
  return (
    <RNText
      maxFontSizeMultiplier={MAX_FIELD_TEXT_SCALE}
      style={{ fontFamily: theme.fonts.mono.regular, fontSize: 12.5, color: colors.fieldMuted }}>
      {children}
    </RNText>
  );
}

const styles = StyleSheet.create({
  fieldBody: {
    flex: 1,
    paddingHorizontal: HORIZON_GUTTER,
  },
  topRow: {
    height: TOP_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  words: {
    marginTop: 'auto',
    paddingBottom: FIELD_BOTTOM_GAP,
    gap: 8,
  },
  bridge: {
    position: 'absolute',
    start: 0,
    height: BRIDGE_HEIGHT,
    borderRadius: 1,
    zIndex: 2,
  },
  art: {
    position: 'absolute',
    start: 18,
    width: ART_BOX,
    fontSize: ART_SIZE,
    lineHeight: ART_SIZE,
    letterSpacing: -9,
  },
});
