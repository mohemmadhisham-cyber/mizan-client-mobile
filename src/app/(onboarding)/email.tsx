import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, Input, Screen, Text } from '@/components/ui';
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

  useEffect(() => {
    if (!token) return;
    peekInvite(token).then((r) => {
      if (r.valid && r.email) setEmail(r.email);
    });
  }, [token]);

  const valid = emailSchema.safeParse(email.trim().toLowerCase()).success;

  const submit = async () => {
    if (!valid || busy) return;
    setError(null);
    setBusy(true);
    const res = await sendEmailOtp(email, true);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? t('auth.genericError'));
      return;
    }
    router.push({
      pathname: '/verify',
      params: { email: email.trim().toLowerCase(), ...(token ? { token } : {}) },
    });
  };

  return (
    <Screen clearsTabBar={false} edges={['top', 'bottom']}>
      <View style={{ flex: 1, gap: spacing.lg, paddingTop: spacing['3xl'] }}>
        <View style={{ gap: spacing.sm }}>
          <Text variant="h1">{t('auth.emailTitle')}</Text>
          <Text variant="body" color="mutedForeground">
            {t('auth.emailBody')}
          </Text>
        </View>
        <View style={{ gap: spacing.xs }}>
          <Input
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
        </View>
      </View>
      <Button
        title={t('auth.sendCode')}
        icon="mail-outline"
        onPress={submit}
        disabled={!valid}
        loading={busy}
        fullWidth
      />
    </Screen>
  );
}
