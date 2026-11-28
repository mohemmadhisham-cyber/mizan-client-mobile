import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppHeader } from '@/components/navigation/app-header';
import { Badge, Card, EmptyState, Screen, Skeleton, Text } from '@/components/ui';
import { type Currency, formatMoneyMinor, localeTag } from '@/lib/format';
import { listMyReceipts, type MyReceipt, type ReceiptStatus } from '@/services/receipts';
import { radius, softTone, spacing, useTheme, type SoftTone } from '@/theme';

/** Client-facing status labels + tints. Internal machine states
 * (uploaded/extracting) collapse into a calm "Processing" so the client sees a
 * meaningful lifecycle, not implementation detail. */
const STATUS_META: Record<ReceiptStatus, { labelKey: string; tone: SoftTone }> = {
  uploaded: { labelKey: 'receipts.statusProcessing', tone: 'info' },
  extracting: { labelKey: 'receipts.statusProcessing', tone: 'info' },
  extracted: { labelKey: 'receipts.statusReadyToSend', tone: 'info' },
  needs_review: { labelKey: 'receipts.statusWithAccountant', tone: 'success' },
  approved: { labelKey: 'receipts.statusApproved', tone: 'success' },
  posted: { labelKey: 'receipts.statusBooked', tone: 'success' },
  rejected: { labelKey: 'receipts.statusRejected', tone: 'danger' },
};

export default function DocumentsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { data, isLoading } = useQuery({ queryKey: ['my-receipts'], queryFn: listMyReceipts });

  const receipts = data ?? [];

  return (
    <Screen scroll header={<AppHeader />}>
      <View style={{ gap: 4, marginTop: spacing.sm, marginBottom: spacing.lg }}>
        <Text variant="h2" weight="semibold">
          {t('receipts.title')}
        </Text>
        <Text variant="body" color="mutedForeground">
          {t('receipts.subtitle')}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('receipts.photograph')}
        onPress={() => router.push('/capture')}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          backgroundColor: theme.colors.primary,
          borderRadius: radius.lg,
          paddingVertical: spacing.base,
          marginBottom: spacing.lg,
        }}>
        <Ionicons name="camera" size={20} color={theme.colors.primaryForeground} />
        <Text variant="callout" weight="semibold" style={{ color: theme.colors.primaryForeground }}>
          {t('receipts.photograph')}
        </Text>
      </Pressable>

      {isLoading ? (
        <View style={{ gap: spacing.md }}>
          <Skeleton height={72} radius={radius.lg} />
          <Skeleton height={72} radius={radius.lg} />
        </View>
      ) : receipts.length === 0 ? (
        <EmptyState
          icon="receipt-outline"
          title={t('receipts.emptyTitle')}
          message={t('receipts.emptyBody')}
        />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {receipts.map((r) => (
            <ReceiptRow key={r.id} receipt={r} />
          ))}
        </View>
      )}
    </Screen>
  );
}

function ReceiptRow({ receipt }: { receipt: MyReceipt }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const meta = STATUS_META[receipt.status];
  const tone = softTone(theme.colors, meta.tone);
  const dateLabel = receipt.receiptDate
    ? new Date(receipt.receiptDate).toLocaleDateString(localeTag(), { day: 'numeric', month: 'short', year: 'numeric' })
    : new Date(receipt.createdAt).toLocaleDateString(localeTag(), { day: 'numeric', month: 'short' });

  return (
    <Card padded={false} style={{ padding: spacing.base }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.md,
            backgroundColor: theme.colors.secondary,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Ionicons name="receipt-outline" size={18} color={theme.colors.mutedForeground} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="callout" weight="semibold" numberOfLines={1}>
            {receipt.vendorName ?? t('common.receipt')}
          </Text>
          <Text variant="footnote" color="mutedForeground" numberOfLines={1}>
            {dateLabel}
            {receipt.category ? ` · ${receipt.category}` : ''}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          {receipt.totalMinor != null ? (
            <Text variant="callout" weight="semibold">
              {formatMoneyMinor(receipt.totalMinor, (receipt.currency as Currency) ?? 'AED', { fractionDigits: 2 })}
            </Text>
          ) : null}
          <Badge label={t(meta.labelKey)} bg={tone.bg} fg={tone.fg} />
        </View>
      </View>
    </Card>
  );
}
