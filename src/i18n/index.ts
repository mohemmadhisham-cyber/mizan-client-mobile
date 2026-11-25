import { reloadAppAsync } from 'expo';
import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager } from 'react-native';

import { readDevicePref, writeDevicePref } from '@/lib/device-prefs';

import ar from './ar.json';
import en from './en.json';

export const SUPPORTED_LOCALES = ['en', 'ar'] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

const LOCALE_STORAGE_KEY = 'app_locale';

function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

function resolveDeviceLocale(): AppLocale {
  const code = Localization.getLocales()[0]?.languageCode ?? 'en';
  return code === 'ar' ? 'ar' : 'en';
}

/** The language chosen in Settings, if any; otherwise the device language. */
function resolveInitialLocale(): AppLocale {
  const stored = readDevicePref(LOCALE_STORAGE_KEY);
  return isAppLocale(stored) ? stored : resolveDeviceLocale();
}

export function isRtlLocale(locale: string): boolean {
  return locale === 'ar';
}

/** The app language right now. */
export function currentLocale(): AppLocale {
  return isAppLocale(i18n.language) ? i18n.language : 'en';
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

/**
 * Switches the app language, remembers it on this device, and reloads the app
 * when the layout direction has to flip (English ↔ Arabic), so the person never
 * has to close and reopen it.
 *
 * Returns false when the switch could not be completed, so the caller can tell
 * the person. The choice is saved first: if saving fails nothing else happens,
 * because a reload would only bring back the old language and flip the layout
 * twice.
 */
export async function setAppLocale(locale: AppLocale): Promise<boolean> {
  if (locale === i18n.language) return true;
  try {
    const saved = await writeDevicePref(LOCALE_STORAGE_KEY, locale);
    if (!saved) return false;
    // eslint-disable-next-line import/no-named-as-default-member -- called on the instance, as .use() is below
    await i18n.changeLanguage(locale);
    const directionChanged = applyLayoutDirection(locale);
    if (directionChanged && process.env.EXPO_OS !== 'web') {
      await reloadAppAsync('Language changed');
    }
    return true;
  } catch {
    return false;
  }
}

const initialLocale = resolveInitialLocale();

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
