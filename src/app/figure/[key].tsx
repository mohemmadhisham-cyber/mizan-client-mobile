import { useQuery } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import type { HeadlineLine } from '@/components/horizon/headline';
import { FieldBack, HORIZON_GUTTER, HorizonScreen } from '@/components/horizon/horizon-screen';
import { Figure, RuledRow, SectionLabel } from '@/components/horizon/ruled';
import { Text } from '@/components/ui';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useAuth } from '@/lib/auth-context';
import { formatDate, formatMinorUnits, formatMoneyMinor } from '@/lib/format';
import { clearDashboardCache, clientDataService } from '@/services/client-data';
import { type FigureDetail, getFigureDetail } from '@/services/figure-detail';
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

  // The same query as Home, so the figure in the field is the one that was tapped.
  const kpis = useQuery({ queryKey: ['kpis', companyKey], queryFn: clientDataService.getKpis });
  const detail = useQuery({ queryKey: ['figure-detail', companyKey], queryFn: getFigureDetail });
  const { refreshing, onRefresh } = usePullToRefresh(() => {
    clearDashboardCache();
    return Promise.all([kpis.refetch(), detail.refetch()]);
  });

  // The key comes from a link: anything but the four figures goes Home.
  if (!isFigureKey(key)) return <Redirect href="/" />;

  const k = kpis.data;
  const d = detail.data;
  const currency = k?.currency ?? 'AED';
  const amount = k ? { in: k.moneyIn, out: k.moneyOut, cash: k.cash, vat: k.vatDue }[key] : null;

  const lines: HeadlineLine[] = [
    { text: t(LABEL_KEY[key]), soft: true },
    { text: amount === null ? '—' : formatMoneyMinor(amount, currency), figure: true },
  ];

  return (
    <HorizonScreen
      field={FIGURE_FIELD}
      small
      lines={lines}
      sub={t(`figures.${key}Sub`)}
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
          {key === 'out' ? <Months detail={d} pick="moneyOut" /> : null}
          {key === 'cash' ? <Cash detail={d} /> : null}
          {key === 'vat' ? <Vat dueDate={k?.vatDueDate} /> : null}
          {d.unreadable > 0 ? (
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
