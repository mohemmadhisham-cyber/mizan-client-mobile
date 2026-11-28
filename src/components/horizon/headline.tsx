import { I18nManager, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { useTheme } from '@/theme';
import type { HorizonColors } from '@/theme/horizon';

import { expoOut, type HorizonMotion, LINE_STAGGER, span } from './motion';

export interface HeadlineLine {
  text: string;
  /** The softer second tone: the part of the sentence that is not the point. */
  soft?: boolean;
  /** A figure: set in the mono face. */
  figure?: boolean;
}

interface Metrics {
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
}

const LATIN: Record<'large' | 'small', Metrics> = {
  large: { fontSize: 40, lineHeight: 44, letterSpacing: -1.4 },
  small: { fontSize: 32, lineHeight: 36, letterSpacing: -1.1 },
};
// Arabic needs more line height for its marks, and no tracking.
const ARABIC: Record<'large' | 'small', Metrics> = {
  large: { fontSize: 32, lineHeight: 48, letterSpacing: 0 },
  small: { fontSize: 27, lineHeight: 42, letterSpacing: 0 },
};
const FIGURE_TRACKING = -2;
const SMALLEST_FIT = 0.7;
/** Kept here, not imported from the screen, which imports this file. Same value as MAX_FIELD_TEXT_SCALE there. */
const MAX_FIELD_TEXT_SCALE = 1.2;
/** How far below its slot a line starts, as a share of the line height. */
const RISE_FROM = 1.5;
/** Room under each line so the mask does not cut the tails of g, y and p. */
const TAIL_ROOM = 8;

interface LineProps {
  line: HeadlineLine;
  index: number;
  count: number;
  metrics: Metrics;
  colors: HorizonColors;
  motion: HorizonMotion;
}

function Line({ line, index, count, metrics, colors, motion }: LineProps) {
  const theme = useTheme();
  const rtl = I18nManager.isRTL;
  const travel = metrics.lineHeight * RISE_FROM;
  const window = 1 - (count - 1) * LINE_STAGGER;

  const style = useAnimatedStyle(() => {
    const local = span(motion.inP.value, index * LINE_STAGGER, index * LINE_STAGGER + window);
    return { transform: [{ translateY: (1 - expoOut(local)) * travel - motion.outP.value * travel }] };
  });

  const family = line.figure
    ? theme.fonts.mono.regular
    : rtl
      ? theme.fonts.arabic.medium
      : theme.fonts.sans.medium;

  return (
    <View
      style={{
        height: metrics.lineHeight * MAX_FIELD_TEXT_SCALE + TAIL_ROOM,
        marginBottom: -TAIL_ROOM - metrics.lineHeight * (MAX_FIELD_TEXT_SCALE - 1),
        overflow: 'hidden',
      }}>
      <Animated.Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={SMALLEST_FIT}
        maxFontSizeMultiplier={MAX_FIELD_TEXT_SCALE}
        style={[
          {
            fontFamily: family,
            fontSize: metrics.fontSize,
            lineHeight: metrics.lineHeight,
            letterSpacing: line.figure ? FIGURE_TRACKING : metrics.letterSpacing,
            color: line.soft ? colors.fieldMuted : colors.onField,
            writingDirection: rtl ? 'rtl' : 'ltr',
            fontVariant: line.figure ? ['tabular-nums'] : undefined,
          },
          style,
        ]}>
        {line.text}
      </Animated.Text>
    </View>
  );
}

interface HeadlineProps {
  lines: HeadlineLine[];
  small?: boolean;
  colors: HorizonColors;
  motion: HorizonMotion;
}

/** The sentence a screen opens with. Each line rises from behind the horizon. */
export function Headline({ lines, small = false, colors, motion }: HeadlineProps) {
  const metrics = (I18nManager.isRTL ? ARABIC : LATIN)[small ? 'small' : 'large'];
  return (
    <View accessibilityRole="header" accessible accessibilityLabel={lines.map((line) => line.text).join(' ')}>
      {lines.map((line, index) => (
        <Line
          key={`${index}-${line.text}`}
          line={line}
          index={index}
          count={lines.length}
          metrics={metrics}
          colors={colors}
          motion={motion}
        />
      ))}
    </View>
  );
}
