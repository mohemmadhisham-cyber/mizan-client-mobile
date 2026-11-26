import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
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
import { getInvoicePage, mergeInvoicePages } from '@/services/figure-views';
import { useTheme } from '@/theme';
import { horizonColors } from '@/theme/horizon';

const INVOICES_FIELD = 176;
const NOTE_SPACE = 14;
/** A date-only value is formatted in UTC, so it never shows as the day before in another time zone. */
const DAY = { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' } as const;

/** The words for an invoice not yet paid in full. Each takes the due date. */
const UNPAID_KEY: Record<Exclude<CustomerInvoice['status'], 'paid'>, string> = {
  open: 'invoicesScreen.statusOpenDue',
  partial: 'invoicesScreen.statusPartialDue',
  overdue: 'invoicesScreen.statusOverdueSince',
};

const day = (value: string) => formatDate(`${value}T00:00:00Z`, DAY);

/**
 * The invoices this business sent its customers, newest first, with whether
 * each is paid. Read from the client's own books.
 *
 * A server that sends them a page at a time is asked for more as the person
 * asks. An older server sends only the latest few with the dashboard; the
 * screen shows those and says so.
 */
export default function InvoicesScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const colors = horizonColors(theme.colors);
  const { firmId } = useAuth();
  const companyKey = firmId ?? 'none';

  const detail = useQuery({ queryKey: ['figure-detail', companyKey], queryFn: getFigureDetail });
  const pages = useInfiniteQuery({
    queryKey: ['invoice-pages', companyKey],
    queryFn: ({ pageParam }) => getInvoicePage(pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) => last?.nextOffset ?? undefined,
  });
  const { refreshing, onRefresh } = usePullToRefresh(() => {
    clearDashboardCache();
    return Promise.all([detail.refetch(), pages.refetch()]);
  });

  const first = pages.data?.pages[0] ?? null;
  const paged = first !== null;
  // The server does not send pages (it answered null), or the first page could not be had:
  // the latest few from the dashboard stand in, as before.
  const standIn = !paged && !pages.isPending;
  const d = detail.data;
  const waiting = pages.isPending || (standIn && !d && detail.isPending);
  const failed = standIn && !d && detail.isError;

  const invoices = paged ? mergeInvoicePages(pages.data?.pages ?? []) : (d?.invoices ?? []);
  const currency = first?.currency ?? d?.currency ?? 'AED';
  const unreadable = paged
    ? (pages.data?.pages ?? []).reduce((sum, page) => sum + (page?.unreadable ?? 0), 0)
    : (d?.unreadable ?? 0);

  return (
    <HorizonScreen
      field={INVOICES_FIELD}
      small
      lines={[{ text: t(paged ? 'invoicesScreen.titleAll' : 'invoicesScreen.title') }]}
      sub={t(paged ? 'invoicesScreen.subAll' : 'invoicesScreen.sub')}
      top={<FieldBack colors={colors} />}
      // A record to read: chasing a late payer is the business's own to do, outside the app.
      bridge={null}
      refreshing={refreshing}
      onRefresh={onRefresh}>
      {failed ? (
        <RuledRow title={t('common.listLoadFailed')} action={t('common.retry')} onPress={onRefresh} />
      ) : waiting ? (
        <RuledRow title={t('common.loading')} />
      ) : invoices.length === 0 ? (
        <RuledRow title={t('invoicesScreen.empty')} plain />
      ) : (
        <>
          {invoices.map((invoice) => (
            <InvoiceRow key={invoice.id} invoice={invoice} currency={currency} />
          ))}
          {paged && pages.isFetchNextPageError ? (
            <RuledRow title={t('common.listLoadFailed')} action={t('common.retry')} onPress={() => void pages.fetchNextPage()} />
          ) : paged && pages.isFetchingNextPage ? (
            <RuledRow title={t('common.loading')} />
          ) : paged && pages.hasNextPage ? (
            <RuledRow title={t('invoicesScreen.showMore')} onPress={() => void pages.fetchNextPage()} />
          ) : null}
          <View style={{ paddingHorizontal: HORIZON_GUTTER, paddingTop: NOTE_SPACE, gap: 6 }}>
            {paged ? null : (
              <Text variant="footnote" color="mutedForeground">
                {t('invoicesScreen.latestOnly', { count: invoices.length })}
              </Text>
            )}
            {unreadable > 0 ? (
              <Text variant="footnote" color="mutedForeground">
                {t('figures.unreadable')}
              </Text>
            ) : null}
          </View>
        </>
      )}
    </HorizonScreen>
  );
}

function InvoiceRow({ invoice, currency }: { invoice: CustomerInvoice; currency: string }) {
  const { t } = useTranslation();
  return (
    <RuledRow
      title={invoice.customer || invoice.number}
      // The status is a word in the line. An overdue invoice is the one in colour.
      meta={[
        invoice.number,
        day(invoice.date),
        invoice.status === 'paid'
          ? t('invoicesScreen.statusPaid')
          : t(UNPAID_KEY[invoice.status], { date: day(invoice.due) }),
        // Part of it has been paid: say how much is left, when the server says.
        invoice.status !== 'paid' && invoice.residualMinor !== null && invoice.residualMinor !== invoice.amountMinor
          ? t('invoicesScreen.stillToPay', { amount: formatMinorUnits(invoice.residualMinor, currency, 2, true) })
          : null,
      ]
        .filter(Boolean)
        .join(' · ')}
      alert={invoice.status === 'overdue'}
      end={<Figure>{formatMinorUnits(invoice.amountMinor, currency, 2, true)}</Figure>}
    />
  );
}
