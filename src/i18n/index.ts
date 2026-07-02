import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager } from 'react-native';

import ar from './ar.json';
import en from './en.json';

export const SUPPORTED_LOCALES = ['en', 'ar'] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

function resolveDeviceLocale(): AppLocale {
  const code = Localization.getLocales()[0]?.languageCode ?? 'en';
  return code === 'ar' ? 'ar' : 'en';
}

export function isRtlLocale(locale: string): boolean {
  return locale === 'ar';
}

/**
 * Align native layout direction with the locale. Forcing RTL on native only
 * fully applies after an app reload, so this returns true when the direction
 * changed and the caller should reload (handled in the language settings flow).
 */
export function applyLayoutDirection(locale: AppLocale): boolean {
  const shouldRtl = isRtlLocale(locale);
  I18nManager.allowRTL(shouldRtl);
  if (I18nManager.isRTL !== shouldRtl) {
    I18nManager.forceRTL(shouldRtl);
    return true;
  }
  return false;
}

const initialLocale = resolveDeviceLocale();

// eslint-disable-next-line import/no-named-as-default-member -- i18next's default export exposes .use()
i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ar: { translation: ar },
  },
  lng: initialLocale,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

applyLayoutDirection(initialLocale);

export default i18n;
