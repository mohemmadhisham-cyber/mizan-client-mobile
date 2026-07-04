import { useState } from 'react';
import { type LayoutChangeEvent, Pressable, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { Card, Text } from '@/components/ui';
import { formatMoneyMinor, type Currency } from '@/lib/format';
import type { TrendPoint } from '@/services/types';
import { radius, spacing, useTheme } from '@/theme';

interface TrendChartProps {
  question: string;
  takeaway?: string;
  data: TrendPoint[];
  type: 'bar' | 'line';
  /** 'question' (default): small muted label for insight-led charts. 'title':
   *  bold section heading, for plain-named charts like "Cash Flow". */
  headingVariant?: 'question' | 'title';
  currency?: Currency;
}

const CHART_HEIGHT = 120;
const PAD_X = 4;

export function TrendChart({ question, takeaway, data, type, headingVariant = 'question', currency = 'AED' }: TrendChartProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const values = data.map((d) => d.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  const usableW = Math.max(width - PAD_X * 2, 0);
  const stepX = data.length > 1 ? usableW / (data.length - 1) : usableW;
  const yFor = (v: number) => CHART_HEIGHT - ((v - min) / range) * (CHART_HEIGHT - 8) - 4;

  function xForIndex(i: number) {
    return PAD_X + (data.length > 1 ? i * stepX : usableW / 2);
  }

  function handleTouch(locationX: number) {
    if (data.length === 0) return;
    let nearest = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < data.length; i++) {
      const dist = Math.abs(xForIndex(i) - locationX);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = i;
      }
    }
    setActiveIndex((prev) => (prev === nearest ? null : nearest));
  }

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
      <Pressable
        onLayout={onLayout}
        onPress={(e) => handleTouch(e.nativeEvent.locationX)}
        style={{ height: CHART_HEIGHT, marginTop: spacing.xs }}>
        {width > 0 ? (
          <>
            <Svg width={width} height={CHART_HEIGHT}>
              {activeIndex !== null ? (
                <Line
                  x1={xForIndex(activeIndex)}
                  x2={xForIndex(activeIndex)}
                  y1={0}
                  y2={CHART_HEIGHT}
                  stroke={theme.colors.border}
                  strokeWidth={1}
                  strokeDasharray="3,3"
                />
              ) : null}
              {type === 'bar'
                ? data.map((d, i) => {
                    const barW = Math.max((usableW / data.length) * 0.55, 3);
                    const cx = xForIndex(i);
                    const y = yFor(d.value);
                    return (
                      <Rect
                        key={d.month}
                        x={cx - barW / 2}
                        y={y}
                        width={barW}
                        height={CHART_HEIGHT - y}
                        rx={3}
                        fill={i === activeIndex ? theme.colors.primary : theme.colors.chart2}
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
                        <Circle
                          key={d.month}
                          cx={xForIndex(i)}
                          cy={yFor(d.value)}
                          r={i === activeIndex ? 4.5 : 2}
                          fill={i === activeIndex ? theme.colors.primary : theme.colors.chart3}
                        />
                      ))}
                    </>
                  )}
            </Svg>
            {activeIndex !== null ? (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: Math.min(Math.max(xForIndex(activeIndex) - 45, 0), Math.max(width - 90, 0)),
                  top: Math.max(yFor(data[activeIndex].value) - 40, 0),
                  width: 90,
                  alignItems: 'center',
                  backgroundColor: theme.colors.foreground,
                  borderRadius: radius.sm,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 4,
                }}>
                <Text variant="caption" weight="semibold" style={{ color: theme.colors.background }}>
                  {formatMoneyMinor(data[activeIndex].value, currency)}
                </Text>
                <Text variant="caption" style={{ color: theme.colors.background, opacity: 0.7 }}>
                  {data[activeIndex].month}
                </Text>
              </View>
            ) : null}
          </>
        ) : null}
      </Pressable>
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
