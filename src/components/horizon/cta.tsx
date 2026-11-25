import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { Text } from '@/components/ui';
import { useTheme } from '@/theme';

type CtaKind = 'solid' | 'outline' | 'quiet';

interface CtaProps {
  title: string;
  onPress: () => void;
  kind?: CtaKind;
  disabled?: boolean;
  /** The action is being sent: shows a spinner and ignores taps. */
  busy?: boolean;
}

const HEIGHT = 54;
const PRESSED_SCALE = 0.98;
const DISABLED_OPACITY = 0.38;

/**
 * The action at the bottom of a Horizon screen. `solid` is the one thing to
 * do; `outline` is the alternative; `quiet` is a plain word, such as Skip.
 */
export function Cta({ title, onPress, kind = 'solid', disabled = false, busy = false }: CtaProps) {
  const theme = useTheme();
  const foreground =
    kind === 'solid'
      ? theme.colors.primaryForeground
      : kind === 'outline'
        ? theme.colors.foreground
        : theme.colors.mutedForeground;

  const handlePress = () => {
    if (disabled || busy) return;
    if (process.env.EXPO_OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onPress();
  };

  return (
    <Pressable
      accessibilityRole="button"
      // Named even while the spinner replaces the words.
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
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
      {busy ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <Text variant="body" weight="bold" style={{ color: foreground }}>
          {title}
        </Text>
      )}
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
