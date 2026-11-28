import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Card, Input, Text } from '@/components/ui';
import { DECLINE_REASON_MAX, type AccountantRequest } from '@/services/accountant-requests';
import { spacing, useTheme } from '@/theme';

import { requestMoney } from './request-text';

const TICK = 22;
const PRESSED_OPACITY = 0.6;
const REASON_TEXT_SIZE = 15;

interface PriceLinesProps {
  request: AccountantRequest;
  chosen: ReadonlySet<number>;
  reasons: Record<string, string>;
  onToggle: (id: number) => void;
  onReason: (id: number, reason: string) => void;
  disabled?: boolean;
}

/**
 * The price changes of one request, each approved or kept. Every line starts
 * approved. A kept line can carry a short reason for the accountant. Only the
 * figures the server sent are shown; nothing is worked out here.
 */
export function PriceLines({ request, chosen, reasons, onToggle, onReason, disabled = false }: PriceLinesProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const kept = request.changes.length - chosen.size;

  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="footnote" color="mutedForeground">
        {t('requests.linesHint')}
      </Text>
      <Card padded={false} style={{ overflow: 'hidden' }}>
        {request.changes.map((change, i) => {
          const id = change.id as number;
          const on = chosen.has(id);
          const prices = t('requests.priceChange', {
            // canChooseLines lets only lines with both prices reach here.
            from: requestMoney(request, change.from as number),
            to: requestMoney(request, change.to as number),
          });
          return (
            <View
              key={id}
              style={{ padding: spacing.base, gap: spacing.sm, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: theme.colors.border }}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on, disabled }}
                accessibilityLabel={`${change.label}. ${prices}`}
                accessibilityHint={t(on ? 'requests.lineKeepHint' : 'requests.lineApproveHint')}
                disabled={disabled}
                onPress={() => onToggle(id)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: spacing.md,
                  opacity: pressed ? PRESSED_OPACITY : 1,
                })}>
                <Ionicons
                  name={on ? 'checkbox' : 'square-outline'}
                  size={TICK}
                  color={on ? theme.colors.primary : theme.colors.mutedForeground}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="callout" weight={on ? 'semibold' : 'regular'}>
                    {change.label}
                  </Text>
                  <Text variant="footnote" color="mutedForeground">
                    {on ? t('requests.lineApproved') : t('requests.lineKept')}
                  </Text>
                </View>
                <Text variant="callout" tabular color={on ? 'foreground' : 'mutedForeground'}>
                  {prices}
                </Text>
              </Pressable>
              {on ? null : (
                <Input
                  variant="underline"
                  style={{ backgroundColor: 'transparent', paddingHorizontal: 0, fontSize: REASON_TEXT_SIZE }}
                  accessibilityLabel={t('requests.keptReasonLabel', { item: change.label })}
                  placeholder={t('requests.keptReasonPlaceholder')}
                  value={reasons[String(id)] ?? ''}
                  onChangeText={(value) => onReason(id, value)}
                  maxLength={DECLINE_REASON_MAX}
                  editable={!disabled}
                />
              )}
            </View>
          );
        })}
      </Card>
      {kept > 0 ? (
        <Text variant="footnote" color="mutedForeground" accessibilityLiveRegion="polite">
          {chosen.size === 0
            ? t('requests.linesNoneChosen')
            : t('requests.linesChosen', { approved: chosen.size, of: request.changes.length })}
        </Text>
      ) : null}
    </View>
  );
}
