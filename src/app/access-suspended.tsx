import { openBrowserAsync } from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AmbientBackdrop } from '@/components/auth/ambient-backdrop';
import { EmptyState, Text } from '@/components/ui';
import { EXPO_PUBLIC_WEB_APP_URL } from '@/lib/env';
import { useAuth } from '@/lib/auth-context';
import { createRenewalLink } from '@/services/client-billing';
import { spacing, useTheme } from '@/theme';

/**
 * Shown when a session has a linked client company whose `clients.status`
 * is 'suspended' (e.g. non-renewal) — reachable only via the auth gate
 * (useAuthGate), never navigated to directly. RLS (user_client()) already
 * blocks all real data server-side; this is the friendly explanation on top.
 */
export default function AccessSuspendedScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { refresh, signOut } = useAuth();
  const [checking, setChecking] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [renewError, setRenewError] = useState<string | null>(null);

  async function checkAgain() {
    setChecking(true);
    await refresh();
    setChecking(false);
  }

  async function renewNow() {
    setRenewing(true);
    setRenewError(null);
    const res = await createRenewalLink();
    setRenewing(false);
    if (!res.ok || !res.token) {
      setRenewError(res.error ?? t('gates.noInvoice'));
      return;
    }
    await openBrowserAsync(`${EXPO_PUBLIC_WEB_APP_URL}/pay/${res.token}`);
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AmbientBackdrop tone="warning" />
      <View style={{ flex: 1 }}>
        <EmptyState
          icon="lock-closed-outline"
          title={t('gates.suspendedTitle')}
          message={t('gates.suspendedBody')}
          actionLabel={renewing ? t('common.opening') : t('gates.renewNow')}
          onAction={renewNow}
        />
        {renewError ? (
          <Text variant="footnote" color="danger" center style={{ marginHorizontal: spacing.gutter, marginBottom: spacing.md }}>
            {renewError}
          </Text>
        ) : null}
      </View>
      <Pressable accessibilityRole="button" onPress={checkAgain} style={{ alignSelf: 'center', paddingBottom: spacing.md }}>
        <Text variant="footnote" color="primary">
          {checking ? t('common.checking') : t('gates.renewedCheckAgain')}
        </Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => void signOut()} style={{ alignSelf: 'center', paddingBottom: spacing.xl }}>
        <Text variant="footnote" color="mutedForeground">
          {t('auth.signOut')}
        </Text>
      </Pressable>
    </View>
  );
}
