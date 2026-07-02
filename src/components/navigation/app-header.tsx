import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { radius, spacing, useTheme } from '@/theme';

/**
 * Figma top app bar: profile avatar (→ settings/more, incl. sign-out) · "Mizan"
 * wordmark · notification bell. Rendered full-bleed via Screen's `header` slot.
 */
export function AppHeader() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const initial = (user?.email?.[0] ?? 'M').toUpperCase();

  return (
    <View
      style={[
        styles.bar,
        { paddingHorizontal: spacing.gutter, borderBottomColor: theme.colors.border, backgroundColor: theme.colors.background },
      ]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Profile and settings"
        onPress={() => router.push('/more')}
        style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
        <Text variant="footnote" weight="bold" style={{ color: theme.colors.primaryForeground }}>
          {initial}
        </Text>
      </Pressable>

      <Text variant="h2" weight="bold" style={{ color: theme.colors.primary }}>
        Mizan
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Notifications"
        onPress={() => router.push('/more')}
        hitSlop={8}>
        <Ionicons name="notifications-outline" size={22} color={theme.colors.foreground} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
