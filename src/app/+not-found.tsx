import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Cta } from '@/components/horizon/cta';
import { FieldMark, HORIZON_GUTTER, HorizonScreen } from '@/components/horizon/horizon-screen';
import { Text } from '@/components/ui';

const NOT_FOUND_FIELD = 220;

/** A link that leads nowhere in the app: say so, and offer the way home. */
export default function NotFoundScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <HorizonScreen
      field={NOT_FOUND_FIELD}
      lines={[{ text: t('support.notFoundA') }, { text: t('support.notFoundB'), soft: true }]}
      top={<FieldMark />}
      bridge={null}>
      <View style={{ padding: HORIZON_GUTTER, gap: 16 }}>
        <Text variant="body" color="mutedForeground">
          {t('support.notFoundBody')}
        </Text>
        <Cta title={t('support.goHome')} onPress={() => router.replace('/')} />
      </View>
    </HorizonScreen>
  );
}
