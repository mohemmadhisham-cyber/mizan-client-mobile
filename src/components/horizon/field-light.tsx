import { useId, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import type { HorizonColors } from '@/theme/horizon';

const LIGHT_RADIUS_X = 300;
const LIGHT_RADIUS_Y = 170;
const LIGHT_STRENGTH = 0.22;
const LIGHT_AT_REST = 0.35;
const FIELD_SOLID_FROM = 0.64;

interface FieldLightProps {
  colors: HorizonColors;
  /** Where the light sits on the line, in points from the physical left. */
  lightX: number;
  /** False when nothing on this screen needs the person: the light dims. */
  active: boolean;
}

/**
 * The field's surface: darker at the top, the brand colour toward the line,
 * with a soft light resting on the line under the bridge.
 */
export function FieldLight({ colors, lightX, active }: FieldLightProps) {
  const id = useId();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((previous) => (previous.width === width && previous.height === height ? previous : { width, height }));
  };
  const fall = `${id}-fall`;
  const light = `${id}-light`;

  return (
    <View
      pointerEvents="none"
      onLayout={onLayout}
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.field }]}>
      {size.width > 0 ? (
        <Svg width={size.width} height={size.height}>
          <Defs>
            <LinearGradient id={fall} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.fieldDeep} />
              <Stop offset={FIELD_SOLID_FROM} stopColor={colors.field} />
            </LinearGradient>
            <RadialGradient
              id={light}
              cx={lightX}
              cy={size.height}
              rx={LIGHT_RADIUS_X}
              ry={LIGHT_RADIUS_Y}
              gradientUnits="userSpaceOnUse">
              <Stop
                offset="0"
                stopColor={colors.fieldLight}
                stopOpacity={LIGHT_STRENGTH * (active ? 1 : LIGHT_AT_REST)}
              />
              <Stop offset="1" stopColor={colors.fieldLight} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width={size.width} height={size.height} fill={`url(#${fall})`} />
          <Rect width={size.width} height={size.height} fill={`url(#${light})`} />
        </Svg>
      ) : null}
    </View>
  );
}
