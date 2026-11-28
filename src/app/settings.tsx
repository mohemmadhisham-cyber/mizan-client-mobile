import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Cta } from '@/components/horizon/cta';
import { FieldBack, HORIZON_GUTTER, HorizonScreen } from '@/components/horizon/horizon-screen';
import { ChoiceRow, RuledRow, SectionLabel } from '@/components/horizon/ruled';
import i18n, { setAppLocale, type AppLocale } from '@/i18n';
import { hasAiConsent, setAiConsent } from '@/lib/ai-consent';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useTheme, useThemeControls, type ThemeMode } from '@/theme';
import { horizonColors } from '@/theme/horizon';

const SETTINGS_FIELD = 176;
const SIGN_OUT_SPACE_ABOVE = 28;

const LANGUAGES: { code: AppLocale; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' },
];

const MODES: { key: ThemeMode; labelKey: string }[] = [
  { key: 'system', labelKey: 'settings.modeSystem' },
  { key: 'light', labelKey: 'settings.modeLight' },
  { key: 'dark', labelKey: 'settings.modeDark' },
];

export default function SettingsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const colors = horizonColors(theme.colors);
  const router = useRouter();
  const { mode, setMode } = useThemeControls();
  const { user, signOut } = useAuth();
  const userId = user?.id;
  const [aiConsented, setAiConsented] = useState(() => hasAiConsent(userId));

  // Read again on return: the agreement may have been given on another screen
  // while this one stayed open underneath.
  useFocusEffect(
    useCallback(() => {
      setAiConsented(hasAiConsent(userId));
    }, [userId]),
  );

  function withdrawAiConsent() {
    if (!userId) return;
    Alert.alert(t('support.aiWithdraw'), t('support.aiWithdrawBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('support.aiWithdrawYes'),
        style: 'destructive',
        onPress: () => {
          void setAiConsent(userId, false).then((saved) => {
            if (saved) setAiConsented(false);
            else Alert.alert(t('support.aiWithdraw'), t('support.aiSaveFailed'));
          });
        },
      },
    ]);
  }

  function changeLanguage(code: AppLocale) {
    // Saves the choice and reloads the app when the layout direction flips.
    void setAppLocale(code).then((switched) => {
      if (!switched) Alert.alert(t('settings.languageFailedTitle'), t('settings.languageFailedBody'));
    });
  }

  // "Active sessions": the Supabase client can't enumerate other devices
  // (that's an admin-only API), but it CAN revoke every session for this user.
  // So this is a real security control — sign out everywhere.
  function handleActiveSessions() {
    Alert.alert(
      t('settings.activeSessions'),
      t('settings.activeSessionsBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.signOutEverywhere'),
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.auth.signOut({ scope: 'global' });
            if (error) Alert.alert(t('settings.couldNotSignOut'), error.message);
          },
        },
      ],
    );
  }

  return (
    <HorizonScreen
      field={SETTINGS_FIELD}
      small
      lines={[{ text: t('settings.title') }]}
      sub={user?.email ?? t('settings.signedIn')}
      subLines={1}
      top={<FieldBack colors={colors} />}
      // Nothing on this screen is waiting for the person.
      bridge={null}>
      <SectionLabel>{t('settings.language')}</SectionLabel>
      <View accessibilityRole="radiogroup" accessibilityLabel={t('settings.language')}>
        {LANGUAGES.map((language) => (
          <ChoiceRow
            key={language.code}
            title={language.label}
            selected={i18n.language === language.code}
            onPress={() => changeLanguage(language.code)}
          />
        ))}
      </View>

      <SectionLabel>{t('settings.appearance')}</SectionLabel>
      <View accessibilityRole="radiogroup" accessibilityLabel={t('settings.appearance')}>
        {MODES.map((option) => (
          <ChoiceRow
            key={option.key}
            title={t(option.labelKey)}
            selected={mode === option.key}
            onPress={() => setMode(option.key)}
          />
        ))}
      </View>

      <SectionLabel>{t('settings.security')}</SectionLabel>
      <RuledRow title={t('settings.backupCodes')} onPress={() => router.push('/backup-codes')} />
      <RuledRow title={t('settings.activeSessions')} onPress={handleActiveSessions} />

      <SectionLabel>{t('settings.about')}</SectionLabel>
      <RuledRow title={t('settings.privacyPolicy')} onPress={() => router.push('/privacy-policy')} />
      <RuledRow title={t('settings.termsOfService')} onPress={() => router.push('/terms-of-service')} />

      <SectionLabel>{t('support.helpAndPrivacy')}</SectionLabel>
      <RuledRow title={t('support.helpTitle')} onPress={() => router.push('/help')} />
      <RuledRow title={t('support.aboutApp')} onPress={() => router.push('/about')} />
      {aiConsented ? <RuledRow title={t('support.aiWithdraw')} onPress={withdrawAiConsent} /> : null}
      <RuledRow title={t('support.deleteEntry')} onPress={() => router.push('/delete-account')} />

      <View style={{ paddingHorizontal: HORIZON_GUTTER, paddingTop: SIGN_OUT_SPACE_ABOVE }}>
        <Cta kind="outline" title={t('auth.signOut')} onPress={() => void signOut()} />
      </View>
    </HorizonScreen>
  );
}
