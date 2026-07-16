import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { AppHeader } from '@/components/navigation/app-header';
import { Card, EmptyState, Screen, Skeleton, Text } from '@/components/ui';
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

const RECEIPT_TITLE: Record<MyReceipt['status'], string> = {
  uploaded: 'Receipt uploaded',
  extracting: 'Receipt uploaded',
  extracted: 'Receipt read, ready to send',
  needs_review: 'Receipt sent to your accountant',
  approved: 'Receipt approved',
  posted: 'Receipt booked to your accounts',
  rejected: 'Receipt returned by your accountant',
};

/** A unified timeline of the client's own account activity — the receipts they
 * captured and the reports their accountant published. Distinct from the
 * notification bell (push-style alerts); this is a durable history of what
 * actually happened on the account. Both sources are real and RLS-scoped. */
export default function ActivityScreen() {
  const theme = useTheme();
  const router = useRouter();

  const receipts = useQuery({ queryKey: ['my-receipts'], queryFn: listMyReceipts });
  const reports = useQuery({ queryKey: ['reports-insights'], queryFn: () => reportsService.getRecentInsights(10) });

  const items = useMemo<ActivityItem[]>(() => {
    const r: ActivityItem[] = (receipts.data ?? []).map((rec) => ({
      id: `receipt-${rec.id}`,
      icon: rec.status === 'rejected' ? 'alert-circle-outline' : 'receipt-outline',
      title: RECEIPT_TITLE[rec.status],
      subtitle: rec.vendorName ?? 'Receipt',
      at: new Date(rec.createdAt).getTime(),
    }));
    const rep: ActivityItem[] = (reports.data ?? []).map((rp) => ({
      id: `report-${rp.id}`,
      icon: 'document-text-outline',
      title: 'New report published',
      subtitle: rp.title,
      at: new Date(rp.publishedAt).getTime(),
      reportId: rp.id,
    }));
    return [...r, ...rep].sort((a, b) => b.at - a.at);
  }, [receipts.data, reports.data]);

  const loading = receipts.isLoading || reports.isLoading;

  return (
    <Screen scroll header={<AppHeader />}>
      <View style={{ gap: 4, marginTop: spacing.sm, marginBottom: spacing.lg }}>
        <Text variant="h2" weight="semibold">
          Activity
        </Text>
        <Text variant="body" color="mutedForeground">
          A history of your receipts and reports.
        </Text>
      </View>

      {loading ? (
        <View style={{ gap: spacing.md }}>
          <Skeleton height={64} radius={radius.lg} />
          <Skeleton height={64} radius={radius.lg} />
          <Skeleton height={64} radius={radius.lg} />
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          icon="pulse-outline"
          title="Nothing yet"
          message="When you capture receipts and your accountant publishes reports, they’ll show up here."
        />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {items.map((it) => {
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
                    <Ionicons name={it.icon} size={18} color={theme.colors.mutedForeground} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text variant="callout" weight="semibold" numberOfLines={1}>
                      {it.title}
                    </Text>
                    <Text variant="footnote" color="mutedForeground" numberOfLines={1}>
                      {it.subtitle}
                    </Text>
                  </View>
                  <Text variant="caption" color="mutedForeground">
                    {new Date(it.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                  </Text>
                </View>
              </Card>
            );
            return it.reportId ? (
              <Pressable
                key={it.id}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/report/[id]', params: { id: it.reportId! } })}>
                {row}
              </Pressable>
            ) : (
              <View key={it.id}>{row}</View>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
