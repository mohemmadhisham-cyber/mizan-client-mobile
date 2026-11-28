import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert, Linking } from 'react-native';

import { FieldBack, HorizonScreen } from '@/components/horizon/horizon-screen';
import { RuledRow, SectionLabel } from '@/components/horizon/ruled';
import { SUPPORT_EMAIL, supportMailto } from '@/lib/contact';
import { useTheme } from '@/theme';
import { horizonColors } from '@/theme/horizon';

const HELP_FIELD = 176;

/**
 * Where to turn: the accountant for anything about the books, Mizan for a
 * problem with the app itself. Also the way to the policies and to About.
 */
export default function HelpScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const colors = horizonColors(theme.colors);
  const router = useRouter();

  async function emailSupport() {
    try {
      await Linking.openURL(supportMailto(t('support.emailSubject')));
    } catch {
      // No mail app on this phone: show the address so it can be copied down.
      Alert.alert(t('support.emailUs'), SUPPORT_EMAIL);
    }
  }

  return (
    <HorizonScreen
      field={HELP_FIELD}
      small
      lines={[{ text: t('support.helpTitle') }]}
      sub={t('support.helpSub')}
      top={<FieldBack colors={colors} />}
      bridge={null}>
      <SectionLabel>{t('support.askSection')}</SectionLabel>
      <RuledRow title={t('support.askAccountant')} meta={t('support.askAccountantMeta')} onPress={() => router.push('/messages')} />
      <RuledRow title={t('support.emailUs')} meta={t('support.emailUsMeta', { email: SUPPORT_EMAIL })} onPress={() => void emailSupport()} />

      <SectionLabel>{t('support.aboutSection')}</SectionLabel>
      <RuledRow title={t('settings.privacyPolicy')} onPress={() => router.push('/privacy-policy')} />
      <RuledRow title={t('settings.termsOfService')} onPress={() => router.push('/terms-of-service')} />
      <RuledRow title={t('support.aboutApp')} onPress={() => router.push('/about')} />
    </HorizonScreen>
  );
}
