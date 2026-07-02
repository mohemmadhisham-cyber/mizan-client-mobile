import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useState } from 'react';
import { I18nManager, StyleSheet, TextInput, View, type TextInputProps, type TextStyle } from 'react-native';

import { radius, spacing, useTheme } from '@/theme';

import { Text } from './text';

export interface AppInputProps extends TextInputProps {
  /** Leading icon, positioned inside the field (Figma icon-input pattern). */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Small uppercase caption above the field (Figma labeled-input pattern). */
  label?: string;
  /** 'default': fully bordered field. 'underline': white, rounded-top only,
   *  bottom border — the Figma Login/Create-Account input treatment. */
  variant?: 'default' | 'underline';
}

export const Input = forwardRef<TextInput, AppInputProps>(function Input(
  { style, icon, label, variant = 'default', onFocus, onBlur, ...rest },
  ref,
) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const family = I18nManager.isRTL ? theme.fonts.arabic : theme.fonts.sans;
  const iconSide: 'left' | 'right' = I18nManager.isRTL ? 'right' : 'left';

  const iconPadding: TextStyle = !icon
    ? { paddingHorizontal: spacing.base }
    : iconSide === 'left'
      ? { paddingLeft: 40, paddingRight: spacing.base }
      : { paddingLeft: spacing.base, paddingRight: 40 };

  const field = (
    <View style={{ justifyContent: 'center' }}>
      <TextInput
        ref={ref}
        placeholderTextColor={theme.colors.mutedForeground}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          variant === 'underline'
            ? {
                backgroundColor: theme.colors.card,
                borderBottomWidth: 2,
                borderBottomColor: focused ? theme.colors.primary : theme.colors.border,
                borderTopLeftRadius: radius.sm,
                borderTopRightRadius: radius.sm,
                paddingVertical: spacing.md,
              }
            : {
                backgroundColor: theme.colors.card,
                borderColor: focused ? theme.colors.primary : theme.colors.input,
                borderWidth: focused ? 2 : StyleSheet.hairlineWidth,
                borderRadius: radius.lg,
                paddingVertical: spacing.md,
              },
          iconPadding,
          {
            fontSize: 16,
            color: theme.colors.foreground,
            fontFamily: family.regular,
            textAlign: I18nManager.isRTL ? 'right' : 'left',
          },
          style,
        ]}
        {...rest}
      />
      {icon ? (
        <View style={{ position: 'absolute', [iconSide]: 12 }}>
          <Ionicons name={icon} size={18} color={theme.colors.mutedForeground} />
        </View>
      ) : null}
    </View>
  );

  if (!label) return field;

  return (
    <View style={{ gap: spacing.xs }}>
      <Text
        variant="caption"
        weight="semibold"
        color="mutedForeground"
        style={{ letterSpacing: 0.6, textTransform: 'uppercase' }}>
        {label}
      </Text>
      {field}
    </View>
  );
});
