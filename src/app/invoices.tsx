import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { FieldBack, HORIZON_GUTTER, HorizonScreen } from '@/components/horizon/horizon-screen';
import { Figure, RuledRow } from '@/components/horizon/ruled';
import { Text } from '@/components/ui';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useAuth } from '@/lib/auth-context';
import { formatDate, formatMinorUnits } from '@/lib/format';
import { clearDashboardCache } from '@/services/client-data';
import { type CustomerInvoice, getFigureDetail } from '@/services/figure-detail';
import { useTheme } from '@/theme';
import { horizonColors } from '@/theme/horizon';

const INVOICES_FIELD = 176;
const NOTE_SPACE = 14;
/** A date-only value is formatted in UTC, so it never shows as the day before in another time zone. */
const DAY = { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' } as const;

const STATUS_KEY: Record<CustomerInvoice['status'], string> = {
  paid: 'invoicesScreen.statusPaid',
  open: 'invoicesScreen.statusOpen',
  overdue: 'invoicesScreen.statusOverdue',
};

const day = (value: string) => formatDate(`${value}T00:00:00Z`, DAY);

/**
 * The newest invoices this business sent its customers, with whether each is
 * paid. Read from the client's own books. The server sends the latest few
 * only, and the screen says so.
 */
export default function InvoicesScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const colors = horizonColors(theme.colors);
  const { firmId } = useAuth();

  const detail = useQuery({ queryKey: ['figure-detail', firmId ?? 'none'], queryFn: getFigureDetail });
  const { refreshing, onRefresh } = usePullToRefresh(() => {
    clearDashboardCache();
    return detail.refetch();
  });
  const d = detail.data;

  return (
    <HorizonScreen
      field={INVOICES_FIELD}
      small
      lines={[{ text: t('invoicesScreen.title') }]}
      sub={t('invoicesScreen.sub')}
      top={<FieldBack colors={colors} />}
      // A record to read: chasing a late payer is the business's own to do, outside the app.
      bridge={null}
      refreshing={refreshing}
      onRefresh={onRefresh}>
      {detail.isError && !d ? (
        <RuledRow title={t('common.listLoadFailed')} action={t('common.retry')} onPress={onRefresh} />
      ) : !d ? (
        <RuledRow title={t('common.loading')} />
      ) : d.invoices.length === 0 ? (
        <RuledRow title={t('invoicesScreen.empty')} plain />
      ) : (
        <>
          {d.invoices.map((invoice) => (
            <RuledRow
              key={invoice.id}
              title={invoice.customer || invoice.number}
              // The status is a word in the line. An overdue invoice is the one in colour.
              meta={[
                invoice.number,
                day(invoice.date),
                invoice.status === 'paid'
                  ? t(STATUS_KEY.paid)
                  : t('invoicesScreen.statusWithDue', { status: t(STATUS_KEY[invoice.status]), date: day(invoice.due) }),
              ]
                .filter(Boolean)
                .join(' · ')}
              alert={invoice.status === 'overdue'}
              end={<Figure>{formatMinorUnits(invoice.amountMinor, d.currency, 2, true)}</Figure>}
            />
          ))}
          <View style={{ paddingHorizontal: HORIZON_GUTTER, paddingTop: NOTE_SPACE }}>
            <Text variant="footnote" color="mutedForeground">
              {t('invoicesScreen.latestOnly', { count: d.invoices.length })}
            </Text>
          </View>
        </>
      )}
    </HorizonScreen>
  );
}
