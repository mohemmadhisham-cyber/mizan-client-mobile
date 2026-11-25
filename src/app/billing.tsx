import { useQuery } from '@tanstack/react-query';
import { Alert, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { FieldBack, HORIZON_GUTTER, HorizonScreen } from '@/components/horizon/horizon-screen';
import { Figure, RuledRow, SectionLabel } from '@/components/horizon/ruled';
import { Text } from '@/components/ui';
import i18n from '@/i18n';
import { formatMoneyMinor } from '@/lib/format';
import { billingService } from '@/services/billing';
import type { Invoice } from '@/services/types';
import { useTheme } from '@/theme';
import { horizonColors } from '@/theme/horizon';

const BILLING_FIELD = 150;
const INTRO_SPACE_ABOVE = 20;
const INTRO_SPACE_BELOW = 6;

const STATUS_LABEL_KEY: Record<string, string> = {
  paid: 'billing.statusPaid',
  unpaid: 'billing.statusUnpaid',
  partial: 'billing.statusPartial',
};

function notAvailable(feature: string) {
  Alert.alert(i18n.t('billing.managedTitle'), i18n.t('billing.managedBody', { feature }));
}

export default function BillingScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const colors = horizonColors(theme.colors);

  const plan = useQuery({ queryKey: ['billing-plan'], queryFn: billingService.getPlan });
  const invoices = useQuery({ queryKey: ['billing-invoices'], queryFn: billingService.getInvoices });

  return (
    <HorizonScreen
      field={BILLING_FIELD}
      small
      lines={[{ text: t('more.billing') }]}
      top={<FieldBack colors={colors} />}
      // A read-only view: the firm pays, so nothing here is the person's to do.
      bridge={null}>
      <View
        style={{
          paddingHorizontal: HORIZON_GUTTER,
          paddingTop: INTRO_SPACE_ABOVE,
          paddingBottom: INTRO_SPACE_BELOW,
        }}>
        <Text variant="callout" color="mutedForeground">
          {t('billing.intro')}
        </Text>
      </View>

      {plan.isLoading ? (
        <RuledRow title={t('common.loading')} />
      ) : !plan.data ? (
        <RuledRow title={t('billing.noInfo')} plain />
      ) : (
        <>
          <RuledRow
            title={plan.data.planName ?? t('billing.noPlan')}
            meta={[
              plan.data.firmName,
              plan.data.priceMinor > 0
                ? t('billing.perMonth', { amount: formatMoneyMinor(plan.data.priceMinor, plan.data.currency) })
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          />
          {plan.data.nextPaymentDue ? (
            <RuledRow title={t('billing.nextPayment')} plain end={<Figure>{plan.data.nextPaymentDue}</Figure>} />
          ) : null}
          <RuledRow title={t('billing.changePlan')} onPress={() => notAvailable(t('billing.featureChangePlan'))} />
        </>
      )}
      <RuledRow title={t('billing.updatePayment')} onPress={() => notAvailable(t('billing.featureUpdatePayment'))} />

      <SectionLabel>{t('billing.invoiceHistory')}</SectionLabel>
      {invoices.isError && !invoices.data ? (
        <RuledRow title={t('common.listLoadFailed')} action={t('common.retry')} onPress={() => void invoices.refetch()} />
      ) : !invoices.data ? (
        <RuledRow title={t('common.loading')} />
      ) : invoices.data.length === 0 ? (
        <RuledRow title={t('billing.noInvoices')} plain />
      ) : (
        invoices.data.map((inv) => <InvoiceRow key={inv.id} invoice={inv} />)
      )}
    </HorizonScreen>
  );
}

function InvoiceRow({ invoice }: { invoice: Invoice }) {
  const { t } = useTranslation();
  const status = STATUS_LABEL_KEY[invoice.status] ? t(STATUS_LABEL_KEY[invoice.status]) : invoice.status;
  return (
    <RuledRow
      title={invoice.date}
      // The status is a word in the line. An unpaid invoice is the one in colour.
      meta={`${invoice.number} · ${status}`}
      alert={invoice.status === 'unpaid'}
      end={<Figure>{formatMoneyMinor(invoice.amountMinor, invoice.currency)}</Figure>}
    />
  );
}
