import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { radius, spacing, useTheme } from '@/theme';

type Tone = 'brand' | 'accent' | 'neutral';

interface QuickActionButtonProps {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: Tone;
  onPress: () => void;
}

/** Figma "Quick Actions" circular shortcut button (Dashboard 1:54). */
export function QuickActionButton({ label, icon, tone, onPress }: QuickActionButtonProps) {
  const theme = useTheme();

  // `primary` is the brand colour in light and ivory in dark, so the brand-tone
  // button stays distinct from the dark card behind it.
  const bg = tone === 'brand' ? theme.colors.primary : tone === 'accent' ? theme.colors.brandAccent : theme.colors.secondary;
  const fg =
    tone === 'brand' ? theme.colors.primaryForeground : tone === 'accent' ? theme.colors.brandAccentForeground : theme.colors.foreground;

  const handlePress = () => {
    if (process.env.EXPO_OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onPress();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={handlePress}
      style={({ pressed }) => ({ alignItems: 'center', gap: spacing.xs, opacity: pressed ? 0.75 : 1, width: 76 })}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: radius.full,
          backgroundColor: bg,
          borderWidth: tone === 'neutral' ? 1 : 0,
          borderColor: theme.colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Ionicons name={icon} size={22} color={fg} />
      </View>
      <Text variant="caption" weight="semibold" color="mutedForeground" center numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}
