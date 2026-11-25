/**
 * Runs before every test file. Stands in for the parts of the phone a test
 * cannot have: the safe area, haptics, and the translator. Animation runs in
 * plain JavaScript through the resolver named in package.json.
 */

jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

// The translator answers with the key it was asked for (and its values), so a
// test names the copy by its key and does not break when the wording changes.
jest.mock('react-i18next', () => {
  const t = (key: string, values?: Record<string, unknown>) => (values ? `${key} ${JSON.stringify(values)}` : key);
  const translation = { t, i18n: { language: 'en' } };
  return { useTranslation: () => translation };
});
