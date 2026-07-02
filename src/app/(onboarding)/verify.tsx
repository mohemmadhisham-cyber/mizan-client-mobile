import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AmbientBackdrop } from '@/components/auth/ambient-backdrop';
import { Keypad } from '@/components/auth/keypad';
import { OtpBoxInput } from '@/components/auth/otp-box-input';
import { Button, Card, Text } from '@/components/ui';
import { acceptInvite, sendEmailOtp, verifyEmailOtp } from '@/services/auth';
import { spacing, useTheme } from '@/theme';

const RESEND_SECONDS = 30;

export default function VerifyScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
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
    const res = await sendEmailOtp(email, true);
    if (!res.ok) {
      setError(res.error ?? t('auth.genericError'));
      return;
    }
    setCooldown(RESEND_SECONDS);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', padding: spacing.gutter }}>
      <AmbientBackdrop topColor="#D5E3FF" bottomColor="#6BFE9C" />

      <Card elevated style={{ width: '100%', maxWidth: 448, alignItems: 'center', gap: spacing.md }}>
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Text variant="h1" center>
            {t('auth.verifyTitle')}
          </Text>
          <Text variant="footnote" color="mutedForeground" center>
            {t('auth.verifyBodyPrefix')}
          </Text>
          <Text variant="title" weight="semibold" center>
            {email}
          </Text>
        </View>

        <OtpBoxInput value={code} />

        {error ? (
          <Text variant="footnote" color="danger" center>
            {error}
          </Text>
        ) : null}

        <Pressable onPress={resend} disabled={cooldown > 0} accessibilityRole="button" hitSlop={8}>
          <Text variant="caption" weight="semibold" color={cooldown > 0 ? 'mutedForeground' : 'primary'} style={{ letterSpacing: 1.2, textTransform: 'uppercase' }}>
            {t('auth.resend')} {cooldown > 0 ? `(0:${String(cooldown).padStart(2, '0')})` : ''}
          </Text>
        </Pressable>

        <Keypad
          onDigit={(d) => {
            setError(null);
            setCode((c) => (c.length < 6 ? c + d : c));
          }}
          onBackspace={() => {
            setError(null);
            setCode((c) => c.slice(0, -1));
          }}
        />

        <Button
          title={t('auth.verify')}
          onPress={submit}
          disabled={code.length < 6}
          loading={busy}
          fullWidth
        />

        <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="chevron-back" size={14} color={theme.colors.mutedForeground} />
          <Text variant="footnote" color="mutedForeground">
            {t('auth.backToEmail')}
          </Text>
        </Pressable>
      </Card>
    </View>
  );
}
