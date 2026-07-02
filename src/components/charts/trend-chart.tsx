import { useState } from 'react';
import { type LayoutChangeEvent, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { Card, Text } from '@/components/ui';
import type { TrendPoint } from '@/services/types';
import { spacing, useTheme } from '@/theme';

interface TrendChartProps {
  question: string;
  takeaway?: string;
  data: TrendPoint[];
  type: 'bar' | 'line';
  /** 'question' (default): small muted label for insight-led charts. 'title':
   *  bold section heading, for plain-named charts like "Cash Flow". */
  headingVariant?: 'question' | 'title';
}

const CHART_HEIGHT = 120;
const PAD_X = 4;

export function TrendChart({ question, takeaway, data, type, headingVariant = 'question' }: TrendChartProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const values = data.map((d) => d.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  const usableW = Math.max(width - PAD_X * 2, 0);
  const stepX = data.length > 1 ? usableW / (data.length - 1) : usableW;
  const yFor = (v: number) => CHART_HEIGHT - ((v - min) / range) * (CHART_HEIGHT - 8) - 4;

  const linePath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${PAD_X + i * stepX} ${yFor(d.value)}`)
    .join(' ');

  return (
    <Card elevated style={{ gap: spacing.sm }}>
      {headingVariant === 'title' ? (
        <Text variant="title">{question}</Text>
      ) : (
        <Text variant="subhead" color="mutedForeground">
          {question}
        </Text>
      )}
      {takeaway ? (
        <Text variant="callout" weight="semibold">
          {takeaway}
        </Text>
      ) : null}
      <View onLayout={onLayout} style={{ height: CHART_HEIGHT, marginTop: spacing.xs }}>
        {width > 0 ? (
          <Svg width={width} height={CHART_HEIGHT}>
            {type === 'bar'
              ? data.map((d, i) => {
                  const barW = Math.max((usableW / data.length) * 0.55, 3);
                  const cx = PAD_X + (data.length > 1 ? i * stepX : usableW / 2);
                  const y = yFor(d.value);
                  return (
                    <Rect
                      key={d.month}
                      x={cx - barW / 2}
                      y={y}
                      width={barW}
                      height={CHART_HEIGHT - y}
                      rx={3}
                      fill={theme.colors.chart2}
                    />
                  );
                })
              : (
                  <>
                    <Path
                      d={linePath}
                      stroke={theme.colors.chart2}
                      strokeWidth={2.5}
                      fill="none"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                    {data.map((d, i) => (
                      <Rect
                        key={d.month}
                        x={PAD_X + i * stepX - 2}
                        y={yFor(d.value) - 2}
                        width={4}
                        height={4}
                        rx={2}
                        fill={theme.colors.chart3}
                      />
                    ))}
                  </>
                )}
          </Svg>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {data.map((d) => (
          <Text key={d.month} variant="caption" color="mutedForeground">
            {d.month}
          </Text>
        ))}
      </View>
    </Card>
  );
}
