import { openBrowserAsync } from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

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
      setRenewError(res.error ?? 'No outstanding invoice found — ask your accountant to reactivate your account.');
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
          title="Your access has been suspended"
          message="Your accountant has paused access to this workspace — often due to a subscription renewal. Renew now to restore access, or contact your accountant."
          actionLabel={renewing ? 'Opening…' : 'Renew now'}
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
          {checking ? 'Checking…' : "I've renewed — check again"}
        </Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => void signOut()} style={{ alignSelf: 'center', paddingBottom: spacing.xl }}>
        <Text variant="footnote" color="mutedForeground">
          Sign out
        </Text>
      </Pressable>
    </View>
  );
}
