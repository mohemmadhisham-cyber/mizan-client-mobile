import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Button, Input, Screen, Text } from '@/components/ui';
import { acceptInvite, sendEmailOtp, verifyEmailOtp } from '@/services/auth';
import { spacing } from '@/theme';

const RESEND_SECONDS = 30;

export default function VerifyScreen() {
  const { t } = useTranslation();
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

  const submit = async () => {
    if (code.length < 6 || busy) return;
    setError(null);
    setBusy(true);
    const res = await verifyEmailOtp(email, code);
    if (!res.ok) {
      setBusy(false);
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
    const res = await sendEmailOtp(email, true);
    if (!res.ok) {
      setError(res.error ?? t('auth.genericError'));
      return;
    }
    setCooldown(RESEND_SECONDS);
  };

  return (
    <Screen clearsTabBar={false} edges={['top', 'bottom']}>
      <View style={{ flex: 1, gap: spacing.lg, paddingTop: spacing['3xl'] }}>
        <View style={{ gap: spacing.sm }}>
          <Text variant="h1">{t('auth.verifyTitle')}</Text>
          <Text variant="body" color="mutedForeground">
            {t('auth.verifyBody', { email })}
          </Text>
        </View>
        <Input
          value={code}
          onChangeText={(v) => {
            setCode(v.replace(/\D/g, '').slice(0, 6));
            setError(null);
          }}
          placeholder="••••••"
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={6}
          autoFocus
          returnKeyType="go"
          onSubmitEditing={submit}
          style={{ textAlign: 'center', fontSize: 28, letterSpacing: 8 }}
        />
        {error ? (
          <Text variant="footnote" color="danger">
            {error}
          </Text>
        ) : null}
        <Pressable onPress={resend} disabled={cooldown > 0} accessibilityRole="button">
          <Text variant="footnote" color={cooldown > 0 ? 'mutedForeground' : 'primary'} center>
            {cooldown > 0 ? t('auth.resendIn', { seconds: cooldown }) : t('auth.resend')}
          </Text>
        </Pressable>
      </View>
      <Button
        title={t('auth.verify')}
        icon="shield-checkmark-outline"
        onPress={submit}
        disabled={code.length < 6}
        loading={busy}
        fullWidth
      />
    </Screen>
  );
}
