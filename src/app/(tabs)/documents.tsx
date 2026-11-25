import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AppHeader } from '@/components/navigation/app-header';
import { Badge, Card, EmptyState, Screen, Skeleton, Text } from '@/components/ui';
import { formatMoneyMinor, type Currency } from '@/lib/format';
import { listMyReceipts, type MyReceipt, type ReceiptStatus } from '@/services/receipts';
import { radius, softTone, spacing, useTheme, type SoftTone } from '@/theme';

/** Client-facing status labels + tints. Internal machine states
 * (uploaded/extracting) collapse into a calm "Processing" so the client sees a
 * meaningful lifecycle, not implementation detail. */
const STATUS_META: Record<ReceiptStatus, { label: string; tone: SoftTone }> = {
  uploaded: { label: 'Processing', tone: 'info' },
  extracting: { label: 'Processing', tone: 'info' },
  extracted: { label: 'Ready to send', tone: 'info' },
  needs_review: { label: 'With accountant', tone: 'success' },
  approved: { label: 'Approved', tone: 'success' },
  posted: { label: 'Booked', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
};

export default function DocumentsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { data, isLoading } = useQuery({ queryKey: ['my-receipts'], queryFn: listMyReceipts });

  const receipts = data ?? [];

  return (
    <Screen scroll header={<AppHeader />}>
      <View style={{ gap: 4, marginTop: spacing.sm, marginBottom: spacing.lg }}>
        <Text variant="h2" weight="semibold">
          Receipts
        </Text>
        <Text variant="body" color="mutedForeground">
          Photograph a receipt and we’ll read the details for your accountant.
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Photograph a receipt"
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
          Photograph a receipt
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
          title="No receipts yet"
          message="Your captured receipts will appear here with their status."
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
  const theme = useTheme();
  const meta = STATUS_META[receipt.status];
  const tone = softTone(theme.colors, meta.tone);
  const dateLabel = receipt.receiptDate
    ? new Date(receipt.receiptDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : new Date(receipt.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

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
            {receipt.vendorName ?? 'Receipt'}
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
          <Badge label={meta.label} bg={tone.bg} fg={tone.fg} />
        </View>
      </View>
    </Card>
  );
}
