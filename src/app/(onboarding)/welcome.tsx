import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, useWindowDimensions, View } from 'react-native';

import { Cta } from '@/components/horizon/cta';
import {
  BRIDGE_WIDTH,
  FieldMark,
  FieldNote,
  HORIZON_GUTTER,
  HorizonScreen,
} from '@/components/horizon/horizon-screen';
import { useHorizonMotion } from '@/components/horizon/motion';
import { Text } from '@/components/ui';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useTheme } from '@/theme';
import { horizonColors } from '@/theme/horizon';

// Three screens that say what the app is for. The faint figure in the field is
// decoration, not data: a number, a time, a one-time code.
const SLIDES = [
  { key: 's1', art: '24,680' },
  { key: 's2', art: '10:00' },
  { key: 's3', art: '417902' },
] as const;
const LAST = SLIDES.length - 1;
/** Share of the screen the field takes on the welcome screens. */
const FIELD_SHARE = 0.62;

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const reduced = useReducedMotion();
  const motion = useHorizonMotion(reduced);
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const colors = horizonColors(theme.colors);

  // The gold bridge is the page marker: it moves along the line with each screen.
  const track = width - HORIZON_GUTTER * 2 - BRIDGE_WIDTH;
  const bridge = { start: HORIZON_GUTTER + (track * index) / LAST, width: BRIDGE_WIDTH };
  const show = (next: number) =>
    motion.leave(() => {
      setIndex(next);
      // The words change without a new screen opening, so say them.
      const key = SLIDES[next].key;
      AccessibilityInfo.announceForAccessibility(`${t(`welcome.${key}a`)} ${t(`welcome.${key}b`)}`);
    });

  return (
    <HorizonScreen
      field={Math.round(height * FIELD_SHARE)}
      motion={motion}
      animateKey={index}
      art={slide.art}
      bridge={bridge}
      lines={[{ text: t(`welcome.${slide.key}a`) }, { text: t(`welcome.${slide.key}b`), soft: true }]}
      sub={t(`welcome.${slide.key}sub`)}
      top={
        <>
          <FieldMark />
          <FieldNote colors={colors}>{t('welcome.page', { page: index + 1, pages: SLIDES.length })}</FieldNote>
        </>
      }>
      <View style={{ paddingHorizontal: HORIZON_GUTTER, paddingTop: 34, gap: 10 }}>
        {index < LAST ? (
          <>
            <Cta title={t('common.continue')} onPress={() => show(index + 1)} />
            <Cta kind="quiet" title={t('welcome.skip')} onPress={() => show(LAST)} />
          </>
        ) : (
          <>
            <Cta title={t('welcome.signIn')} onPress={() => router.push('/email')} />
            <Text variant="footnote" color="mutedForeground" center style={{ paddingTop: 6 }}>
              {t('welcome.invitedOnly')}
            </Text>
          </>
        )}
      </View>
    </HorizonScreen>
  );
}
