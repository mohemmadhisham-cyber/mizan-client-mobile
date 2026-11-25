import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { HorizonList } from '@/components/horizon/horizon-list';
import { FieldBack, HorizonScreen } from '@/components/horizon/horizon-screen';
import { RuledRow } from '@/components/horizon/ruled';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { localeTag } from '@/lib/format';
import { listMyReceipts, type MyReceipt } from '@/services/receipts';
import { reportsService } from '@/services/reports';
import { useTheme } from '@/theme';
import { horizonColors } from '@/theme/horizon';

const ACTIVITY_FIELD = 176;

type ActivityItem = {
  id: string;
  title: string;
  subtitle: string;
  at: number;
  reportId?: string;
  /** Needs a look: a receipt the accountant sent back. */
  alert?: boolean;
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
  const theme = useTheme();
  const colors = horizonColors(theme.colors);
  const router = useRouter();

  const receipts = useQuery({ queryKey: ['my-receipts'], queryFn: listMyReceipts });
  // The count is part of the key: the Reports tab asks for 2 under the same name.
  const reports = useQuery({ queryKey: ['reports-insights', 10], queryFn: () => reportsService.getRecentInsights(10) });

  const items = useMemo<ActivityItem[]>(() => {
    const r: ActivityItem[] = (receipts.data ?? []).map((rec) => ({
      id: `receipt-${rec.id}`,
      title: t(RECEIPT_TITLE_KEY[rec.status]),
      subtitle: rec.vendorName ?? t('common.receipt'),
      at: new Date(rec.createdAt).getTime(),
      alert: rec.status === 'rejected',
    }));
    const rep: ActivityItem[] = (reports.data ?? []).map((rp) => ({
      id: `report-${rp.id}`,
      title: t('activity.reportPublished'),
      subtitle: rp.title,
      at: new Date(rp.publishedAt).getTime(),
      reportId: rp.id,
    }));
    return [...r, ...rep].sort((a, b) => b.at - a.at);
  }, [receipts.data, reports.data, t]);

  const loading = receipts.isLoading || reports.isLoading;
  // With nothing to show, a failed load must not read as "nothing has happened".
  const failed = receipts.isError || reports.isError;
  const { refreshing, onRefresh } = usePullToRefresh(() => Promise.all([receipts.refetch(), reports.refetch()]));

  return (
    <HorizonScreen
      field={ACTIVITY_FIELD}
      small
      scroll={false}
      safeBottom={false}
      lines={[{ text: t('activity.title') }]}
      sub={t('activity.subtitle')}
      top={<FieldBack colors={colors} />}
      // A history: nothing here is waiting for the person.
      bridge={null}>
      <HorizonList
        data={items}
        keyExtractor={activityId}
        renderItem={(item) => {
          const { reportId } = item;
          return (
            <RuledRow
              title={item.title}
              meta={`${item.subtitle} · ${dayLabel(item.at)}`}
              alert={item.alert}
              onPress={reportId ? () => router.push({ pathname: '/report/[id]', params: { id: reportId } }) : undefined}
            />
          );
        }}
        refreshing={refreshing}
        onRefresh={onRefresh}
        listEmpty={
          loading ? (
            <RuledRow title={t('common.loading')} />
          ) : failed ? (
            <RuledRow title={t('common.listLoadFailed')} action={t('common.retry')} onPress={onRefresh} />
          ) : (
            <RuledRow title={t('activity.emptyTitle')} meta={t('activity.emptyBody')} plain />
          )
        }
      />
    </HorizonScreen>
  );
}

const activityId = (it: ActivityItem): string => it.id;

function dayLabel(at: number): string {
  return new Date(at).toLocaleDateString(localeTag(), { day: 'numeric', month: 'short' });
}
