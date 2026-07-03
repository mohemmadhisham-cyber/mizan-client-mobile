import { Ionicons } from '@expo/vector-icons';
import { type Href, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert, I18nManager, Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, Screen, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { radius, spacing, useTheme } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

interface MoreItem {
  icon: IconName;
  label: string;
  href?: Href;
}

const ITEMS: MoreItem[] = [
  { icon: 'cash-outline', label: 'Money' },
  { icon: 'calendar-outline', label: 'Calendar', href: '/calendar' },
  { icon: 'chatbubbles-outline', label: 'Messages' },
  { icon: 'sparkles-outline', label: 'Ask AI', href: '/ai-advisor' },
  { icon: 'card-outline', label: 'Billing', href: '/billing' },
  { icon: 'people-outline', label: 'Team', href: { pathname: '/companies', params: { tab: 'team' } } },
  { icon: 'business-outline', label: 'Companies', href: '/companies' },
  { icon: 'notifications-outline', label: 'Notifications', href: '/notifications' },
  { icon: 'settings-outline', label: 'Settings', href: '/settings' },
];

function Row({ item, isLast, onPress }: { item: MoreItem; isLast: boolean; onPress: () => void }) {
  const theme = useTheme();
  const chevron: IconName = I18nManager.isRTL ? 'chevron-back' : 'chevron-forward';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          borderBottomColor: theme.colors.border,
          borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
          opacity: pressed ? 0.6 : 1,
        },
      ]}>
      <View style={[styles.iconWrap, { backgroundColor: theme.colors.accent }]}>
        <Ionicons name={item.icon} size={18} color={theme.colors.primary} />
      </View>
      <Text variant="body" weight="medium" style={{ flex: 1 }}>
        {item.label}
      </Text>
      <Ionicons name={chevron} size={18} color={theme.colors.mutedForeground} />
    </Pressable>
  );
}

export default function MoreScreen() {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const router = useRouter();

  function handlePress(item: MoreItem) {
    if (item.href) {
      router.push(item.href);
    } else {
      Alert.alert('Coming soon', `${item.label} isn't available yet.`);
    }
  }

  return (
    <Screen scroll>
      <Text variant="h1" style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>
        {t('nav.more')}
      </Text>
      <Card padded={false}>
        {ITEMS.map((item, index) => (
          <Row key={item.label} item={item} isLast={index === ITEMS.length - 1} onPress={() => handlePress(item)} />
        ))}
      </Card>
      <View style={{ marginTop: spacing.xl }}>
        <Button title={t('auth.signOut')} variant="secondary" icon="log-out-outline" onPress={signOut} fullWidth />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
