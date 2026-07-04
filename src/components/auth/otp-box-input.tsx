import { useRef } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Text } from '@/components/ui';
import { radius, useTheme } from '@/theme';

const BOX_COUNT = 6;

interface OtpBoxInputProps {
  value: string;
  onChangeText: (value: string) => void;
  onSubmit?: () => void;
}

/**
 * Figma "OTP Verification" boxed code display (6 segments, active box
 * highlighted), driven by a real native numeric TextInput so the device
 * keyboard (and iOS/Android SMS-code autofill) works. The input itself is
 * transparent and overlaid on the boxes rather than shown directly.
 */
export function OtpBoxInput({ value, onChangeText, onSubmit }: OtpBoxInputProps) {
  const theme = useTheme();
  const inputRef = useRef<TextInput>(null);
  const activeIndex = Math.min(value.length, BOX_COUNT - 1);

  return (
    <Pressable onPress={() => inputRef.current?.focus()} style={{ width: '100%' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
        {Array.from({ length: BOX_COUNT }).map((_, i) => {
          const filled = i < value.length;
          const active = i === activeIndex && value.length < BOX_COUNT;
          return (
            <View
              key={i}
              style={{
                width: 44,
                height: 56,
                borderRadius: radius.sm,
                backgroundColor: theme.colors.secondary,
                borderWidth: active ? 2 : 1,
                borderColor: active ? theme.colors.primary : theme.colors.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Text variant="h1" weight="bold">
                {filled ? value[i] : ''}
              </Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(v) => onChangeText(v.replace(/[^0-9]/g, '').slice(0, BOX_COUNT))}
        keyboardType="number-pad"
        maxLength={BOX_COUNT}
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        autoFocus
        caretHidden
        onSubmitEditing={onSubmit}
        returnKeyType="done"
        style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%' }}
      />
    </Pressable>
  );
}
