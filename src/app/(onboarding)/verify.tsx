import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';

import { AmbientBackdrop } from '@/components/auth/ambient-backdrop';
import { OtpBoxInput } from '@/components/auth/otp-box-input';
import { Button, Card, Text } from '@/components/ui';
import { chevronBack } from '@/lib/direction';
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

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AmbientBackdrop />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.gutter }}
          keyboardShouldPersistTaps="handled">
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

            <OtpBoxInput
              value={code}
              onChangeText={(v) => {
                setError(null);
                setCode(v);
              }}
              onSubmit={submit}
            />

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

            <Button
              title={t('auth.verify')}
              onPress={submit}
              disabled={code.length < 6}
              loading={busy}
              fullWidth
            />

            <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name={chevronBack()} size={14} color={theme.colors.mutedForeground} />
              <Text variant="footnote" color="mutedForeground">
                {t('auth.backToEmail')}
              </Text>
            </Pressable>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
