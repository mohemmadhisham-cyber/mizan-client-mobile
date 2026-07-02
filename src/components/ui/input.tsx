import { forwardRef } from 'react';
import { I18nManager, StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { radius, spacing, useTheme } from '@/theme';

export const Input = forwardRef<TextInput, TextInputProps>(function Input({ style, ...rest }, ref) {
  const theme = useTheme();
  const family = I18nManager.isRTL ? theme.fonts.arabic : theme.fonts.sans;
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={theme.colors.mutedForeground}
      style={[
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.input,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: radius.lg,
          paddingHorizontal: spacing.base,
          paddingVertical: spacing.md,
          fontSize: 16,
          color: theme.colors.foreground,
          fontFamily: family.regular,
          textAlign: I18nManager.isRTL ? 'right' : 'left',
        },
        style,
      ]}
      {...rest}
    />
  );
});
