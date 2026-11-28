import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Linking, View } from 'react-native';

import { TrendChart } from '@/components/charts/trend-chart';
import { Cta } from '@/components/horizon/cta';
import type { HeadlineLine } from '@/components/horizon/headline';
import { BRIDGE_WIDTH, FieldBack, HORIZON_GUTTER, HorizonScreen } from '@/components/horizon/horizon-screen';
import { RuledRow, SectionLabel } from '@/components/horizon/ruled';
import { Text } from '@/components/ui';
import { CATEGORY_LABEL_KEY } from '@/services/report-presentation';
import { reportsService } from '@/services/reports';
import { useTheme } from '@/theme';
import { horizonColors } from '@/theme/horizon';

/** Height of the field: a one-line title and one quiet line under it. */
const REPORT_FIELD = 176;
/** A title longer than this may be cut in the field (sooner in Arabic or with large text), so it is repeated in full below the line. */
const TITLE_FITS = 20;

/**
 * One report from the accountant: what it says, its highlights, its trend, and
 * the PDF to download. The words and figures are the accountant's; nothing here
 * computes or alters them.
 */
export default function ReportDetailScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const colors = horizonColors(theme.colors);
  const { id } = useLocalSearchParams<{ id: string }>();

  const [downloading, setDownloading] = useState(false);
  const report = useQuery({
    queryKey: ['report', id],
    queryFn: () => reportsService.getReport(id as string),
    enabled: Boolean(id),
  });

  async function downloadPdf() {
    setDownloading(true);
    try {
      const url = await reportsService.getReportPdfUrl(id as string);
      if (!url) {
        Alert.alert(t('reportDetail.noPdfTitle'), t('reportDetail.noPdfBody'));
        return;
      }
      // Only a secure web link is opened, whatever the server returned.
      if (!url.startsWith('https://')) throw new Error('unexpected link');
      await Linking.openURL(url);
    } catch {
      Alert.alert(t('reportDetail.downloadFailedTitle'), t('reportDetail.downloadFailedBody'));
    } finally {
      setDownloading(false);
    }
  }

  const data = report.data;
  const missing = !report.isLoading && !data;
  const lines: HeadlineLine[] = data
    ? [{ text: data.title }]
    : missing
      ? [{ text: t('reportDetail.notFoundTitle') }]
      : [{ text: t('common.loading'), soft: true }];
  const sub = data
    ? [t(CATEGORY_LABEL_KEY[data.category]), data.publishedAt, data.sizeLabel].filter(Boolean).join(' · ')
    : undefined;

  return (
    <HorizonScreen
      field={REPORT_FIELD}
      small
      animateKey={data ? 'report' : missing ? 'missing' : 'loading'}
      lines={lines}
      sub={sub}
      top={<FieldBack colors={colors} />}
      // The bridge marks the one thing to do here: take the PDF.
      bridge={data ? { start: HORIZON_GUTTER, width: BRIDGE_WIDTH } : null}>
      {missing ? (
        <View style={{ padding: HORIZON_GUTTER }}>
          <Text variant="body" color="mutedForeground">
            {t('horizonReports.notOpened')}
          </Text>
          {id ? (
            <View style={{ paddingTop: 14 }}>
              <Cta title={t('common.retry')} busy={report.isFetching} onPress={() => void report.refetch()} />
            </View>
          ) : null}
        </View>
      ) : data ? (
        <>
          <View style={{ paddingHorizontal: HORIZON_GUTTER, paddingTop: 22, gap: 14 }}>
            <Cta
              title={downloading ? t('common.opening') : t('reportDetail.downloadPdf')}
              busy={downloading}
              onPress={() => void downloadPdf()}
            />
            {data.title.length > TITLE_FITS ? (
              // Read once: the field already speaks the title in full.
              <Text variant="title" accessibilityElementsHidden importantForAccessibility="no">
                {data.title}
              </Text>
            ) : null}
            {data.narrative ? <Text variant="body">{data.narrative}</Text> : null}
          </View>

          {data.highlights.length > 0 ? (
            <>
              <SectionLabel>{t('reportDetail.highlights')}</SectionLabel>
              {data.highlights.map((highlight, index) => (
                <RuledRow key={`${index}-${highlight}`} title={highlight} plain />
              ))}
            </>
          ) : null}

          {data.series.length > 0 ? (
            <View style={{ paddingHorizontal: HORIZON_GUTTER, paddingTop: 22 }}>
              <TrendChart question={t('reportDetail.trend')} data={data.series} type="line" />
            </View>
          ) : null}
        </>
      ) : null}
    </HorizonScreen>
  );
}
