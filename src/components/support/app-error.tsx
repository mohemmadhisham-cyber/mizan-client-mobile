import { Pressable, StyleSheet, Text, View } from 'react-native';

import i18n from '@/i18n';

interface AppErrorProps {
  error: Error;
  retry: () => void | Promise<void>;
}

// Fixed brand colours and the system typeface: this screen shows when
// something has already failed, possibly the theme or the fonts themselves, so
// it depends on neither.
const NIGHT = '#111816';
const IVORY = '#F5F3EE';
const SOFT = '#A9B6AF';

/** Words for this screen, with English as the fallback if the translations are what failed. */
function words(key: string, fallback: string): string {
  try {
    const value = i18n.t(key);
    return typeof value === 'string' && value !== key ? value : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Shown when a screen crashes, in place of a blank app. It says so plainly and
 * offers to try again. The technical message is never shown to the person: it
 * can contain internal detail, and it helps no one who is not a developer.
 */
export function AppError({ retry }: AppErrorProps) {
  return (
    <View style={styles.root} accessibilityRole="alert">
      <Text style={styles.title} accessibilityRole="header">
        {words('support.errorTitle', 'Something went wrong.')}
      </Text>
      <Text style={styles.body}>
        {words('support.errorBody', 'This screen could not be shown. Your data is safe. Try again, and if it keeps happening, close the app and open it again.')}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => void retry()}
        style={({ pressed }) => [styles.button, { opacity: pressed ? 0.85 : 1 }]}>
        <Text style={styles.buttonText}>{words('common.retry', 'Try again')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: NIGHT,
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 14,
  },
  title: {
    color: IVORY,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '500',
  },
  body: {
    color: SOFT,
    fontSize: 16,
    lineHeight: 24,
  },
  button: {
    marginTop: 14,
    height: 54,
    borderRadius: 10,
    backgroundColor: IVORY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: NIGHT,
    fontSize: 16,
    fontWeight: '700',
  },
});
