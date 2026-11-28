import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, KeyboardAvoidingView, Platform, View } from 'react-native';

import { OtpBoxInput } from '@/components/auth/otp-box-input';
import { Cta } from '@/components/horizon/cta';
import { BRIDGE_WIDTH, FieldBack, HORIZON_GUTTER, HorizonScreen } from '@/components/horizon/horizon-screen';
import { Text } from '@/components/ui';
import { acceptInvite, sendEmailOtp, verifyEmailOtp } from '@/services/auth';
import { useTheme } from '@/theme';
import { horizonColors } from '@/theme/horizon';

const RESEND_SECONDS = 30;
const VERIFY_FIELD = 200;
const GROUND_TOP = 22;
const GROUND_GAP = 16;
/** As tall as a button, so the screen does not jump when the countdown ends. */
const RESEND_ROW = 54;

export default function VerifyScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const colors = horizonColors(theme.colors);
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; token?: string }>();
  const email = typeof params.email === 'string' ? params.email : '';
  const token = typeof params.token === 'string' ? params.token : undefined;

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  // The countdown is silent, so say once when Resend can be pressed.
  useEffect(() => {
    if (cooldown === 0) AccessibilityInfo.announceForAccessibility(t('horizonAuth.resendReady'));
  }, [cooldown, t]);

  const submit = async () => {
    if (code.length < 6 || busy) return;
    setError(null);
    setBusy(true);
    const res = await verifyEmailOtp(email, code);
    if (!res.ok) {
      setBusy(false);
      setCode('');
      setError(res.error ?? t('auth.codeError'));
      return;
    }
    // Session is now established. Grant the client_user role if this was an
    // invite, then the auth gate routes into the app on the session change.
    if (token) await acceptInvite(token);
    setBusy(false);
  };

  const resend = async () => {
    if (cooldown > 0) return;
    setError(null);
    // Never create-a-new-account here: by the time we're on this screen the
    // account was already resolved (existing login, or just created via a
    // validated invite back on the email step) -- resend never needs to.
    const res = await sendEmailOtp(email, false);
    if (!res.ok) {
      setError(res.error ?? t('auth.genericError'));
      return;
    }
    setCooldown(RESEND_SECONDS);
  };

  // Back to the email step, to correct the address.
  function leave() {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/email', params: token ? { token } : {} });
  }

  return (
    // The keyboard is handled as these screens always handled it, so the button stays in reach.
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.ground }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <HorizonScreen
      field={VERIFY_FIELD}
      small
      lines={[{ text: t('horizonAuth.verifyA') }, { text: t('horizonAuth.verifyB'), soft: true }]}
      top={<FieldBack colors={colors} onPress={leave} />}
      // The one thing to do here.
      bridge={{ start: HORIZON_GUTTER, width: BRIDGE_WIDTH }}>
      <View style={{ paddingHorizontal: HORIZON_GUTTER, paddingTop: GROUND_TOP, gap: GROUND_GAP }}>
        {/* The address is on the ground, where a long one can wrap. */}
        <View style={{ gap: 2 }}>
          <Text variant="footnote" color="mutedForeground">
            {t('auth.verifyBodyPrefix')}
          </Text>
          <Text variant="body" weight="semibold">
            {email}
          </Text>
        </View>

        <OtpBoxInput
          ruled
          accessibilityLabel={t('horizonAuth.codeLabel')}
          value={code}
          onChangeText={(v) => {
            setError(null);
            setCode(v);
          }}
          onSubmit={submit}
        />

        {error ? (
          <Text variant="footnote" color="danger" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}

        <Cta title={t('auth.verify')} disabled={code.length < 6} busy={busy} onPress={() => void submit()} />

        {cooldown > 0 ? (
          <View style={{ height: RESEND_ROW, alignItems: 'center', justifyContent: 'center' }}>
            <Text variant="body" color="mutedForeground">
              {t('horizonAuth.resendIn', { seconds: cooldown })}
            </Text>
          </View>
        ) : (
          <Cta kind="quiet" title={t('auth.resend')} onPress={() => void resend()} />
        )}
      </View>
    </HorizonScreen>
    </KeyboardAvoidingView>
  );
}
