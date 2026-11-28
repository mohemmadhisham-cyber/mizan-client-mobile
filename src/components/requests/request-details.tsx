import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Card, Text } from '@/components/ui';
import { localeTag } from '@/lib/format';
import type { AccountantRequest, BudgetDetail, RequestChange } from '@/services/accountant-requests';
import { spacing, useTheme } from '@/theme';

import { requestMoney } from './request-text';

const QUARTER_CHART_HEIGHT = 74;

/**
 * Everything the owner is asked to approve, exactly as the server sent it. A
 * budget gets its summary, revenue by quarter and the accountant's message;
 * every other kind (known or new) is a list of its change rows.
 */
export function RequestDetails({ request }: { request: AccountantRequest }) {
  if (request.budget) return <BudgetDetails request={request} budget={request.budget} />;
  return <ChangeList request={request} />;
}

function Row({ label, value, sub, strong = false }: { label: string; value: string; sub?: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md }}>
      <Text variant="callout" weight={strong ? 'semibold' : 'regular'} style={{ flex: 1 }}>
        {label}
      </Text>
      <View style={{ alignItems: 'flex-end' }}>
        <Text variant="callout" weight={strong ? 'semibold' : 'regular'} tabular>
          {value}
        </Text>
        {sub ? (
          <Text variant="footnote" color="mutedForeground" tabular>
            {sub}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function BudgetDetails({ request, budget }: { request: AccountantRequest; budget: BudgetDetail }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { summary, previous } = budget;
  const money = (minor: number) => requestMoney(request, minor);
  // Last year's figure sits under this year's, only when the server sent one.
  const before = (minor: number | undefined) =>
    previous && minor !== undefined ? t('requests.previousYear', { year: budget.fiscalYear - 1, amount: money(minor) }) : undefined;

  return (
    <>
      <Card style={{ gap: spacing.md }}>
        <Row label={t('requests.revenue')} value={money(summary.revenueMinor)} sub={before(previous?.revenueMinor)} />
        <Row label={t('requests.costOfSales')} value={money(summary.cogsMinor)} sub={before(previous?.cogsMinor)} />
        <Row label={t('requests.runningCosts')} value={money(summary.opexMinor)} sub={before(previous?.opexMinor)} />
        {summary.outsidePnlMinor > 0 ? <Row label={t('requests.otherLines')} value={money(summary.outsidePnlMinor)} /> : null}
        <View style={{ borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: spacing.md }}>
          <Row label={t('requests.netProfit')} value={money(summary.netProfitMinor)} sub={before(previous?.netProfitMinor)} strong />
        </View>
      </Card>

      {summary.quarters.length > 0 ? <QuarterBars request={request} quarters={summary.quarters.map((q) => q.revenueMinor)} /> : null}

      {budget.message ? (
        <Card style={{ gap: spacing.xs }}>
          <Text variant="footnote" color="mutedForeground">
            {t('requests.message')}
          </Text>
          <Text variant="body">{budget.message}</Text>
        </Card>
      ) : null}
    </>
  );
}

/** Revenue by quarter. Bar heights share one scale; the figures themselves are read out for screen readers. */
function QuarterBars({ request, quarters }: { request: AccountantRequest; quarters: number[] }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const max = quarters.reduce((highest, q) => Math.max(highest, q), 0);
  const spoken = quarters.map((q, i) => `${t('requests.quarter', { n: i + 1 })} ${requestMoney(request, q)}`).join(', ');

  return (
    <Card style={{ gap: spacing.sm }}>
      <Text variant="footnote" color="mutedForeground">
        {t('requests.revenueByQuarter')}
      </Text>
      <View accessible accessibilityRole="image" accessibilityLabel={`${t('requests.revenueByQuarter')}: ${spoken}`}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: spacing.sm,
            height: QUARTER_CHART_HEIGHT,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
          }}>
          {quarters.map((q, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: max > 0 ? Math.max(2, (Math.max(q, 0) / max) * QUARTER_CHART_HEIGHT) : 2,
                backgroundColor: theme.colors.primary,
                borderTopLeftRadius: 3,
                borderTopRightRadius: 3,
              }}
            />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
          {quarters.map((_, i) => (
            <Text key={i} variant="caption" color="mutedForeground" center style={{ flex: 1 }}>
              {t('requests.quarter', { n: i + 1 })}
            </Text>
          ))}
        </View>
      </View>
    </Card>
  );
}

function formatRowDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(localeTag(), { day: 'numeric', month: 'short', year: 'numeric' });
}

/** The value shown for one change row: a price move, an amount, or nothing when the row has no figure. */
function changeValue(request: AccountantRequest, change: RequestChange, priceChange: (from: string, to: string) => string): string {
  if (typeof change.from === 'number' && typeof change.to === 'number') {
    return priceChange(requestMoney(request, change.from), requestMoney(request, change.to));
  }
  if (typeof change.amountMinor === 'number') return requestMoney(request, change.amountMinor);
  if (typeof change.to === 'number') return requestMoney(request, change.to);
  return '';
}

function ChangeList({ request }: { request: AccountantRequest }) {
  const { t } = useTranslation();
  const theme = useTheme();
  if (request.changes.length === 0) return null;

  return (
    <Card padded={false} style={{ overflow: 'hidden' }}>
      {request.changes.map((change, i) => (
        <View
          key={`${i}-${change.label}`}
          style={{
            padding: spacing.base,
            borderTopWidth: i === 0 ? 0 : 1,
            borderTopColor: theme.colors.border,
          }}>
          <Row
            label={change.label}
            value={changeValue(request, change, (from, to) => t('requests.priceChange', { from, to }))}
            sub={change.date ? formatRowDate(change.date) : undefined}
          />
        </View>
      ))}
    </Card>
  );
}
