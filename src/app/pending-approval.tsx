import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AmbientBackdrop } from '@/components/auth/ambient-backdrop';
import { EmptyState, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { spacing, useTheme } from '@/theme';

/**
 * Shown when a session exists but has no linked client company yet (no
 * `user_roles` row with a `client_id` for this user). Reachable only via the
 * auth gate (useAuthGate) — never a route the user navigates to directly.
 * Self-serve "Get Started" signups land here until their accountant sends
 * and they accept a real invite; invite-link signups skip this entirely
 * since acceptInvite() already sets client_id before the gate ever checks.
 */
export default function PendingApprovalScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { user, refresh, signOut } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [stillPending, setStillPending] = useState(false);

  async function checkAgain() {
    setChecking(true);
    setStillPending(false);
    await refresh();
    setChecking(false);
    setStillPending(true);
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AmbientBackdrop />
      <View style={{ flex: 1 }}>
        <EmptyState
          icon="time-outline"
          title={t('gates.pendingTitle')}
          message={t('gates.pendingBody', { account: user?.email ?? t('gates.yourAccount') })}
          actionLabel={checking ? t('common.checking') : t('gates.checkAgain')}
          onAction={checkAgain}
        />
      </View>
      {stillPending ? (
        <Text variant="footnote" color="mutedForeground" center style={{ marginBottom: spacing.lg }}>
          {t('gates.stillPending')}
        </Text>
      ) : null}
      <Pressable accessibilityRole="button" onPress={() => void signOut()} style={{ alignSelf: 'center', paddingBottom: spacing.xl }}>
        <Text variant="footnote" color="mutedForeground">
          {t('auth.signOut')}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/delete-account')}
        hitSlop={8}
        style={{ alignSelf: 'center', paddingBottom: spacing.xl }}>
        <Text variant="footnote" color="mutedForeground">
          {t('support.deleteEntry')}
        </Text>
      </Pressable>
    </View>
  );
}
