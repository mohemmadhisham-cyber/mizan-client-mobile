import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { radius, useTheme } from '@/theme';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'backspace'] as const;

interface KeypadProps {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
}

/**
 * Figma "OTP Verification" on-screen numeric keypad. Using an in-app keypad
 * (rather than the OS keyboard) keeps code entry deliberate and avoids
 * autofill/autocomplete surfaces on a security-sensitive field.
 */
export function Keypad({ onDigit, onBackspace }: KeypadProps) {
  const theme = useTheme();

  const press = (key: (typeof KEYS)[number]) => {
    if (!key) return;
    if (process.env.EXPO_OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    if (key === 'backspace') onBackspace();
    else onDigit(key);
  };

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: '100%' }}>
      {KEYS.map((key, i) => (
        <Pressable
          key={i}
          accessibilityRole={key ? 'button' : undefined}
          accessibilityLabel={key === 'backspace' ? 'Delete' : key || undefined}
          disabled={!key}
          onPress={() => press(key)}
          style={({ pressed }) => ({
            width: '33.33%',
            height: 56,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radius.md,
            backgroundColor: pressed && key ? theme.colors.secondary : 'transparent',
          })}>
          {key === 'backspace' ? (
            <Ionicons name="backspace-outline" size={22} color={theme.colors.foreground} />
          ) : key ? (
            <Text variant="hero" weight="bold" style={{ fontSize: 30, lineHeight: 36 }}>
              {key}
            </Text>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}
