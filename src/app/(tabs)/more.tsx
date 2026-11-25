import { Ionicons } from '@expo/vector-icons';
import { type Href, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, Screen, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { chevronForward } from '@/lib/direction';
import { radius, spacing, useTheme } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

interface MoreItem {
  icon: IconName;
  /** Translation key of the row label. */
  labelKey: string;
  href?: Href;
}

const ITEMS: MoreItem[] = [
  { icon: 'calendar-outline', labelKey: 'more.calendar', href: '/calendar' },
  { icon: 'chatbubbles-outline', labelKey: 'more.messages', href: { pathname: '/ai-advisor', params: { tab: 'queries' } } },
  { icon: 'sparkles-outline', labelKey: 'more.askAi', href: '/ai-advisor' },
  { icon: 'card-outline', labelKey: 'more.billing', href: '/billing' },
  { icon: 'people-outline', labelKey: 'more.team', href: { pathname: '/companies', params: { tab: 'team' } } },
  { icon: 'business-outline', labelKey: 'more.companies', href: '/companies' },
  { icon: 'notifications-outline', labelKey: 'more.notifications', href: '/notifications' },
  { icon: 'settings-outline', labelKey: 'more.settings', href: '/settings' },
];

function Row({ item, isLast, onPress }: { item: MoreItem; isLast: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const chevron = chevronForward();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(item.labelKey)}
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
        {t(item.labelKey)}
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
      Alert.alert(t('common.comingSoon'), t('common.notAvailableYet', { name: t(item.labelKey) }));
    }
  }

  return (
    <Screen scroll>
      <Text variant="h1" style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>
        {t('nav.more')}
      </Text>
      <Card padded={false}>
        {ITEMS.map((item, index) => (
          <Row key={item.labelKey} item={item} isLast={index === ITEMS.length - 1} onPress={() => handlePress(item)} />
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
