import { View } from 'react-native';

import { Text } from '@/components/ui';
import { radius, useTheme } from '@/theme';

const BOX_COUNT = 6;

interface OtpBoxInputProps {
  value: string;
}

/** Figma "OTP Verification" boxed code display (6 segments, active box highlighted). */
export function OtpBoxInput({ value }: OtpBoxInputProps) {
  const theme = useTheme();
  const activeIndex = Math.min(value.length, BOX_COUNT - 1);

  return (
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
  );
}
