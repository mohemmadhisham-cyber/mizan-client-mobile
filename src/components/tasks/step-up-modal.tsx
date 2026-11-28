import { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { OtpBoxInput } from '@/components/auth/otp-box-input';
import { Button, Card, Text } from '@/components/ui';
import { useAppLocked } from '@/hooks/use-app-lock';
import i18n from '@/i18n';
import { useAuth } from '@/lib/auth-context';
import { issueStepUpOtp, verifyStepUpOtp } from '@/services/step-up';
import { spacing, useTheme } from '@/theme';

interface StepUpModalProps {
  visible: boolean;
  scope: string;
  title: string;
  /** Button text. Defaults to "Verify — <title>". */
  actionLabel?: string;
  /** One or two sentences on what verifying will do, shown under the button. */
  note?: string;
  onCancel: () => void;
  onVerified: () => void;
}

/**
 * Re-verification gate for sensitive actions (e.g. approvals). Sends a fresh
 * OTP to the signed-in user's own email on open; verifying grants a scoped,
 * short-lived step_up_grants row server-side (see services/step-up.ts).
 */
export function StepUpModal({ visible, scope, title, actionLabel, note, onCancel, onVerified }: StepUpModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const appLocked = useAppLocked();
  const { user } = useAuth();
  const email = user?.email ?? '';

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !email) return;
    let cancelled = false;

    async function sendCode() {
      setCode('');
      setError(null);
      setSending(true);
      const res = await issueStepUpOtp(email);
      if (cancelled) return;
      setSending(false);
      if (!res.ok) setError(res.error ?? i18n.t('stepUp.sendFailed'));
    }

    void sendCode();
    return () => {
      cancelled = true;
    };
  }, [visible, email]);

  async function submit() {
    if (code.length < 6 || busy) return;
    setBusy(true);
    setError(null);
    const res = await verifyStepUpOtp(email, code, scope);
    setBusy(false);
    if (!res.ok || !res.granted) {
      setCode('');
      setError(res.error ?? t('stepUp.verifyFailed'));
      return;
    }
    onVerified();
  }

  return (
    // Closed while the app is locked: a sheet is drawn above the lock. It comes back as it was.
    <Modal visible={visible && !appLocked} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: theme.colors.scrim, justifyContent: 'flex-end' }}>
        <Card
          elevated
          style={{
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            paddingBottom: insets.bottom + spacing.lg,
            gap: spacing.md,
            alignItems: 'center',
          }}>
          <Text variant="title" center>
            {t('stepUp.title')}
          </Text>
          <Text variant="footnote" color="mutedForeground" center>
            {sending ? t('stepUp.sendingTo', { email }) : t('stepUp.enterCodeSentTo', { email })}
          </Text>

          <OtpBoxInput
            accessibilityLabel={t('horizonAuth.codeLabel')}
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

          <Button
            title={actionLabel ?? t('stepUp.verifyAction', { title })}
            onPress={submit}
            disabled={code.length < 6}
            loading={busy}
            fullWidth
          />
          {note ? (
            <Text variant="footnote" color="mutedForeground" center>
              {note}
            </Text>
          ) : null}
          <Pressable accessibilityRole="button" onPress={onCancel}>
            <Text variant="footnote" color="mutedForeground">
              {t('common.cancel')}
            </Text>
          </Pressable>
        </Card>
      </View>
    </Modal>
  );
}
