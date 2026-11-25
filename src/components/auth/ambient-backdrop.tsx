import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/theme';

interface AmbientBackdropProps {
  /** `brand` for sign-in and waiting screens; `warning` when access is paused. */
  tone?: 'brand' | 'warning';
}

/**
 * Approximates Figma's blurred ambient-glow background (two large soft-edged
 * color blobs behind a glass card) using SVG radial gradients — react-native
 * has no CSS blur filter, and this avoids adding expo-blur for a single effect.
 * Glow colours come from the theme, so the backdrop follows light/dark and a
 * firm's co-branding.
 */
export function AmbientBackdrop({ tone = 'brand' }: AmbientBackdropProps) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const topColor = tone === 'warning' ? theme.colors.dangerSoft : theme.colors.infoSoft;
  const bottomColor = tone === 'warning' ? theme.colors.warningSoft : theme.colors.brandAccent;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id="topGlow" cx="15%" cy="5%" r="35%">
            <Stop offset="0%" stopColor={topColor} stopOpacity={0.55} />
            <Stop offset="100%" stopColor={topColor} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="bottomGlow" cx="90%" cy="85%" r="35%">
            <Stop offset="0%" stopColor={bottomColor} stopOpacity={0.45} />
            <Stop offset="100%" stopColor={bottomColor} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#topGlow)" />
        <Rect x={0} y={0} width={width} height={height} fill="url(#bottomGlow)" />
      </Svg>
    </View>
  );
}
