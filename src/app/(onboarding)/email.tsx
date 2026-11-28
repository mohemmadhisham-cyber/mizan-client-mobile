import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { AmbientBackdrop } from '@/components/auth/ambient-backdrop';
import { Button, Card, Input, Screen, Text } from '@/components/ui';
import { emailSchema, peekInvite, sendEmailOtp } from '@/services/auth';
import { spacing } from '@/theme';

export default function EmailScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === 'string' ? params.token : undefined;

  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Only a *validated* invite (checked server-side via peekInvite) is allowed
  // to create a brand-new account. This app has no self-serve sign-up --
  // every account is provisioned by an accountant's invite.
  const [invitedEmail, setInvitedEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    peekInvite(token).then((r) => {
      if (r.valid && r.email) {
        setEmail(r.email);
        setInvitedEmail(r.email);
      }
    });
  }, [token]);

  const valid = emailSchema.safeParse(email.trim().toLowerCase()).success;

  const submit = async () => {
    if (!valid || busy) return;
    setError(null);
    setBusy(true);
    const normalized = email.trim().toLowerCase();
    const canCreateAccount = invitedEmail !== null && invitedEmail.toLowerCase() === normalized;
    const res = await sendEmailOtp(email, canCreateAccount);
    setBusy(false);
    if (!res.ok) {
      setError(
        canCreateAccount
          ? (res.error ?? t('auth.genericError'))
          : "We couldn't find an account for that email. Ask your accountant to send you an invite.",
      );
      return;
    }
    router.push({
      pathname: '/verify',
      params: { email: normalized, ...(token ? { token } : {}) },
    });
  };

  return (
    <Screen clearsTabBar={false} edges={['top', 'bottom']}>
      <AmbientBackdrop />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', gap: spacing.xl }}
          keyboardShouldPersistTaps="handled">
          <View style={{ gap: spacing.sm }}>
            <Text variant="h1" center>
              {t('auth.emailTitle')}
            </Text>
            <Text variant="body" color="mutedForeground" center>
              {t('auth.emailBody')}
            </Text>
          </View>

          <Card elevated style={{ gap: spacing.lg, paddingVertical: spacing.xl }}>
            <Input
              label={t('auth.emailLabel')}
              icon="mail-outline"
              variant="underline"
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                setError(null);
              }}
              placeholder={t('auth.emailPlaceholder')}
              keyboardType="email-address"
              inputMode="email"
              autoCapitalize="none"
              autoComplete="email"
              autoFocus
              returnKeyType="go"
              onSubmitEditing={submit}
            />
            {error ? (
              <Text variant="footnote" color="danger">
                {error}
              </Text>
            ) : null}
            <Button
              title={t('auth.sendCode')}
              icon="arrow-forward"
              onPress={submit}
              disabled={!valid}
              loading={busy}
              fullWidth
            />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
