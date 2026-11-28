import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Alert, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { DetailHeader } from '@/components/navigation/detail-header';
import { Badge, Card, Skeleton, Text } from '@/components/ui';
import i18n from '@/i18n';
import { formatMoneyMinor } from '@/lib/format';
import { billingService } from '@/services/billing';
import type { Invoice } from '@/services/types';
import { radius, softTone, spacing, useTheme, type SoftTone } from '@/theme';

const STATUS_TONE: Record<string, SoftTone> = {
  paid: 'success',
  unpaid: 'danger',
  partial: 'warning',
};

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
  const insets = useSafeAreaInsets();

  const plan = useQuery({ queryKey: ['billing-plan'], queryFn: billingService.getPlan });
  const invoices = useQuery({ queryKey: ['billing-invoices'], queryFn: billingService.getInvoices });

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top }}>
      <DetailHeader title={t('billing.title')} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.gutter, paddingBottom: insets.bottom + spacing.xl, gap: spacing.lg }}>
        <Text variant="body" color="mutedForeground">
          {t('billing.intro')}
        </Text>

        {plan.isLoading ? (
          <Skeleton height={140} radius={radius.lg} />
        ) : !plan.data ? (
          <Card>
            <Text variant="callout" color="mutedForeground">
              {t('billing.noInfo')}
            </Text>
          </Card>
        ) : (
          <Card elevated style={{ gap: spacing.md }}>
            <View style={{ gap: 4 }}>
              <Text variant="caption" color="mutedForeground" weight="semibold" style={{ letterSpacing: 0.6, textTransform: 'uppercase' }}>
                {plan.data.firmName}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
                <Text variant="title">{plan.data.planName ?? t('billing.noPlan')}</Text>
                {plan.data.priceMinor > 0 ? (
                  <Text variant="footnote" color="mutedForeground">
                    {t('billing.perMonth', { amount: formatMoneyMinor(plan.data.priceMinor, plan.data.currency) })}
                  </Text>
                ) : null}
              </View>
            </View>

            {plan.data.nextPaymentDue ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  backgroundColor: theme.colors.secondary,
                  borderRadius: radius.md,
                  padding: spacing.sm,
                }}>
                <Ionicons name="calendar-outline" size={18} color={theme.colors.mutedForeground} />
                <View style={{ flex: 1 }}>
                  <Text variant="footnote" color="mutedForeground">
                    {t('billing.nextPayment')}
                  </Text>
                  <Text variant="callout" weight="semibold">
                    {plan.data.nextPaymentDue}
                  </Text>
                </View>
              </View>
            ) : null}

            <Text
              variant="caption"
              weight="semibold"
              color="primary"
              accessibilityRole="button"
              accessibilityLabel={t('billing.changePlan')}
              style={{ letterSpacing: 0.6 }}
              onPress={() => notAvailable(t('billing.featureChangePlan'))}>
              {t('billing.changePlan')}
            </Text>
          </Card>
        )}

        <Text
          variant="caption"
          weight="semibold"
          color="primary"
          accessibilityRole="button"
          accessibilityLabel={t('billing.updatePayment')}
          style={{ letterSpacing: 0.6 }}
          onPress={() => notAvailable(t('billing.featureUpdatePayment'))}>
          {t('billing.updatePayment')}
        </Text>

        <Text variant="title">{t('billing.invoiceHistory')}</Text>

        {invoices.isLoading ? (
          <Skeleton height={180} radius={radius.lg} />
        ) : invoices.data && invoices.data.length === 0 ? (
          <Card>
            <Text variant="callout" color="mutedForeground">
              {t('billing.noInvoices')}
            </Text>
          </Card>
        ) : (
          <Card padded={false} elevated style={{ overflow: 'hidden' }}>
            {(invoices.data ?? []).map((inv, i) => (
              <InvoiceRow key={inv.id} invoice={inv} isLast={i === (invoices.data?.length ?? 0) - 1} />
            ))}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

function InvoiceRow({ invoice, isLast }: { invoice: Invoice; isLast: boolean }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const tone = softTone(theme.colors, STATUS_TONE[invoice.status] ?? 'neutral');
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.base,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: theme.colors.border,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: radius.full,
            backgroundColor: theme.colors.secondary,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Ionicons name="document-text-outline" size={15} color={theme.colors.mutedForeground} />
        </View>
        <View>
          <Text variant="callout">{invoice.date}</Text>
          <Text variant="caption" color="mutedForeground">
            {invoice.number}
          </Text>
        </View>
      </View>
      <Text variant="callout" color="mutedForeground" style={{ marginEnd: spacing.sm }}>
        {formatMoneyMinor(invoice.amountMinor, invoice.currency)}
      </Text>
      <Badge label={STATUS_LABEL_KEY[invoice.status] ? t(STATUS_LABEL_KEY[invoice.status]) : invoice.status} bg={tone.bg} fg={tone.fg} />
    </View>
  );
}
