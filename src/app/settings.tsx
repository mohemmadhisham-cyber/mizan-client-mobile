import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DetailHeader } from '@/components/navigation/detail-header';
import { Button, Card, Text } from '@/components/ui';
import i18n, { applyLayoutDirection, type AppLocale } from '@/i18n';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { radius, spacing, useTheme, useThemeControls, type ThemeMode } from '@/theme';

const LANGUAGES: { code: AppLocale; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' },
];

const MODES: { key: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'system', label: 'System', icon: 'phone-portrait-outline' },
  { key: 'light', label: 'Light', icon: 'sunny-outline' },
  { key: 'dark', label: 'Dark', icon: 'moon-outline' },
];

export default function SettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { mode, setMode } = useThemeControls();
  const { user, signOut } = useAuth();

  function changeLanguage(code: AppLocale) {
    if (code === i18n.language) return;
    i18n.changeLanguage(code);
    const needsReload = applyLayoutDirection(code);
    if (needsReload) {
      Alert.alert('Restart needed', 'Please close and reopen Mizan to complete the language change.');
    }
  }

  // "Active sessions": the Supabase client can't enumerate other devices
  // (that's an admin-only API), but it CAN revoke every session for this user.
  // So this is a real security control — sign out everywhere.
  function handleActiveSessions() {
    Alert.alert(
      'Active sessions',
      "You're signed in on this device. If you've lost a device or just want to be safe, you can sign out everywhere — you'll need to sign in again on all your devices.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out everywhere',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.auth.signOut({ scope: 'global' });
            if (error) Alert.alert('Could not sign out', error.message);
          },
        },
      ],
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top }}>
      <DetailHeader title="Settings" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.gutter, paddingBottom: insets.bottom + spacing.xl, gap: spacing.lg }}>
        <Card elevated style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ width: 48, height: 48, borderRadius: radius.full, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Text variant="title" weight="bold" style={{ color: theme.colors.primaryForeground }}>
              {(user?.email?.[0] ?? 'M').toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="callout" weight="semibold" numberOfLines={1}>
              {user?.email ?? 'Signed in'}
            </Text>
            <Text variant="footnote" color="mutedForeground">
              Client account
            </Text>
          </View>
        </Card>

        <View style={{ gap: spacing.sm }}>
          <Text variant="title">Language</Text>
          <Card padded={false} style={{ overflow: 'hidden' }}>
            {LANGUAGES.map((l, i) => (
              <SelectRow
                key={l.code}
                label={l.label}
                selected={i18n.language === l.code}
                isLast={i === LANGUAGES.length - 1}
                onPress={() => changeLanguage(l.code)}
              />
            ))}
          </Card>
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text variant="title">Appearance</Text>
          <Card padded={false} style={{ overflow: 'hidden' }}>
            {MODES.map((m, i) => (
              <SelectRow
                key={m.key}
                label={m.label}
                icon={m.icon}
                selected={mode === m.key}
                isLast={i === MODES.length - 1}
                onPress={() => setMode(m.key)}
              />
            ))}
          </Card>
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text variant="title">Security</Text>
          <Card padded={false} style={{ overflow: 'hidden' }}>
            <ActionRow icon="finger-print-outline" label="Backup codes" onPress={() => router.push('/backup-codes')} />
            <ActionRow icon="phone-portrait-outline" label="Active sessions" onPress={handleActiveSessions} isLast />
          </Card>
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text variant="title">About</Text>
          <Card padded={false} style={{ overflow: 'hidden' }}>
            <ActionRow icon="document-text-outline" label="Privacy Policy" onPress={() => router.push('/privacy-policy')} />
            <ActionRow icon="document-text-outline" label="Terms of Service" onPress={() => router.push('/terms-of-service')} isLast />
          </Card>
        </View>

        <Button title="Sign out" variant="secondary" icon="log-out-outline" onPress={signOut} fullWidth />
      </ScrollView>
    </View>
  );
}

function SelectRow({
  label,
  icon,
  selected,
  isLast,
  onPress,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  isLast: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        padding: spacing.base,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: theme.colors.border,
      }}>
      {icon ? <Ionicons name={icon} size={18} color={theme.colors.mutedForeground} /> : null}
      <Text variant="body" weight="medium" style={{ flex: 1 }}>
        {label}
      </Text>
      <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={onPress} hitSlop={8}>
        <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={20} color={selected ? theme.colors.primary : theme.colors.mutedForeground} />
      </Pressable>
    </View>
  );
}

function ActionRow({ icon, label, onPress, isLast }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; isLast?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.base,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: theme.colors.border,
        opacity: pressed ? 0.6 : 1,
      })}>
      <Ionicons name={icon} size={18} color={theme.colors.mutedForeground} />
      <Text variant="body" weight="medium" style={{ flex: 1 }}>
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={16} color={theme.colors.mutedForeground} />
    </Pressable>
  );
}
