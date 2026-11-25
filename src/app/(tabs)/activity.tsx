import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppHeader } from '@/components/navigation/app-header';
import { Card, EmptyState, ScreenList, Skeleton, Text } from '@/components/ui';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { localeTag } from '@/lib/format';
import { listMyReceipts, type MyReceipt } from '@/services/receipts';
import { reportsService } from '@/services/reports';
import { radius, spacing, useTheme } from '@/theme';

type ActivityItem = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  at: number;
  reportId?: string;
};

const RECEIPT_TITLE_KEY: Record<MyReceipt['status'], string> = {
  uploaded: 'activity.receiptUploaded',
  extracting: 'activity.receiptUploaded',
  extracted: 'activity.receiptExtracted',
  needs_review: 'activity.receiptNeedsReview',
  approved: 'activity.receiptApproved',
  posted: 'activity.receiptPosted',
  rejected: 'activity.receiptRejected',
};

/** A unified timeline of the client's own account activity — the receipts they
 * captured and the reports their accountant published. Distinct from the
 * notification bell (push-style alerts); this is a durable history of what
 * actually happened on the account. Both sources are real and RLS-scoped. */
export default function ActivityScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const receipts = useQuery({ queryKey: ['my-receipts'], queryFn: listMyReceipts });
  // The count is part of the key: the Reports tab asks for 2 under the same name.
  const reports = useQuery({ queryKey: ['reports-insights', 10], queryFn: () => reportsService.getRecentInsights(10) });

  const items = useMemo<ActivityItem[]>(() => {
    const r: ActivityItem[] = (receipts.data ?? []).map((rec) => ({
      id: `receipt-${rec.id}`,
      icon: rec.status === 'rejected' ? 'alert-circle-outline' : 'receipt-outline',
      title: t(RECEIPT_TITLE_KEY[rec.status]),
      subtitle: rec.vendorName ?? t('common.receipt'),
      at: new Date(rec.createdAt).getTime(),
    }));
    const rep: ActivityItem[] = (reports.data ?? []).map((rp) => ({
      id: `report-${rp.id}`,
      icon: 'document-text-outline',
      title: t('activity.reportPublished'),
      subtitle: rp.title,
      at: new Date(rp.publishedAt).getTime(),
      reportId: rp.id,
    }));
    return [...r, ...rep].sort((a, b) => b.at - a.at);
  }, [receipts.data, reports.data, t]);

  const loading = receipts.isLoading || reports.isLoading;
  const { refreshing, onRefresh } = usePullToRefresh(() => Promise.all([receipts.refetch(), reports.refetch()]));

  return (
    <ScreenList
      header={<AppHeader />}
      data={items}
      keyExtractor={activityId}
      renderItem={(it) => (
        <ActivityRow item={it} onOpenReport={(id) => router.push({ pathname: '/report/[id]', params: { id } })} />
      )}
      refreshing={refreshing}
      onRefresh={onRefresh}
      listHeader={
        // The list adds `spacing.sm` under the header; the margin makes up the rest of `spacing.lg`.
        <View style={{ gap: 4, marginTop: spacing.sm, marginBottom: spacing.lg - spacing.sm }}>
          <Text variant="h2" weight="semibold">
            {t('activity.title')}
          </Text>
          <Text variant="body" color="mutedForeground">
            {t('activity.subtitle')}
          </Text>
        </View>
      }
      listEmpty={
        loading ? (
          <View style={{ gap: spacing.md }}>
            <Skeleton height={64} radius={radius.lg} />
            <Skeleton height={64} radius={radius.lg} />
            <Skeleton height={64} radius={radius.lg} />
          </View>
        ) : (
          <EmptyState icon="pulse-outline" title={t('activity.emptyTitle')} message={t('activity.emptyBody')} />
        )
      }
    />
  );
}

const activityId = (it: ActivityItem): string => it.id;

function ActivityRow({ item, onOpenReport }: { item: ActivityItem; onOpenReport: (reportId: string) => void }) {
  const theme = useTheme();
  const reportId = item.reportId;
  const row = (
    <Card padded={false} style={{ padding: spacing.base }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.full,
            backgroundColor: theme.colors.secondary,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Ionicons name={item.icon} size={18} color={theme.colors.mutedForeground} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="callout" weight="semibold" numberOfLines={1}>
            {item.title}
          </Text>
          <Text variant="footnote" color="mutedForeground" numberOfLines={1}>
            {item.subtitle}
          </Text>
        </View>
        <Text variant="caption" color="mutedForeground">
          {new Date(item.at).toLocaleDateString(localeTag(), { day: 'numeric', month: 'short' })}
        </Text>
      </View>
    </Card>
  );
  return reportId ? (
    <Pressable accessibilityRole="button" onPress={() => onOpenReport(reportId)}>
      {row}
    </Pressable>
  ) : (
    row
  );
}
