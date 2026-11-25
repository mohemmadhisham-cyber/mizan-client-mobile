import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet } from 'react-native';

import { Text } from '@/components/ui';
import { useTheme } from '@/theme';

type CtaKind = 'solid' | 'outline' | 'quiet';

interface CtaProps {
  title: string;
  onPress: () => void;
  kind?: CtaKind;
  disabled?: boolean;
}

const HEIGHT = 54;
const PRESSED_SCALE = 0.98;
const DISABLED_OPACITY = 0.38;

/**
 * The action at the bottom of a Horizon screen. `solid` is the one thing to
 * do; `outline` is the alternative; `quiet` is a plain word, such as Skip.
 */
export function Cta({ title, onPress, kind = 'solid', disabled = false }: CtaProps) {
  const theme = useTheme();
  const foreground =
    kind === 'solid'
      ? theme.colors.primaryForeground
      : kind === 'outline'
        ? theme.colors.foreground
        : theme.colors.mutedForeground;

  const handlePress = () => {
    if (disabled) return;
    if (process.env.EXPO_OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onPress();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.base,
        kind === 'solid' && { backgroundColor: theme.colors.primary },
        kind === 'outline' && { borderWidth: 1, borderColor: theme.colors.border },
        {
          opacity: disabled ? DISABLED_OPACITY : pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? PRESSED_SCALE : 1 }],
        },
      ]}>
      <Text variant="body" weight="bold" style={{ color: foreground }}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: HEIGHT,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
});
