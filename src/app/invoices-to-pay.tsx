import { useQuery } from '@tanstack/react-query';
import { openBrowserAsync } from 'expo-web-browser';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { BRIDGE_WIDTH, FieldBack, HORIZON_GUTTER, HorizonScreen } from '@/components/horizon/horizon-screen';
import { Figure, RuledRow } from '@/components/horizon/ruled';
import { Text } from '@/components/ui';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useAuth } from '@/lib/auth-context';
import { formatDate, formatMinorUnits } from '@/lib/format';
import { type ClientInvoice, getClientInvoices, payPageUrl, totalDue } from '@/services/client-pages';
import { useTheme } from '@/theme';
import { horizonColors } from '@/theme/horizon';

const BILLS_FIELD = 190;
const NOTE_SPACE = 16;
const DAY = { day: 'numeric', month: 'short', year: 'numeric' } as const;

const STATE_KEY: Record<Exclude<ClientInvoice['state'], 'due'>, string> = {
  processing: 'billsScreen.stateProcessing',
  paid: 'billsScreen.statePaid',
  refunded: 'billsScreen.stateRefunded',
  failed: 'billsScreen.stateFailed',
};

const money = (minor: number, currency: string) => formatMinorUnits(minor, currency, 2, true);

/**
 * What this business owes its accountant's firm, newest first. A due invoice
 * can be paid: the firm's secure pay page opens in the phone's browser. No
 * card is ever typed into the app. Coming back, the list is read again, so a
 * payment just made shows as paid (or still processing) here.
 */
export default function InvoicesToPayScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const colors = horizonColors(theme.colors);
  const { clientId } = useAuth();
  const [payError, setPayError] = useState(false);

  const bills = useQuery({ queryKey: ['client-invoices', clientId ?? 'none'], queryFn: getClientInvoices });
  const { refreshing, onRefresh } = usePullToRefresh(() => bills.refetch());

  const value = bills.data?.status === 'ok' ? bills.data.value : null;
  const invoices = value?.invoices ?? [];
  const due = totalDue(invoices);
  const dueCount = invoices.filter((invoice) => invoice.state === 'due').length;

  async function pay(invoice: ClientInvoice) {
    const url = payPageUrl(invoice.payToken);
    if (!url) return;
    setPayError(false);
    try {
      await openBrowserAsync(url);
    } catch {
      setPayError(true);
    } finally {
      // The payment may have gone through while the page was open.
      void bills.refetch();
    }
  }

  const headline = due
    ? [{ text: money(due.amountMinor, due.currency), figure: true }, { text: t('billsScreen.dueSoft', { count: due.count }), soft: true }]
    : dueCount > 0
      ? [{ text: t('billsScreen.dueCount', { count: dueCount }) }]
      : [{ text: t('billsScreen.title') }];

  return (
    <HorizonScreen
      field={BILLS_FIELD}
      small
      lines={headline}
      sub={value?.firm ? t('billsScreen.fromFirm', { firm: value.firm }) : t('billsScreen.sub')}
      subLines={1}
      top={<FieldBack colors={colors} />}
      // Paying is the person's to do, when something is due.
      bridge={dueCount > 0 ? { start: HORIZON_GUTTER, width: BRIDGE_WIDTH } : null}
      refreshing={refreshing}
      onRefresh={onRefresh}>
      {bills.isError && !bills.data ? (
        <RuledRow title={t('common.listLoadFailed')} action={t('common.retry')} onPress={onRefresh} />
      ) : bills.isPending ? (
        <RuledRow title={t('common.loading')} />
      ) : bills.data?.status === 'not_offered' ? (
        <RuledRow title={t('billsScreen.notOffered')} plain />
      ) : invoices.length === 0 ? (
        <RuledRow title={t('billsScreen.empty')} plain />
      ) : (
        invoices.map((invoice) => <BillRow key={invoice.id} invoice={invoice} onPay={() => void pay(invoice)} />)
      )}
      <View style={{ paddingHorizontal: HORIZON_GUTTER, paddingTop: NOTE_SPACE, gap: 6 }}>
        {payError ? (
          <Text variant="footnote" color="danger" accessibilityLiveRegion="polite">
            {t('billsScreen.payOpenFailed')}
          </Text>
        ) : null}
        <Text variant="footnote" color="mutedForeground">
          {t('billsScreen.payNote')}
        </Text>
      </View>
    </HorizonScreen>
  );
}

function BillRow({ invoice, onPay }: { invoice: ClientInvoice; onPay: () => void }) {
  const { t } = useTranslation();
  const created = invoice.createdAt ? formatDate(invoice.createdAt, DAY) : null;
  const canPay = invoice.state === 'due' && payPageUrl(invoice.payToken) !== null;
  const state =
    invoice.state === 'due'
      ? canPay
        ? t('billsScreen.stateDue')
        : t('billsScreen.stateDueNoLink')
      : invoice.state === 'paid' && invoice.paidAt
        ? t('billsScreen.statePaidOn', { date: formatDate(invoice.paidAt, DAY) })
        : t(STATE_KEY[invoice.state]);
  return (
    <RuledRow
      title={invoice.description || t('billsScreen.untitled')}
      meta={[created, state].filter(Boolean).join(' · ')}
      alert={invoice.state === 'due' || invoice.state === 'failed'}
      end={<Figure>{money(invoice.amountMinor, invoice.currency)}</Figure>}
      action={canPay ? t('billsScreen.pay') : undefined}
      onPress={canPay ? onPay : undefined}
    />
  );
}
