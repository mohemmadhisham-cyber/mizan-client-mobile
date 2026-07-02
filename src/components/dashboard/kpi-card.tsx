import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { Card, Text } from '@/components/ui';
import { radius, spacing, useTheme } from '@/theme';

type Accent = 'good' | 'warn' | 'alert' | 'default';

interface KpiCardProps {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  sub?: string;
  accent?: Accent;
}

export function KpiCard({ label, value, icon, sub, accent = 'default' }: KpiCardProps) {
  const theme = useTheme();
  const accentColor =
    accent === 'good'
      ? theme.colors.success
      : accent === 'warn'
        ? theme.colors.warning
        : accent === 'alert'
          ? theme.colors.danger
          : theme.colors.primary;

  return (
    <Card elevated style={{ flexBasis: '47%', flexGrow: 1, gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
        <Text variant="footnote" color="mutedForeground" numberOfLines={1} style={{ flex: 1 }}>
          {label}
        </Text>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: radius.sm,
            backgroundColor: theme.colors.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Ionicons name={icon} size={15} color={accentColor} />
        </View>
      </View>
      <Text variant="title" tabular numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {sub ? (
        <Text variant="caption" color="mutedForeground" numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </Card>
  );
}
