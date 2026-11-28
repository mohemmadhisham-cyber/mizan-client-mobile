import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { HORIZON_GUTTER } from '@/components/horizon/horizon-screen';
import { Figure } from '@/components/horizon/ruled';
import { Text } from '@/components/ui';
import type { PlanTarget } from '@/services/month-plan';
import { useTheme } from '@/theme';

import { needsAttention, progressLabel, progressLine, progressShare, statusLabel, targetTitle } from './plan-text';

interface ProgressLineProps {
  /** Share of the line to fill, 0 to 1. */
  share: number;
  alert: boolean;
  height?: number;
}

/** How far a target has come, as a line. The line fills from the leading edge in both languages. */
export function ProgressLine({ share, alert, height = 2 }: ProgressLineProps) {
  const theme = useTheme();
  return (
    <View style={{ height, backgroundColor: theme.colors.border, flexDirection: 'row' }}>
      <View style={{ width: `${Math.round(share * 100)}%`, backgroundColor: alert ? theme.colors.danger : theme.colors.foreground }} />
    </View>
  );
}

/** One agreed target on Home: its name, how far it has come, and where it stands. */
export function PlanRow({ target, onPress }: { target: PlanTarget; onPress: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const alert = needsAttention(target.status);
  const title = targetTitle(target);
  const line = progressLine(target, t);
  const status = statusLabel(target.status, t);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${line}. ${status}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { borderBottomColor: theme.colors.border, opacity: pressed ? 0.6 : 1 }]}>
      <View style={styles.body}>
        <Text variant="body" weight="semibold">
          {title}
        </Text>
        <ProgressLine share={progressShare(target)} alert={alert} />
        <Text variant="subhead" weight="regular" color={alert ? 'danger' : 'mutedForeground'}>
          {line} · {status}
        </Text>
      </View>
      <Figure size={15} style={{ fontFamily: theme.fonts.mono.medium, color: alert ? theme.colors.danger : theme.colors.foreground }}>
        {progressLabel(target)}
      </Figure>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: HORIZON_GUTTER,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  body: {
    flex: 1,
    gap: 7,
  },
});
