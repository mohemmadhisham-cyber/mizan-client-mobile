import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { DetailHeader } from '@/components/navigation/detail-header';
import { Card, EmptyState, Input, Skeleton, Text } from '@/components/ui';
import { chevronForward } from '@/lib/direction';
import { CATEGORY_ICON, CATEGORY_LABEL_KEY, CATEGORY_TONE } from '@/services/report-presentation';
import { reportsService } from '@/services/reports';
import type { Report, ReportCategory } from '@/services/types';
import { radius, softTone, spacing, useTheme } from '@/theme';

type CategoryFilter = ReportCategory | 'all';

const CATEGORIES: CategoryFilter[] = ['all', 'pl', 'balance_sheet', 'tax', 'audit'];
const YEARS = ['2023', '2024', '2025'];

function labelKeyFor(cat: CategoryFilter): string {
  return cat === 'all' ? 'reportDetail.allReports' : CATEGORY_LABEL_KEY[cat];
}

export default function ReportsArchiveScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [year, setYear] = useState('2023');

  const results = useQuery({
    queryKey: ['reports-archive', query, category],
    queryFn: () => reportsService.searchArchive(query, category),
  });

  const filtered = useMemo(() => (results.data ?? []).filter((r) => r.publishedAt.startsWith(year)), [results.data, year]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top }}>
      <DetailHeader title={t('reportDetail.archiveTitle')} />

      <View style={{ paddingHorizontal: spacing.gutter, gap: spacing.md, marginBottom: spacing.md }}>
        <Input icon="search-outline" placeholder={t('reportDetail.searchPlaceholder')} value={query} onChangeText={setQuery} returnKeyType="search" />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {CATEGORIES.map((c) => (
            <FilterChip key={c} label={t(labelKeyFor(c))} active={category === c} onPress={() => setCategory(c)} />
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {YEARS.map((y) => (
            <FilterChip key={y} label={y} active={year === y} onPress={() => setYear(y)} />
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.gutter, paddingBottom: insets.bottom + spacing.xl, gap: spacing.sm }}>
        {results.isLoading ? (
          <>
            <Skeleton height={72} radius={radius.md} />
            <Skeleton height={72} radius={radius.md} />
            <Skeleton height={72} radius={radius.md} />
          </>
        ) : filtered.length === 0 ? (
          <EmptyState icon="document-text-outline" title={t('reportDetail.noneFoundTitle')} message={t('reportDetail.noneFoundBody')} />
        ) : (
          <>
            {filtered.map((r) => (
              <ArchiveRow key={r.id} report={r} onPress={() => router.push({ pathname: '/report/[id]', params: { id: r.id } })} />
            ))}
            <Text variant="caption" color="mutedForeground" center style={{ marginTop: spacing.sm }}>
              {t('reportDetail.showing', { count: filtered.length })}
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        backgroundColor: active ? theme.colors.primary : theme.colors.secondary,
      }}>
      <Text variant="caption" weight="semibold" style={{ color: active ? theme.colors.primaryForeground : theme.colors.mutedForeground }}>
        {label}
      </Text>
    </Pressable>
  );
}

function ArchiveRow({ report, onPress }: { report: Report; onPress: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
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
            {t(CATEGORY_LABEL_KEY[report.category])} · {report.publishedAt}
          </Text>
        </View>
        <Ionicons name={chevronForward()} size={18} color={theme.colors.mutedForeground} />
      </Card>
    </Pressable>
  );
}
