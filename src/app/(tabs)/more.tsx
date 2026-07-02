import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { I18nManager, Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, Screen, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { radius, spacing, useTheme } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

const ITEMS: { icon: IconName; label: string }[] = [
  { icon: 'cash-outline', label: 'Money' },
  { icon: 'calendar-outline', label: 'Calendar' },
  { icon: 'chatbubbles-outline', label: 'Messages' },
  { icon: 'sparkles-outline', label: 'Ask AI' },
  { icon: 'card-outline', label: 'Billing' },
  { icon: 'people-outline', label: 'Team' },
  { icon: 'business-outline', label: 'Companies' },
  { icon: 'notifications-outline', label: 'Notifications' },
  { icon: 'settings-outline', label: 'Settings' },
];

function Row({ icon, label, isLast }: { icon: IconName; label: string; isLast: boolean }) {
  const theme = useTheme();
  const chevron: IconName = I18nManager.isRTL ? 'chevron-back' : 'chevron-forward';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {}}
      style={({ pressed }) => [
        styles.row,
        {
          borderBottomColor: theme.colors.border,
          borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
          opacity: pressed ? 0.6 : 1,
        },
      ]}>
      <View style={[styles.iconWrap, { backgroundColor: theme.colors.accent }]}>
        <Ionicons name={icon} size={18} color={theme.colors.primary} />
      </View>
      <Text variant="body" weight="medium" style={{ flex: 1 }}>
        {label}
      </Text>
      <Ionicons name={chevron} size={18} color={theme.colors.mutedForeground} />
    </Pressable>
  );
}

export default function MoreScreen() {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  return (
    <Screen scroll>
      <Text variant="h1" style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>
        {t('nav.more')}
      </Text>
      <Card padded={false}>
        {ITEMS.map((item, index) => (
          <Row key={item.label} icon={item.icon} label={item.label} isLast={index === ITEMS.length - 1} />
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
