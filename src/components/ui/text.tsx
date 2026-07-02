import { I18nManager, Text as RNText, type TextProps } from 'react-native';

import { useTheme, type ColorTokens } from '@/theme';

type Variant =
  | 'hero'
  | 'display'
  | 'h1'
  | 'h2'
  | 'title'
  | 'body'
  | 'callout'
  | 'subhead'
  | 'footnote'
  | 'caption';

type Weight = 'regular' | 'medium' | 'semibold' | 'bold';

export type TextColor = keyof ColorTokens;

export interface AppTextProps extends TextProps {
  variant?: Variant;
  weight?: Weight;
  color?: TextColor;
  /** Tabular figures so columns of money align. */
  tabular?: boolean;
  center?: boolean;
}

const WEIGHT_BY_FONTWEIGHT: Record<string, Weight> = {
  '400': 'regular',
  '500': 'medium',
  '600': 'semibold',
  '700': 'bold',
};

export function Text({
  variant = 'body',
  weight,
  color = 'foreground',
  tabular = false,
  center = false,
  style,
  ...rest
}: AppTextProps) {
  const theme = useTheme();
  const spec = theme.typography[variant];
  const resolvedWeight: Weight = weight ?? WEIGHT_BY_FONTWEIGHT[spec.fontWeight] ?? 'regular';
  const family = I18nManager.isRTL ? theme.fonts.arabic : theme.fonts.sans;

  return (
    <RNText
      style={[
        {
          fontSize: spec.fontSize,
          lineHeight: spec.lineHeight,
          letterSpacing: 'letterSpacing' in spec ? spec.letterSpacing : 0,
          fontFamily: family[resolvedWeight],
          color: theme.colors[color],
          textAlign: center ? 'center' : undefined,
          writingDirection: I18nManager.isRTL ? 'rtl' : 'ltr',
        },
        tabular && { fontVariant: ['tabular-nums'] },
        style,
      ]}
      {...rest}
    />
  );
}
