import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { useIsOffline } from '@/lib/online';
import { useTheme } from '@/theme';

/** The frame's gutter (HORIZON_GUTTER). Kept here so this file does not import the frame that imports it. */
const HORIZON_GUTTER = 24;
const NOTE_PADDING = 10;

/**
 * One quiet line at the top of the ground while the phone has no connection:
 * what is on screen may be old, and the person should know. It is part of
 * the frame, so every screen says it the same way. Nothing when online.
 */
export function OfflineNote() {
  const { t } = useTranslation();
  const theme = useTheme();
  const offline = useIsOffline();
  if (!offline) return null;
  return (
    <View
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.note, { borderBottomColor: theme.colors.border, backgroundColor: theme.colors.secondary }]}>
      <Text variant="footnote" weight="semibold">
        {t('support.offline')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    paddingHorizontal: HORIZON_GUTTER,
    paddingVertical: NOTE_PADDING,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
