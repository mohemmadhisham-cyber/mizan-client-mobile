import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { TrendChart } from '@/components/charts/trend-chart';
import { AppHeader } from '@/components/navigation/app-header';
import { Card, Screen, Skeleton, Text } from '@/components/ui';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { formatMoneyMinor } from '@/lib/format';
import { reportsService } from '@/services/reports';
import type { Report } from '@/services/types';
import { CATEGORY_ICON, CATEGORY_TONE } from '@/services/report-presentation';
import { radius, softTone, spacing, useTheme } from '@/theme';

export default function ReportsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();

  const metrics = useQuery({ queryKey: ['reports-key-metrics'], queryFn: reportsService.getKeyMetrics });
  const pl = useQuery({ queryKey: ['reports-monthly-pl'], queryFn: reportsService.getMonthlyPL });
  // The count is part of the key: the Activity tab asks for 10 under the same name.
  const insights = useQuery({ queryKey: ['reports-insights', 2], queryFn: () => reportsService.getRecentInsights(2) });
  const { refreshing, onRefresh } = usePullToRefresh(() => Promise.all([metrics.refetch(), pl.refetch(), insights.refetch()]));

  return (
    <Screen scroll header={<AppHeader />} refreshing={refreshing} onRefresh={onRefresh}>
      <View style={{ gap: 4, marginTop: spacing.sm, marginBottom: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View>
            <Text variant="h2" weight="semibold">
              {t('reportsScreen.title')}
            </Text>
            <Text variant="body" color="mutedForeground">
              {t('reportsScreen.subtitle')}
            </Text>
          </View>
          <View style={[styles(theme).periodPill]}>
            <Ionicons name="calendar-outline" size={14} color={theme.colors.primary} />
            <Text variant="caption" weight="semibold" color="primary">
              {t('reportsScreen.thisQuarter')}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg }}>
        {metrics.data ? (
          <>
            <MetricCard
              label={t('reportsScreen.revenueGrowth')}
              value={`+${metrics.data.revenueGrowthPct}%`}
              sub={t('reportsScreen.vsLastQuarter')}
              icon="trending-up"
              tint={theme.colors.chart5}
            />
            <MetricCard
              label={t('reportsScreen.savingsPotential')}
              value={formatMoneyMinor(metrics.data.savingsPotentialMinor, metrics.data.currency)}
              sub={t('reportsScreen.acrossCategories', { count: metrics.data.savingsCategoryCount })}
              icon="wallet-outline"
              tint={theme.colors.accent}
            />
          </>
        ) : (
          <>
            <Skeleton height={132} radius={radius.lg} style={{ flex: 1 }} />
            <Skeleton height={132} radius={radius.lg} style={{ flex: 1 }} />
          </>
        )}
      </View>

      <View style={{ marginBottom: spacing.lg }}>
        {pl.data ? (
          <TrendChart question={t('reportsScreen.profitAndLoss')} data={pl.data} type="bar" headingVariant="title" />
        ) : (
          <Skeleton height={220} radius={radius.lg} />
        )}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
        <Text variant="title">{t('reportsScreen.monthlyInsights')}</Text>
        <Pressable accessibilityRole="button" onPress={() => router.push('/reports-archive')}>
          <Text variant="caption" weight="semibold" color="primary">
            {t('reportsScreen.viewAll')}
          </Text>
        </Pressable>
      </View>

      {!insights.data ? (
        <View style={{ gap: spacing.sm }}>
          <Skeleton height={72} radius={radius.md} />
          <Skeleton height={72} radius={radius.md} />
        </View>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {insights.data.map((r) => (
            <ReportRow key={r.id} report={r} onPress={() => router.push({ pathname: '/report/[id]', params: { id: r.id } })} />
          ))}
        </View>
      )}
    </Screen>
  );
}

function MetricCard({
  label,
  value,
  sub,
  icon,
  tint,
}: {
  label: string;
  value: string;
  sub: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
}) {
  return (
    <Card elevated style={{ flex: 1, gap: spacing.sm, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Text variant="footnote" color="mutedForeground" style={{ flex: 1 }}>
          {label}
        </Text>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <Text variant="h1" tabular numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text variant="caption" color="mutedForeground">
        {sub}
      </Text>
    </Card>
  );
}

function ReportRow({ report, onPress }: { report: Report; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          padding: spacing.base,
          borderRadius: radius.md,
          backgroundColor: theme.colors.card,
          opacity: pressed ? 0.7 : 1,
        },
        theme.elevation.xs,
      ]}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: radius.md,
          backgroundColor: softTone(theme.colors, CATEGORY_TONE[report.category]).bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Ionicons name={CATEGORY_ICON[report.category]} size={18} color={theme.colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="callout" weight="semibold" numberOfLines={1}>
          {report.title}
        </Text>
        <Text variant="footnote" color="mutedForeground">
          {report.publishedAt} · {report.sizeLabel}
        </Text>
      </View>
      <Ionicons name="download-outline" size={18} color={theme.colors.mutedForeground} />
    </Pressable>
  );
}

const styles = (theme: ReturnType<typeof useTheme>) => ({
  periodPill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
