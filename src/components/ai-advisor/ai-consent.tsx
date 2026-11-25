import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Cta } from '@/components/horizon/cta';
import { BRIDGE_WIDTH, FieldBack, HORIZON_GUTTER, HorizonScreen } from '@/components/horizon/horizon-screen';
import { RuledRow } from '@/components/horizon/ruled';
import { Text } from '@/components/ui';
import { recordAiConsent } from '@/lib/ai-consent';
import { useTheme } from '@/theme';
import { horizonColors } from '@/theme/horizon';

const CONSENT_FIELD = 232;

interface AiConsentProps {
  userId: string;
  onAgreed: () => void;
  onDeclined: () => void;
}

/**
 * Asked once, before the AI advisor is first used: what leaves the app, where
 * it goes, and what the answers are worth. Nothing is sent to an AI provider
 * until the person agrees here.
 */
export function AiConsent({ userId, onAgreed, onDeclined }: AiConsentProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const colors = horizonColors(theme.colors);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  async function agree() {
    setSaving(true);
    setFailed(false);
    const saved = await recordAiConsent(userId, true);
    setSaving(false);
    if (saved) onAgreed();
    else setFailed(true);
  }

  return (
    <HorizonScreen
      field={CONSENT_FIELD}
      small
      lines={[{ text: t('support.aiTitleA') }, { text: t('support.aiTitleB'), soft: true }]}
      sub={t('support.aiSub')}
      top={<FieldBack colors={colors} onPress={onDeclined} />}
      // The one thing to decide on this screen.
      bridge={{ start: HORIZON_GUTTER, width: BRIDGE_WIDTH }}>
      <RuledRow title={t('support.aiWhatTitle')} meta={t('support.aiWhatBody')} plain />
      <RuledRow title={t('support.aiWhereTitle')} meta={t('support.aiWhereBody')} plain />
      <RuledRow title={t('support.aiWorthTitle')} meta={t('support.aiWorthBody')} plain />
      <RuledRow title={t('support.aiChoiceTitle')} meta={t('support.aiChoiceBody')} plain />

      <View style={{ paddingHorizontal: HORIZON_GUTTER, paddingTop: 20, gap: 10 }}>
        {failed ? (
          <Text variant="footnote" color="danger" accessibilityLiveRegion="polite">
            {t('support.aiSaveFailed')}
          </Text>
        ) : null}
        <Cta title={t('support.aiAgree')} busy={saving} onPress={() => void agree()} />
        <Cta kind="outline" title={t('support.aiNotNow')} disabled={saving} onPress={onDeclined} />
      </View>
    </HorizonScreen>
  );
}
