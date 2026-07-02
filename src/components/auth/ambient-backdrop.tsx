import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

interface AmbientBackdropProps {
  /** Soft glow color, top-start corner. */
  topColor?: string;
  /** Soft glow color, bottom-end corner. */
  bottomColor?: string;
}

/**
 * Approximates Figma's blurred ambient-glow background (two large soft-edged
 * color blobs behind a glass card) using SVG radial gradients — react-native
 * has no CSS blur filter, and this avoids adding expo-blur for a single effect.
 */
export function AmbientBackdrop({ topColor = '#D5E3FF', bottomColor = '#6BFE9C' }: AmbientBackdropProps) {
  const { width, height } = useWindowDimensions();
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
