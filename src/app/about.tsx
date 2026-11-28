import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { FieldBack, HORIZON_GUTTER, HorizonScreen } from '@/components/horizon/horizon-screen';
import { RuledRow, SectionLabel } from '@/components/horizon/ruled';
import { Text } from '@/components/ui';
import { COMPANY_ADDRESS, COMPANY_NAME } from '@/lib/contact';
import { useTheme } from '@/theme';
import { horizonColors } from '@/theme/horizon';

const ABOUT_FIELD = 176;

/** Which app this is, which version, and who provides it. */
export default function AboutScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const colors = horizonColors(theme.colors);
  const router = useRouter();
  const version = Constants.expoConfig?.version;

  return (
    <HorizonScreen
      field={ABOUT_FIELD}
      small
      lines={[{ text: t('common.appName') }]}
      sub={version ? t('support.version', { version }) : undefined}
      top={<FieldBack colors={colors} />}
      bridge={null}>
      <SectionLabel>{t('support.providedBy')}</SectionLabel>
      <View style={{ paddingHorizontal: HORIZON_GUTTER, gap: 4 }}>
        <Text variant="body" weight="semibold">
          {COMPANY_NAME}
        </Text>
        <Text variant="callout" color="mutedForeground">
          {COMPANY_ADDRESS}
        </Text>
      </View>

      <SectionLabel>{t('support.aboutSection')}</SectionLabel>
      <RuledRow title={t('settings.privacyPolicy')} onPress={() => router.push('/privacy-policy')} />
      <RuledRow title={t('settings.termsOfService')} onPress={() => router.push('/terms-of-service')} />
      <RuledRow title={t('support.helpTitle')} onPress={() => router.push('/help')} />
    </HorizonScreen>
  );
}
