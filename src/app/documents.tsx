import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { DetailHeader } from '@/components/navigation/detail-header';
import { Badge, Card, EmptyState, ScreenList, Skeleton, Text } from '@/components/ui';
import { usePagedList } from '@/hooks/use-paged-list';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { type Currency, formatMoneyMinor, localeTag } from '@/lib/format';
import {
  expenseCategoryKey,
  listMyReceiptsPage,
  RECEIPTS_PAGE_SIZE,
  type MyReceipt,
  type ReceiptStatus,
} from '@/services/receipts';
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

const receiptId = (r: MyReceipt): string => r.id;

export default function DocumentsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const {
    items: receipts,
    isLoading,
    isError,
    isFetchingMore,
    loadMore,
    refetch,
  } = usePagedList(['my-receipts', 'pages'], listMyReceiptsPage, RECEIPTS_PAGE_SIZE, receiptId);
  const { refreshing, onRefresh } = usePullToRefresh(refetch);

  return (
    <ScreenList
      header={<DetailHeader title={t('nav.documents')} />}
      clearsTabBar={false}
      data={receipts}
      keyExtractor={receiptId}
      renderItem={(r) => <ReceiptRow receipt={r} />}
      onEndReached={loadMore}
      loadingMore={isFetchingMore}
      refreshing={refreshing}
      onRefresh={onRefresh}
      listHeader={
        // The list adds `spacing.sm` under the header; the margin makes up the rest of `spacing.lg`.
        <View style={{ marginBottom: spacing.lg - spacing.sm }}>
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
            }}>
            <Ionicons name="camera" size={20} color={theme.colors.primaryForeground} />
            <Text variant="callout" weight="semibold" style={{ color: theme.colors.primaryForeground }}>
              {t('receipts.photograph')}
            </Text>
          </Pressable>
        </View>
      }
      listEmpty={
        isLoading ? (
          <View style={{ gap: spacing.md }}>
            <Skeleton height={72} radius={radius.lg} />
            <Skeleton height={72} radius={radius.lg} />
          </View>
        ) : isError ? (
          <EmptyState
            icon="cloud-offline-outline"
            title={t('common.listLoadFailed')}
            message={t('home.loadErrorBody')}
            actionLabel={t('common.retry')}
            onAction={onRefresh}
          />
        ) : (
          <EmptyState icon="receipt-outline" title={t('receipts.emptyTitle')} message={t('receipts.emptyBody')} />
        )
      }
    />
  );
}

function ReceiptRow({ receipt }: { receipt: MyReceipt }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const meta = STATUS_META[receipt.status];
  const tone = softTone(theme.colors, meta.tone);
  const categoryKey = receipt.category ? expenseCategoryKey(receipt.category) : null;
  const categoryLabel = categoryKey ? t(categoryKey) : receipt.category;
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
            {categoryLabel ? ` · ${categoryLabel}` : ''}
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
