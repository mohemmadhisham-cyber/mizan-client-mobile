import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DetailHeader } from '@/components/navigation/detail-header';
import { Button, Card, Skeleton, Text } from '@/components/ui';
import { formatMoneyMinor } from '@/lib/format';
import { billingService } from '@/services/billing';
import { radius, spacing, useTheme } from '@/theme';

function comingSoon(feature: string) {
  Alert.alert('Coming soon', `${feature} isn't available yet.`);
}

export default function BillingScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const plan = useQuery({ queryKey: ['billing-plan'], queryFn: billingService.getPlan });
  const paymentMethod = useQuery({ queryKey: ['billing-payment-method'], queryFn: billingService.getPaymentMethod });
  const invoices = useQuery({ queryKey: ['billing-invoices'], queryFn: billingService.getInvoices });

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top }}>
      <DetailHeader title="Billing & Subscriptions" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.gutter, paddingBottom: insets.bottom + spacing.xl, gap: spacing.lg }}>
        <Text variant="body" color="mutedForeground">
          Manage your Mizan Pro plan and payment details.
        </Text>

        {!plan.data ? (
          <Skeleton height={140} radius={radius.lg} />
        ) : (
          <Card elevated style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ gap: 4 }}>
                <Text variant="caption" color="mutedForeground" weight="semibold" style={{ letterSpacing: 0.6, textTransform: 'uppercase' }}>
                  Current Plan
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Text variant="title">{plan.data.name}</Text>
                  <View style={{ backgroundColor: '#6BFE9C', borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 }}>
                    <Text variant="caption" weight="semibold" style={{ color: '#00743A', letterSpacing: 0.6 }}>
                      ACTIVE
                    </Text>
                  </View>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <Text variant="h1" tabular>
                  {formatMoneyMinor(plan.data.priceMinor, plan.data.currency)}
                </Text>
                <Text variant="footnote" color="mutedForeground">
                  /mo
                </Text>
              </View>
            </View>

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
                  Next payment due
                </Text>
                <Text variant="callout" weight="semibold">
                  {plan.data.nextPaymentDate}
                </Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => comingSoon('Changing plans')}>
                <Text variant="caption" weight="semibold" color="primary" style={{ letterSpacing: 0.6 }}>
                  Change Plan
                </Text>
              </Pressable>
            </View>
          </Card>
        )}

        <Text variant="title">Payment Method</Text>
        {!paymentMethod.data ? (
          <Skeleton height={78} radius={radius.lg} />
        ) : (
          <Card elevated style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View
                style={{
                  width: 56,
                  height: 40,
                  borderRadius: radius.sm,
                  backgroundColor: theme.colors.secondary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Text weight="bold" style={{ color: theme.colors.primary, fontStyle: 'italic' }}>
                  {paymentMethod.data.brand}
                </Text>
              </View>
              <View>
                <Text variant="callout" weight="semibold">
                  •••• {paymentMethod.data.last4}
                </Text>
                <Text variant="footnote" color="mutedForeground">
                  Expires {paymentMethod.data.expiry}
                </Text>
              </View>
            </View>
            <Button title="Update Card" onPress={() => comingSoon('Updating your card')} />
          </Card>
        )}

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <Text variant="title">Invoice History</Text>
          <Pressable accessibilityRole="button" onPress={() => comingSoon('Bulk invoice download')}>
            <Text variant="caption" weight="semibold" color="primary" style={{ letterSpacing: 0.6 }}>
              Download All
            </Text>
          </Pressable>
        </View>

        {!invoices.data ? (
          <Skeleton height={180} radius={radius.lg} />
        ) : (
          <Card padded={false} elevated style={{ overflow: 'hidden' }}>
            {invoices.data.map((inv, i) => (
              <View
                key={inv.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: spacing.base,
                  borderBottomWidth: i === invoices.data.length - 1 ? 0 : 1,
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
                  <Text variant="callout">{inv.date}</Text>
                </View>
                <Text variant="callout" color="mutedForeground" style={{ width: 79 }}>
                  {formatMoneyMinor(inv.amountMinor, inv.currency)}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => comingSoon('Invoice PDF download')}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, width: 79, justifyContent: 'flex-end' }}>
                  <Ionicons name="download-outline" size={13} color={theme.colors.primary} />
                  <Text variant="caption" weight="semibold" color="primary">
                    PDF
                  </Text>
                </Pressable>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
