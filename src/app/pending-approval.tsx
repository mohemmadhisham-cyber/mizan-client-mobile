import { useState } from 'react';
import { Pressable, View } from 'react-native';

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
  const theme = useTheme();
  const { user, refresh, signOut } = useAuth();
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
      <AmbientBackdrop topColor="#D5E3FF" bottomColor="#6BFE9C" />
      <View style={{ flex: 1 }}>
        <EmptyState
          icon="time-outline"
          title="Your account is pending approval"
          message={`${user?.email ?? 'Your account'} isn't linked to a company yet. Ask your accountant to send you an invite, or confirm they've completed it.`}
          actionLabel={checking ? 'Checking…' : 'Check again'}
          onAction={checkAgain}
        />
      </View>
      {stillPending ? (
        <Text variant="footnote" color="mutedForeground" center style={{ marginBottom: spacing.lg }}>
          Still not linked. Try again once your accountant confirms.
        </Text>
      ) : null}
      <Pressable accessibilityRole="button" onPress={() => void signOut()} style={{ alignSelf: 'center', paddingBottom: spacing.xl }}>
        <Text variant="footnote" color="mutedForeground">
          Sign out
        </Text>
      </Pressable>
    </View>
  );
}
