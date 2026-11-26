import { useQuery } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import type { HeadlineLine } from '@/components/horizon/headline';
import { FieldBack, HORIZON_GUTTER, HorizonScreen } from '@/components/horizon/horizon-screen';
import { Figure, RuledRow, SectionLabel } from '@/components/horizon/ruled';
import { WordTabs } from '@/components/horizon/word-tabs';
import { Text } from '@/components/ui';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useAuth } from '@/lib/auth-context';
import { formatDate, formatMinorUnits, formatMoneyMinor } from '@/lib/format';
import { clearDashboardCache, clientDataService } from '@/services/client-data';
import { type FigureDetail, getFigureDetail } from '@/services/figure-detail';
import {
  type CashView,
  getCashView,
  getPeriodView,
  PERIOD_KEYS,
  type PeriodKey,
  type PeriodView,
} from '@/services/figure-views';
import { useTheme } from '@/theme';
import { horizonColors } from '@/theme/horizon';

const FIGURE_FIELD = 200;
const NOTE_SPACE = 14;
/** A month is formatted in UTC, so it never shows as the month before in another time zone. */
const MONTH = { month: 'long', year: 'numeric', timeZone: 'UTC' } as const;
const DAY = { day: 'numeric', month: 'long', year: 'numeric' } as const;

const FIGURE_KEYS = ['in', 'out', 'cash', 'vat'] as const;
type FigureKey = (typeof FIGURE_KEYS)[number];

function isFigureKey(value: unknown): value is FigureKey {
  return typeof value === 'string' && (FIGURE_KEYS as readonly string[]).includes(value);
}

const LABEL_KEY: Record<FigureKey, string> = {
  in: 'home.moneyIn',
  out: 'home.moneyOut',
  cash: 'horizonHome.cash',
  vat: 'home.vatDue',
};

/**
 * What one Home figure is made of. Opened by tapping the figure. Every number
 * is the server's, read from the client's own books; this screen only lays
 * them out.
 */
export default function FigureScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const colors = horizonColors(theme.colors);
  const router = useRouter();
  const { firmId } = useAuth();
  const companyKey = firmId ?? 'none';
  const { key } = useLocalSearchParams<{ key: string }>();
  const [period, setPeriod] = useState<PeriodKey>('this_month');

  // The same query as Home, so the figure in the field is the one that was tapped.
  const kpis = useQuery({ queryKey: ['kpis', companyKey], queryFn: clientDataService.getKpis });
  const detail = useQuery({ queryKey: ['figure-detail', companyKey], queryFn: getFigureDetail });
  // Asked only on the screen that shows it. A server that does not know the view answers null.
  const periodView = useQuery({
    queryKey: ['figure-period', companyKey, period],
    queryFn: () => getPeriodView(period),
    enabled: key === 'out',
  });
  const cashView = useQuery({ queryKey: ['figure-cash', companyKey], queryFn: getCashView, enabled: key === 'cash' });
  const { refreshing, onRefresh } = usePullToRefresh(() => {
    clearDashboardCache();
    return Promise.all([
      kpis.refetch(),
      detail.refetch(),
      key === 'out' ? periodView.refetch() : null,
      key === 'cash' ? cashView.refetch() : null,
    ]);
  });

  // The key comes from a link: anything but the four figures goes Home.
  if (!isFigureKey(key)) return <Redirect href="/" />;

  const k = kpis.data;
  const d = detail.data;
  const currency = k?.currency ?? 'AED';
  // Money out for another period than this month is the period's own figure, once it has come.
  const ofPeriod = key === 'out' && period !== 'this_month';
  const amount = ofPeriod
    ? (periodView.data?.moneyOut ?? null)
    : k
      ? { in: k.moneyIn, out: k.moneyOut, cash: k.cash, vat: k.vatDue }[key]
      : null;

  const lines: HeadlineLine[] = [
    { text: t(LABEL_KEY[key]), soft: true },
    { text: amount === null ? '—' : formatMoneyMinor(amount, currency), figure: true },
  ];

  return (
    <HorizonScreen
      field={FIGURE_FIELD}
      small
      lines={lines}
      sub={key === 'out' ? t(`figures.outSubPeriod.${period}`) : t(`figures.${key}Sub`)}
      top={<FieldBack colors={colors} />}
      // Something to read: nothing here is waiting for the person.
      bridge={null}
      refreshing={refreshing}
      onRefresh={onRefresh}>
      {detail.isError && !d ? (
        <RuledRow title={t('common.listLoadFailed')} action={t('common.retry')} onPress={onRefresh} />
      ) : !d ? (
        <RuledRow title={t('common.loading')} />
      ) : (
        <>
          {key === 'in' ? <MoneyIn detail={d} onInvoices={() => router.push('/invoices')} /> : null}
          {key === 'out' ? (
            <>
              <MoneyOut
                period={period}
                onPeriod={setPeriod}
                view={periodView.data}
                failed={periodView.isError}
                onRetry={() => void periodView.refetch()}
              />
              <Months detail={d} pick="moneyOut" />
            </>
          ) : null}
          {key === 'cash' ? (
            <>
              <CashAccounts view={cashView.data} />
              <Cash detail={d} />
            </>
          ) : null}
          {key === 'vat' ? <Vat dueDate={k?.vatDueDate} /> : null}
          {d.unreadable > 0 || (key === 'cash' && (cashView.data?.unreadable ?? 0) > 0) ? (
            <View style={{ paddingHorizontal: HORIZON_GUTTER, paddingTop: NOTE_SPACE }}>
              <Text variant="footnote" color="mutedForeground">
                {t('figures.unreadable')}
              </Text>
            </View>
          ) : null}
        </>
      )}
    </HorizonScreen>
  );
}

/** The last months of one figure, newest first, as a ruled column. */
function Months({ detail, pick }: { detail: FigureDetail; pick: 'moneyIn' | 'moneyOut' }) {
  const { t } = useTranslation();
  if (detail.months.length === 0) return null;
  return (
    <>
      <SectionLabel>{t('figures.months')}</SectionLabel>
      {[...detail.months].reverse().map((month) => (
        <RuledRow
          key={month.month}
          title={formatDate(`${month.month}T00:00:00Z`, MONTH)}
          // This month is not over: its figure is not to be read against a whole month.
          meta={month.soFar ? t('figures.soFar') : undefined}
          plain
          end={<Figure>{formatMinorUnits(month[pick], detail.currency)}</Figure>}
        />
      ))}
    </>
  );
}

interface MoneyOutProps {
  period: PeriodKey;
  onPeriod: (period: PeriodKey) => void;
  /** Undefined while it is on its way. Null when the server does not offer it. */
  view: PeriodView | null | undefined;
  failed: boolean;
  onRetry: () => void;
}

/**
 * What money out is made of, for a chosen period: the largest costs by
 * account, and the rest together. Shown only by a server that sends it; with
 * an older one this draws nothing and the screen is as it was.
 */
function MoneyOut({ period, onPeriod, view, failed, onRetry }: MoneyOutProps) {
  const { t } = useTranslation();
  // Not offered. (Only ever answered for the first period asked: a server either knows the view or does not.)
  if (view === null) return null;
  return (
    <>
      <WordTabs
        accessibilityLabel={t('figures.periodLabel')}
        options={PERIOD_KEYS.map((key) => ({ key, label: t(`figures.period.${key}`) }))}
        value={period}
        onChange={onPeriod}
      />
      <SectionLabel>{t('figures.madeOf')}</SectionLabel>
      {failed && !view ? (
        <RuledRow title={t('common.listLoadFailed')} action={t('common.retry')} onPress={onRetry} />
      ) : !view || view.period !== period ? (
        <RuledRow title={t('common.loading')} />
      ) : view.groups === null ? (
        <RuledRow title={t('figures.tooMuchToBreakDown')} plain />
      ) : view.groups.length === 0 && view.otherMinor === 0 ? (
        <RuledRow title={t('figures.nothingInPeriod')} plain />
      ) : (
        <>
          {view.groups.map((group, index) => (
            <RuledRow
              // Two accounts can share a name, and the server sends no id: the place in the list is the key.
              key={index}
              title={group.name}
              plain
              end={<Figure>{formatMinorUnits(group.amountMinor, view.currency)}</Figure>}
            />
          ))}
          {view.otherMinor !== 0 ? (
            <RuledRow
              title={t('figures.everythingElse')}
              plain
              end={<Figure>{formatMinorUnits(view.otherMinor, view.currency)}</Figure>}
            />
          ) : null}
        </>
      )}
    </>
  );
}

function MoneyIn({ detail, onInvoices }: { detail: FigureDetail; onInvoices: () => void }) {
  const { t } = useTranslation();
  return (
    <>
      <Months detail={detail} pick="moneyIn" />
      {detail.topCustomers.length > 0 ? (
        <>
          <SectionLabel>{t('figures.topCustomers')}</SectionLabel>
          {detail.topCustomers.map((customer, index) => (
            <RuledRow
              // Two customers can share a name, and the server sends no id: the place in the list is the key.
              key={index}
              title={customer.name}
              plain
              end={<Figure>{formatMinorUnits(customer.amountMinor, detail.currency)}</Figure>}
            />
          ))}
          <View style={{ paddingHorizontal: HORIZON_GUTTER, paddingTop: NOTE_SPACE }}>
            <Text variant="footnote" color="mutedForeground">
              {t('figures.topCustomersNote')}
            </Text>
          </View>
        </>
      ) : null}
      <SectionLabel>{t('figures.invoicesSection')}</SectionLabel>
      <RuledRow title={t('invoicesScreen.title')} onPress={onInvoices} />
    </>
  );
}

/** Each cash and bank account and what is in it today. Draws nothing until a server that knows the view has answered. */
function CashAccounts({ view }: { view: CashView | null | undefined }) {
  const { t } = useTranslation();
  if (!view || view.accounts.length === 0) return null;
  return (
    <>
      <SectionLabel>{t('figures.cashAccounts')}</SectionLabel>
      {view.accounts.map((account, index) => (
        <RuledRow
          key={index}
          title={account.name}
          plain
          // An overdrawn account is the one to notice.
          alert={account.balanceMinor < 0}
          meta={account.balanceMinor < 0 ? t('figures.overdrawn') : undefined}
          end={<Figure>{formatMinorUnits(account.balanceMinor, view.currency)}</Figure>}
        />
      ))}
    </>
  );
}

function Cash({ detail }: { detail: FigureDetail }) {
  const { t } = useTranslation();
  const { receivableDays, payableDays } = detail;
  if (receivableDays === null && payableDays === null) {
    return <RuledRow title={t('figures.cashNothing')} plain />;
  }
  return (
    <>
      <SectionLabel>{t('figures.cashFlowSection')}</SectionLabel>
      {receivableDays !== null ? (
        <RuledRow title={t('figures.receivableDays', { count: receivableDays })} meta={t('figures.daysNote')} plain />
      ) : null}
      {payableDays !== null ? (
        <RuledRow title={t('figures.payableDays', { count: payableDays })} meta={t('figures.daysNote')} plain />
      ) : null}
    </>
  );
}

function Vat({ dueDate }: { dueDate: string | undefined }) {
  const { t } = useTranslation();
  const due = dueDate ? formatDate(dueDate, DAY) : '';
  return (
    <>
      {due ? <RuledRow title={t('figures.vatDueDate')} plain end={<Figure>{due}</Figure>} /> : null}
      <View style={{ paddingHorizontal: HORIZON_GUTTER, paddingTop: NOTE_SPACE }}>
        <Text variant="callout" color="mutedForeground">
          {t('figures.vatNote')}
        </Text>
      </View>
    </>
  );
}
