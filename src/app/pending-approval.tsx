import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Cta } from '@/components/horizon/cta';
import { FieldMark, HORIZON_GUTTER, HorizonScreen } from '@/components/horizon/horizon-screen';
import { Text } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';

const PENDING_FIELD = 220;
const GROUND_TOP = 22;
const GROUND_GAP = 16;

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
  const { user, refresh, signOut } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [stillPending, setStillPending] = useState(false);

  async function checkAgain() {
    setChecking(true);
    setStillPending(false);
    try {
      await refresh();
    } finally {
      setChecking(false);
      setStillPending(true);
    }
  }

  return (
    <HorizonScreen
      field={PENDING_FIELD}
      small
      lines={[{ text: t('horizonAuth.pendingA') }, { text: t('horizonAuth.pendingB'), soft: true }]}
      sub={t('gates.pendingTitle')}
      top={<FieldMark />}
      // The next move is the accountant's, not the person's.
      bridge={null}>
      <View style={{ paddingHorizontal: HORIZON_GUTTER, paddingTop: GROUND_TOP, gap: GROUND_GAP }}>
        <Text variant="body">{t('gates.pendingBody', { account: user?.email ?? t('gates.yourAccount') })}</Text>
        {stillPending ? (
          <Text variant="footnote" color="mutedForeground" accessibilityLiveRegion="polite">
            {t('gates.stillPending')}
          </Text>
        ) : null}
        <Cta title={t('gates.checkAgain')} busy={checking} onPress={() => void checkAgain()} />
        <View>
          <Cta kind="quiet" title={t('auth.signOut')} onPress={() => void signOut()} />
          <Cta kind="quiet" title={t('support.deleteEntry')} onPress={() => router.push('/delete-account')} />
        </View>
      </View>
    </HorizonScreen>
  );
}
