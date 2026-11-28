import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { HorizonList } from '@/components/horizon/horizon-list';
import { FieldBack, HORIZON_GUTTER, HorizonScreen } from '@/components/horizon/horizon-screen';
import { RuledRow } from '@/components/horizon/ruled';
import { WordTabs } from '@/components/horizon/word-tabs';
import { Input, Text } from '@/components/ui';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { CATEGORY_LABEL_KEY } from '@/services/report-presentation';
import { reportsService } from '@/services/reports';
import type { Report, ReportCategory } from '@/services/types';
import { useTheme } from '@/theme';
import { horizonColors } from '@/theme/horizon';

const ARCHIVE_FIELD = 150;
const SEARCH_SPACE_ABOVE = 14;
const SEARCH_TEXT_SIZE = 17;
const COUNT_SPACE = 14;
/** `publishedAt` is a date as YYYY-MM-DD: the year is its first four characters. */
const YEAR_LENGTH = 4;
const ALL_YEARS = 'all';

type CategoryFilter = ReportCategory | 'all';

const CATEGORIES: CategoryFilter[] = ['all', 'pl', 'balance_sheet', 'tax', 'audit'];

const reportId = (r: Report): string => r.id;

function labelKeyFor(cat: CategoryFilter): string {
  return cat === 'all' ? 'reportDetail.allReports' : CATEGORY_LABEL_KEY[cat];
}

export default function ReportsArchiveScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const colors = horizonColors(theme.colors);
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [year, setYear] = useState<string>(ALL_YEARS);

  const results = useQuery({
    queryKey: ['reports-archive', query, category],
    queryFn: () => reportsService.searchArchive(query, category),
    // Each letter typed is a new search. The last results stay until the new ones arrive,
    // so the year line and the list do not blink out and back with every letter.
    placeholderData: keepPreviousData,
  });

  // The years offered are the years that have reports, newest first. A fixed
  // list goes stale: with one, this year's reports could not be reached.
  const years = useMemo(() => {
    const found = new Set((results.data ?? []).map((r) => r.publishedAt.slice(0, YEAR_LENGTH)));
    return [...found].sort((a, b) => b.localeCompare(a));
  }, [results.data]);
  // A year that the current results no longer contain falls back to all years.
  const activeYear = year === ALL_YEARS || years.includes(year) ? year : ALL_YEARS;

  const filtered = useMemo(
    () => (results.data ?? []).filter((r) => activeYear === ALL_YEARS || r.publishedAt.startsWith(activeYear)),
    [results.data, activeYear],
  );
  const { refreshing, onRefresh } = usePullToRefresh(results.refetch);

  return (
    <HorizonScreen
      field={ARCHIVE_FIELD}
      small
      scroll={false}
      safeBottom={false}
      lines={[{ text: t('reportDetail.archiveTitle') }]}
      top={<FieldBack colors={colors} />}
      // A place to look things up: nothing here is waiting for the person.
      bridge={null}>
      <View style={{ paddingHorizontal: HORIZON_GUTTER, paddingTop: SEARCH_SPACE_ABOVE }}>
        <Input
          variant="underline"
          // On the ground the field is a line to write on, not a box.
          style={{ backgroundColor: 'transparent', paddingHorizontal: 0, fontSize: SEARCH_TEXT_SIZE }}
          accessibilityLabel={t('reportDetail.searchPlaceholder')}
          placeholder={t('reportDetail.searchPlaceholder')}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
        />
      </View>

      <WordTabs
        options={CATEGORIES.map((c) => ({ key: c, label: t(labelKeyFor(c)) }))}
        value={category}
        onChange={setCategory}
      />
      {years.length > 1 ? (
        <WordTabs
          options={[{ key: ALL_YEARS, label: t('reportDetail.allYears') }, ...years.map((y) => ({ key: y, label: y }))]}
          value={activeYear}
          onChange={setYear}
        />
      ) : null}

      <HorizonList
        data={results.isLoading ? [] : filtered}
        keyExtractor={reportId}
        renderItem={(item) => (
          <RuledRow
            title={item.title}
            meta={`${t(CATEGORY_LABEL_KEY[item.category])} · ${item.publishedAt}`}
            onPress={() => router.push({ pathname: '/report/[id]', params: { id: item.id } })}
          />
        )}
        refreshing={refreshing}
        onRefresh={onRefresh}
        listEmpty={
          results.isLoading ? (
            <RuledRow title={t('common.loading')} />
          ) : results.isError ? (
            <RuledRow title={t('common.listLoadFailed')} action={t('common.retry')} onPress={onRefresh} />
          ) : (
            <RuledRow title={t('reportDetail.noneFoundTitle')} meta={t('reportDetail.noneFoundBody')} plain />
          )
        }
        listFooter={
          !results.isLoading && filtered.length > 0 ? (
            <View style={{ paddingHorizontal: HORIZON_GUTTER, paddingTop: COUNT_SPACE }}>
              <Text variant="footnote" color="mutedForeground">
                {t('reportDetail.showing', { count: filtered.length })}
              </Text>
            </View>
          ) : undefined
        }
      />
    </HorizonScreen>
  );
}
