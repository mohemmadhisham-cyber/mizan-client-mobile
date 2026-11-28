import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

import { Cta } from '@/components/horizon/cta';
import {
  BRIDGE_WIDTH,
  FieldBack,
  FieldMark,
  HORIZON_GUTTER,
  HorizonScreen,
} from '@/components/horizon/horizon-screen';
import { Input, Text } from '@/components/ui';
import { emailSchema, peekInvite, sendEmailOtp } from '@/services/auth';
import { useTheme } from '@/theme';
import { horizonColors } from '@/theme/horizon';

const EMAIL_FIELD = 200;
const GROUND_TOP = 22;
const GROUND_GAP = 16;
const EMAIL_TEXT_SIZE = 18;

export default function EmailScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useTheme();
  const colors = horizonColors(theme.colors);
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
          : t('auth.noAccount'),
      );
      return;
    }
    router.push({
      pathname: '/verify',
      params: { email: normalized, ...(token ? { token } : {}) },
    });
  };

  // Opened from an invite link there is nothing behind this screen. Going
  // elsewhere would drop the invite, so then there is no Back, only the mark.
  const canLeave = router.canGoBack();

  return (
    // The keyboard is handled as these screens always handled it, so the button stays in reach.
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.ground }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <HorizonScreen
      field={EMAIL_FIELD}
      small
      lines={[{ text: t('horizonAuth.emailA') }, { text: t('horizonAuth.emailB'), soft: true }]}
      sub={t('horizonAuth.emailSub')}
      top={canLeave ? <FieldBack colors={colors} /> : <FieldMark />}
      // The one thing to do here.
      bridge={{ start: HORIZON_GUTTER, width: BRIDGE_WIDTH }}>
      <View style={{ paddingHorizontal: HORIZON_GUTTER, paddingTop: GROUND_TOP, gap: GROUND_GAP }}>
        <Input
          label={t('auth.emailLabel')}
          variant="underline"
          // On the ground the field is a line to write on, not a box.
          style={{ backgroundColor: 'transparent', paddingHorizontal: 0, fontSize: EMAIL_TEXT_SIZE }}
          accessibilityLabel={t('auth.emailLabel')}
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
          <Text variant="footnote" color="danger" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
        <Cta title={t('auth.sendCode')} disabled={!valid} busy={busy} onPress={() => void submit()} />
        <Text variant="footnote" color="mutedForeground">
          {t('horizonAuth.emailHelp')}
        </Text>
      </View>
    </HorizonScreen>
    </KeyboardAvoidingView>
  );
}
