import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Linking, View } from 'react-native';

import { Cta } from '@/components/horizon/cta';
import type { HeadlineLine } from '@/components/horizon/headline';
import { BRIDGE_WIDTH, FieldBack, HORIZON_GUTTER, HorizonScreen } from '@/components/horizon/horizon-screen';
import { RuledRow } from '@/components/horizon/ruled';
import { Text } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { SUPPORT_EMAIL, supportMailto } from '@/lib/contact';
import { requestAccountDeletion } from '@/services/account-deletion';
import { useTheme } from '@/theme';
import { horizonColors } from '@/theme/horizon';

const DELETE_FIELD = 200;

type Stage = 'explain' | 'requested' | 'by-email';

/**
 * Delete my account. Says what goes and what the law requires to be kept,
 * asks once more, then sends the request. The server decides who is asking and
 * what is removed; the app sends no id. If the server does not take the
 * request from the app yet, the person is shown how to ask by email instead.
 */
export default function DeleteAccountScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const colors = horizonColors(theme.colors);
  const router = useRouter();
  const { user } = useAuth();
  const [stage, setStage] = useState<Stage>('explain');
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  // Set at once on tap, unlike state: two taps send one request.
  const inFlight = useRef(false);

  async function send() {
    if (inFlight.current) return;
    inFlight.current = true;
    setSending(true);
    setFailed(false);
    try {
      const outcome = await requestAccountDeletion();
      setStage(outcome.status === 'requested' ? 'requested' : 'by-email');
    } catch {
      setFailed(true);
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }

  function confirm() {
    Alert.alert(t('support.deleteConfirmTitle'), t('support.deleteConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('support.deleteConfirmYes'), style: 'destructive', onPress: () => void send() },
    ]);
  }

  async function emailRequest() {
    try {
      await Linking.openURL(supportMailto(t('support.deleteEmailSubject')));
    } catch {
      Alert.alert(t('support.emailUs'), SUPPORT_EMAIL);
    }
  }

  const lines: HeadlineLine[] =
    stage === 'requested'
      ? [{ text: t('support.deleteSentTitle') }]
      : [{ text: t('support.deleteTitleA') }, { text: t('support.deleteTitleB'), soft: true }];

  return (
    <HorizonScreen
      field={DELETE_FIELD}
      small
      animateKey={stage}
      lines={lines}
      sub={user?.email ?? undefined}
      top={<FieldBack colors={colors} />}
      bridge={stage === 'explain' ? { start: HORIZON_GUTTER, width: BRIDGE_WIDTH } : null}>
      {stage === 'requested' ? (
        <View style={{ padding: HORIZON_GUTTER, gap: 16 }}>
          <Text variant="body">{t('support.deleteSentBody')}</Text>
          <Cta title={t('common.done')} onPress={() => router.back()} />
        </View>
      ) : stage === 'by-email' ? (
        <View style={{ padding: HORIZON_GUTTER, gap: 16 }}>
          <Text variant="body">{t('support.deleteByEmailBody', { email: SUPPORT_EMAIL })}</Text>
          <Cta title={t('support.deleteByEmailAction')} onPress={() => void emailRequest()} />
        </View>
      ) : (
        <>
          <RuledRow title={t('support.deleteGoesTitle')} meta={t('support.deleteGoesBody')} plain />
          <RuledRow title={t('support.deleteStaysTitle')} meta={t('support.deleteStaysBody')} plain />
          <RuledRow title={t('support.deleteAfterTitle')} meta={t('support.deleteAfterBody')} plain />
          <View style={{ paddingHorizontal: HORIZON_GUTTER, paddingTop: 20, gap: 10 }}>
            {failed ? (
              <Text variant="footnote" color="danger" accessibilityLiveRegion="polite">
                {t('support.deleteFailed')}
              </Text>
            ) : null}
            <Cta title={t('support.deleteAction')} busy={sending} onPress={confirm} />
            <Cta kind="outline" title={t('support.deleteKeep')} disabled={sending} onPress={() => router.back()} />
          </View>
        </>
      )}
    </HorizonScreen>
  );
}
