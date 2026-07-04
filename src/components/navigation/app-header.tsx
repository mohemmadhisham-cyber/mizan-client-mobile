import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image, StyleSheet, View } from 'react-native';

import { PressableScale, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { radius, spacing, useTheme } from '@/theme';

const WORDMARK_LIGHT = require('../../../assets/images/mizan-wordmark.png');
const WORDMARK_DARK = require('../../../assets/images/mizan-wordmark-light.png');

/**
 * Figma top app bar: profile avatar (→ settings/more, incl. sign-out) · real
 * Mizan wordmark · notification bell. Rendered full-bleed via Screen's
 * `header` slot.
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
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Profile and settings"
        onPress={() => router.push('/more')}
        style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
        <Text variant="footnote" weight="bold" style={{ color: theme.colors.primaryForeground }}>
          {initial}
        </Text>
      </PressableScale>

      <Image
        source={theme.dark ? WORDMARK_DARK : WORDMARK_LIGHT}
        style={styles.wordmark}
        resizeMode="contain"
        accessibilityLabel="Mizan"
      />

      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Notifications"
        onPress={() => router.push('/notifications')}
        hitSlop={8}>
        <Ionicons name="notifications-outline" size={22} color={theme.colors.foreground} />
      </PressableScale>
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
  wordmark: {
    height: 22,
    width: 102,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
