import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TrendChart } from '@/components/charts/trend-chart';
import { DetailHeader } from '@/components/navigation/detail-header';
import { Button, Card, EmptyState, Skeleton, Text } from '@/components/ui';
import { CATEGORY_ICON, CATEGORY_LABEL, CATEGORY_TINT } from '@/services/report-presentation';
import { reportsService } from '@/services/reports';
import { radius, spacing, useTheme } from '@/theme';

export default function ReportDetailScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
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
        Alert.alert('No PDF yet', 'This report doesn’t have a downloadable PDF attached.');
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert('Download failed', 'Could not open the report PDF. Please try again.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top }}>
      <DetailHeader title={report.data?.title ?? 'Report'} />

      {report.isLoading ? (
        <View style={{ paddingHorizontal: spacing.gutter, gap: spacing.md }}>
          <Skeleton height={100} radius={radius.lg} />
          <Skeleton height={140} radius={radius.lg} />
        </View>
      ) : !report.data ? (
        <EmptyState icon="alert-circle-outline" title="Report not found" message="This report may have been removed." />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.gutter, paddingBottom: insets.bottom + spacing.xl, gap: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: radius.md,
                backgroundColor: CATEGORY_TINT[report.data.category],
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Ionicons name={CATEGORY_ICON[report.data.category]} size={16} color={theme.colors.primary} />
            </View>
            <Text variant="footnote" color="mutedForeground">
              {CATEGORY_LABEL[report.data.category]} · {report.data.publishedAt} · {report.data.sizeLabel}
            </Text>
          </View>

          <Card elevated>
            <Text variant="body">{report.data.narrative}</Text>
          </Card>

          {report.data.highlights.length > 0 ? (
            <Card elevated style={{ gap: spacing.sm }}>
              <Text variant="title">Highlights</Text>
              {report.data.highlights.map((h) => (
                <View key={h} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
                  <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} style={{ marginTop: 2 }} />
                  <Text variant="body" style={{ flex: 1 }}>
                    {h}
                  </Text>
                </View>
              ))}
            </Card>
          ) : null}

          {report.data.series.length > 0 ? <TrendChart question="Trend" data={report.data.series} type="line" /> : null}

          <Button
            title={downloading ? 'Opening…' : 'Download PDF'}
            icon="download-outline"
            variant="secondary"
            fullWidth
            disabled={downloading}
            onPress={downloadPdf}
          />
        </ScrollView>
      )}
    </View>
  );
}
