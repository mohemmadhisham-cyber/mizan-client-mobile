import { Ionicons } from '@expo/vector-icons';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { I18nManager, Pressable, StyleSheet, Text as RNText, type TextStyle, View } from 'react-native';

import { Text } from '@/components/ui';
import { chevronForward } from '@/lib/direction';
import { useTheme } from '@/theme';

import { HORIZON_GUTTER } from './horizon-screen';

const ROW_PADDING = 16;
const PRESSED_OPACITY = 0.6;

/** A quiet label that opens a group of rows on the ground. */
export function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      accessibilityRole="header"
      variant="subhead"
      weight="semibold"
      color="mutedForeground"
      style={{ paddingHorizontal: HORIZON_GUTTER, paddingTop: 22, paddingBottom: 8 }}>
      {children}
    </Text>
  );
}

interface FigureProps {
  children: string;
  size?: number;
  style?: TextStyle;
}

/** A figure (an amount, a date, a code), set in the mono face so columns line up. */
export function Figure({ children, size = 15, style }: FigureProps) {
  const theme = useTheme();
  return (
    <RNText
      style={[
        {
          fontFamily: theme.fonts.mono.regular,
          fontSize: size,
          lineHeight: Math.round(size * 1.3),
          letterSpacing: -size * 0.03,
          color: theme.colors.foreground,
          fontVariant: ['tabular-nums'],
          // Figures read left to right in both languages.
          writingDirection: 'ltr',
          textAlign: I18nManager.isRTL ? 'right' : 'left',
        },
        style,
      ]}>
      {children}
    </RNText>
  );
}

interface RuledRowProps {
  title: string;
  /** A second, quieter line. */
  meta?: string;
  /** A word for what tapping does, shown with an arrow ("Upload", "Review"). */
  action?: string;
  /** Anything else to show at the end of the row, such as an amount. */
  end?: ReactNode;
  onPress?: () => void;
  /** The meta line is a warning (overdue, late). */
  alert?: boolean;
  /** A sentence to read, not a thing to open: the title is set at reading weight. */
  plain?: boolean;
}

/** One line of the ground: a title, a quieter line under it, a rule below. No card. */
export function RuledRow({ title, meta, action, end, onPress, alert = false, plain = false }: RuledRowProps) {
  const theme = useTheme();
  const body = (
    <>
      <View style={styles.rowText}>
        <Text variant="body" weight={plain ? 'regular' : 'semibold'}>
          {title}
        </Text>
        {meta ? (
          <Text variant="subhead" weight="regular" color={alert ? 'danger' : 'mutedForeground'}>
            {meta}
          </Text>
        ) : null}
      </View>
      {end}
      {onPress ? (
        <View style={styles.rowAction}>
          {action ? (
            <Text variant="subhead" weight="bold">
              {action}
            </Text>
          ) : null}
          <Ionicons name={chevronForward()} size={16} color={theme.colors.foreground} />
        </View>
      ) : null}
    </>
  );
  const frame = [styles.row, { borderBottomColor: theme.colors.border }];

  if (!onPress) return <View style={frame}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, meta, action].filter(Boolean).join('. ')}
      onPress={onPress}
      style={({ pressed }) => [frame, { opacity: pressed ? PRESSED_OPACITY : 1 }]}>
      {body}
    </Pressable>
  );
}

export interface LedgerCell {
  key: string;
  label: string;
  /** Already formatted. `null` while it is loading. */
  value: string | null;
  note?: string;
  onPress?: () => void;
}

/** Figures two to a line, separated by rules, like a ledger. Not cards. */
export function Ledger({ cells }: { cells: LedgerCell[] }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const rule = theme.colors.border;
  return (
    <View style={[styles.ledger, { borderBottomColor: rule }]}>
      {cells.map((cell, index) => {
        const leading = index % 2 === 0;
        // A last cell with no partner takes the whole line, with no rule down its side.
        const alone = leading && index === cells.length - 1;
        const frame = [
          styles.cell,
          { borderTopColor: rule, borderTopWidth: index < 2 ? 0 : StyleSheet.hairlineWidth },
          alone
            ? { width: '100%' as const }
            : leading
              ? { borderEndColor: rule, borderEndWidth: StyleSheet.hairlineWidth, paddingEnd: ROW_PADDING }
              : { paddingStart: ROW_PADDING },
        ];
        const body = (
          <>
            <Text variant="footnote" weight="semibold" color="mutedForeground">
              {cell.label}
            </Text>
            <Figure size={20}>{cell.value ?? '—'}</Figure>
            {cell.note ? (
              <Text variant="footnote" color="mutedForeground">
                {cell.note}
              </Text>
            ) : null}
          </>
        );
        const spoken = [cell.label, cell.value ?? t('common.loading'), cell.note].filter(Boolean).join('. ');
        if (!cell.onPress) {
          return (
            <View key={cell.key} accessible accessibilityLabel={spoken} style={frame}>
              {body}
            </View>
          );
        }
        return (
          <Pressable
            key={cell.key}
            accessibilityRole="button"
            accessibilityLabel={spoken}
            onPress={cell.onPress}
            style={({ pressed }) => [frame, { opacity: pressed ? PRESSED_OPACITY : 1 }]}>
            {body}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: HORIZON_GUTTER,
    paddingVertical: ROW_PADDING,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ledger: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: HORIZON_GUTTER,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cell: {
    width: '50%',
    paddingVertical: 15,
    gap: 3,
  },
});
