import { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Keypad } from '@/components/auth/keypad';
import { OtpBoxInput } from '@/components/auth/otp-box-input';
import { Button, Card, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { issueStepUpOtp, verifyStepUpOtp } from '@/services/step-up';
import { spacing } from '@/theme';

interface StepUpModalProps {
  visible: boolean;
  scope: string;
  title: string;
  onCancel: () => void;
  onVerified: () => void;
}

/**
 * Re-verification gate for sensitive actions (e.g. approvals). Sends a fresh
 * OTP to the signed-in user's own email on open; verifying grants a scoped,
 * short-lived step_up_grants row server-side (see services/step-up.ts).
 */
export function StepUpModal({ visible, scope, title, onCancel, onVerified }: StepUpModalProps) {
  const insets = useSafeAreaInsets();
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
      if (!res.ok) setError(res.error ?? 'Could not send a code.');
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
      setError(res.error ?? 'Verification failed. Try again.');
      return;
    }
    onVerified();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
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
            Verify it&apos;s you
          </Text>
          <Text variant="footnote" color="mutedForeground" center>
            {sending ? 'Sending a code to ' : 'Enter the 6-digit code sent to '}
            {email}
          </Text>

          <OtpBoxInput value={code} />

          {error ? (
            <Text variant="footnote" color="danger" center>
              {error}
            </Text>
          ) : null}

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

          <Button title={`Verify — ${title}`} onPress={submit} disabled={code.length < 6} loading={busy} fullWidth />
          <Pressable accessibilityRole="button" onPress={onCancel}>
            <Text variant="footnote" color="mutedForeground">
              Cancel
            </Text>
          </Pressable>
        </Card>
      </View>
    </Modal>
  );
}
