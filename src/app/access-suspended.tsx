import { useRouter } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Cta } from '@/components/horizon/cta';
import { BRIDGE_WIDTH, FieldMark, HORIZON_GUTTER, HorizonScreen } from '@/components/horizon/horizon-screen';
import { Text } from '@/components/ui';
import { EXPO_PUBLIC_WEB_APP_URL } from '@/lib/env';
import { useAuth } from '@/lib/auth-context';
import { createRenewalLink } from '@/services/client-billing';

const SUSPENDED_FIELD = 220;
const GROUND_TOP = 22;
const GROUND_GAP = 16;

/**
 * Shown when a session has a linked client company whose `clients.status`
 * is 'suspended' (e.g. non-renewal) — reachable only via the auth gate
 * (useAuthGate), never navigated to directly. RLS (user_client()) already
 * blocks all real data server-side; this is the friendly explanation on top.
 */
export default function AccessSuspendedScreen() {
  const { t } = useTranslation();
  const { refresh, signOut } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [renewError, setRenewError] = useState<string | null>(null);

  async function checkAgain() {
    setChecking(true);
    try {
      await refresh();
    } finally {
      setChecking(false);
    }
  }

  async function renewNow() {
    setRenewing(true);
    setRenewError(null);
    try {
      const res = await createRenewalLink();
      if (!res.ok || !res.token) {
        setRenewError(res.error ?? t('gates.noInvoice'));
        return;
      }
      setRenewing(false);
      await openBrowserAsync(`${EXPO_PUBLIC_WEB_APP_URL}/pay/${res.token}`);
    } catch {
      setRenewError(t('auth.genericError'));
    } finally {
      setRenewing(false);
    }
  }

  return (
    <HorizonScreen
      field={SUSPENDED_FIELD}
      small
      lines={[{ text: t('horizonAuth.suspendedA') }, { text: t('horizonAuth.suspendedB'), soft: true }]}
      sub={t('gates.suspendedTitle')}
      top={<FieldMark />}
      // Renewing is the person's to do.
      bridge={{ start: HORIZON_GUTTER, width: BRIDGE_WIDTH }}>
      <View style={{ paddingHorizontal: HORIZON_GUTTER, paddingTop: GROUND_TOP, gap: GROUND_GAP }}>
        <Text variant="body">{t('gates.suspendedBody')}</Text>
        {renewError ? (
          <Text variant="footnote" color="danger" accessibilityLiveRegion="polite">
            {renewError}
          </Text>
        ) : null}
        <Cta title={t('gates.renewNow')} busy={renewing} disabled={checking} onPress={() => void renewNow()} />
        <Cta
          kind="outline"
          title={t('gates.renewedCheckAgain')}
          busy={checking}
          disabled={renewing}
          onPress={() => void checkAgain()}
        />
        <View>
          <Cta kind="quiet" title={t('auth.signOut')} onPress={() => void signOut()} />
          <Cta kind="quiet" title={t('support.deleteEntry')} onPress={() => router.push('/delete-account')} />
        </View>
      </View>
    </HorizonScreen>
  );
}
