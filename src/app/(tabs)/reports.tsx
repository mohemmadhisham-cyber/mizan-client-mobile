import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { TrendChart } from '@/components/charts/trend-chart';
import { FieldBack, HORIZON_GUTTER, HorizonScreen } from '@/components/horizon/horizon-screen';
import { Ledger, type LedgerCell, RuledRow, SectionLabel } from '@/components/horizon/ruled';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { formatMoneyMinor } from '@/lib/format';
import { CATEGORY_LABEL_KEY } from '@/services/report-presentation';
import { reportsService } from '@/services/reports';
import { useTheme } from '@/theme';
import { horizonColors } from '@/theme/horizon';

/** Height of the field: a one-line title. No period is named: the figures below carry their own. */
const REPORTS_FIELD = 150;

/**
 * Reports: the two key figures, the profit and loss trend, and the latest
 * reports from the accountant. Reached from More and from Home. Figures are the
 * server's; this screen only formats them.
 */
export default function ReportsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const colors = horizonColors(theme.colors);
  const router = useRouter();

  const metrics = useQuery({ queryKey: ['reports-key-metrics'], queryFn: reportsService.getKeyMetrics });
  const pl = useQuery({ queryKey: ['reports-monthly-pl'], queryFn: reportsService.getMonthlyPL });
  // The count is part of the key: the Activity tab asks for 10 under the same name.
  const insights = useQuery({ queryKey: ['reports-insights', 2], queryFn: () => reportsService.getRecentInsights(2) });
  const { refreshing, onRefresh } = usePullToRefresh(() => Promise.all([metrics.refetch(), pl.refetch(), insights.refetch()]));

  const m = metrics.data;
  const cells: LedgerCell[] = [
    // The service gives 0 when there are not yet two reports to compare, so 0 is not shown
    // as a result. The sign is shown as it is: a fall must not read as a rise.
    ...(m && m.revenueGrowthPct !== 0
      ? [
          {
            key: 'growth',
            label: t('reportsScreen.revenueGrowth'),
            value: `${m.revenueGrowthPct > 0 ? '+' : ''}${m.revenueGrowthPct}%`,
            // The service compares the two latest profit and loss reports, whatever their period.
            note: t('horizonReports.vsPrevious'),
          },
        ]
      : []),
    // Shown only when there is a figure: the service returns 0 until savings are worked out
    // on the server, and "AED 0 savings potential" would read as a finding.
    ...(m && m.savingsPotentialMinor > 0
      ? [
          {
            key: 'savings',
            label: t('reportsScreen.savingsPotential'),
            value: formatMoneyMinor(m.savingsPotentialMinor, m.currency),
            note: t('reportsScreen.acrossCategories', { count: m.savingsCategoryCount }),
          },
        ]
      : []),
  ];

  return (
    <HorizonScreen
      field={REPORTS_FIELD}
      small
      lines={[{ text: t('reportsScreen.title') }]}
      top={<FieldBack colors={colors} />}
      bridge={null}
      safeBottom={false}
      refreshing={refreshing}
      onRefresh={onRefresh}>
      {metrics.isError && !m ? (
        <RuledRow title={t('common.listLoadFailed')} action={t('common.retry')} onPress={() => void metrics.refetch()} />
      ) : cells.length > 0 ? (
        <Ledger cells={cells} />
      ) : null}

      {pl.data ? (
        <View style={{ paddingHorizontal: HORIZON_GUTTER, paddingTop: 22 }}>
          <TrendChart question={t('reportsScreen.profitAndLoss')} data={pl.data} type="bar" headingVariant="title" />
        </View>
      ) : (
        <>
          <SectionLabel>{t('reportsScreen.profitAndLoss')}</SectionLabel>
          {pl.isError ? (
            <RuledRow title={t('common.listLoadFailed')} action={t('common.retry')} onPress={() => void pl.refetch()} />
          ) : (
            <RuledRow title={t('common.loading')} />
          )}
        </>
      )}

      <SectionLabel>{t('reportsScreen.monthlyInsights')}</SectionLabel>
      {insights.isError && !insights.data ? (
        <RuledRow title={t('common.listLoadFailed')} action={t('common.retry')} onPress={() => void insights.refetch()} />
      ) : !insights.data ? (
        <RuledRow title={t('common.loading')} />
      ) : insights.data.length === 0 ? (
        <RuledRow title={t('reportDetail.noneFoundTitle')} />
      ) : (
        insights.data.map((report) => (
          <RuledRow
            key={report.id}
            title={report.title}
            meta={[t(CATEGORY_LABEL_KEY[report.category]), report.publishedAt, report.sizeLabel].filter(Boolean).join(' · ')}
            onPress={() => router.push({ pathname: '/report/[id]', params: { id: report.id } })}
          />
        ))
      )}
      <RuledRow title={t('reportDetail.allReports')} action={t('reportsScreen.viewAll')} onPress={() => router.push('/reports-archive')} />
    </HorizonScreen>
  );
}
