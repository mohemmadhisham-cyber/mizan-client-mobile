import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DetailHeader } from '@/components/navigation/detail-header';
import { Card, EmptyState, Skeleton, Text } from '@/components/ui';
import { notificationsService } from '@/services/notifications';
import type { NotificationCategory, NotificationItem } from '@/services/types';
import { radius, spacing, useTheme } from '@/theme';

type Filter = NotificationCategory | 'all';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All Alerts' },
  { key: 'system', label: 'System' },
  { key: 'accountant', label: 'Accountant' },
  { key: 'ai_advisor', label: 'AI Advisor' },
];

const CATEGORY_LABEL: Record<NotificationCategory, string> = {
  system: 'SYSTEM',
  accountant: 'ACCOUNTANT',
  ai_advisor: 'AI ADVISOR',
};

const CATEGORY_ICON: Record<NotificationCategory, keyof typeof Ionicons.glyphMap> = {
  system: 'shield-checkmark-outline',
  accountant: 'document-text-outline',
  ai_advisor: 'sparkles',
};

export default function NotificationsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>('all');
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const { data } = useQuery({ queryKey: ['notifications'], queryFn: notificationsService.getAll });

  const items = useMemo(() => {
    const base = (data ?? []).map((n) => (readIds.has(n.id) ? { ...n, read: true } : n));
    return filter === 'all' ? base : base.filter((n) => n.category === filter);
  }, [data, filter, readIds]);

  function markAllRead() {
    setReadIds(new Set((data ?? []).map((n) => n.id)));
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top }}>
      <DetailHeader title="Notification Center" />
      <View style={{ paddingHorizontal: spacing.gutter, marginBottom: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="footnote" color="mutedForeground">
          Stay updated with your latest alerts
        </Text>
        <Pressable accessibilityRole="button" onPress={markAllRead}>
          <Text variant="caption" weight="semibold" color="success" style={{ letterSpacing: 0.6 }}>
            Mark all as read
          </Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ alignItems: 'center', paddingHorizontal: spacing.gutter, gap: spacing.sm, marginBottom: spacing.md }}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setFilter(f.key)}
              style={{
                backgroundColor: active ? theme.colors.primary : theme.colors.secondary,
                borderRadius: radius.full,
                paddingHorizontal: spacing.base,
                paddingVertical: spacing.sm,
              }}>
              <Text variant="caption" weight="semibold" style={{ color: active ? theme.colors.primaryForeground : theme.colors.foreground, letterSpacing: 0.6 }}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.gutter, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}>
        {!data ? (
          <>
            <Skeleton height={100} radius={radius.lg} />
            <Skeleton height={100} radius={radius.lg} />
          </>
        ) : items.length === 0 ? (
          <EmptyState icon="notifications-outline" title="No notifications" message="You're all caught up in this category." />
        ) : (
          items.map((n) => (
            <NotificationRow
              key={n.id}
              item={n}
              onPress={() => setReadIds((prev) => new Set(prev).add(n.id))}
              onAction={() => Alert.alert('Coming soon', `${n.actionLabel} isn't available yet.`)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function NotificationRow({ item, onPress, onAction }: { item: NotificationItem; onPress: () => void; onAction: () => void }) {
  const theme = useTheme();
  const tone =
    item.severity === 'alert' ? { bg: '#FFDAD6', fg: '#BA1A1A' } : item.severity === 'good' ? { bg: '#6BFE9C', fg: '#006D37' } : { bg: theme.colors.secondary, fg: theme.colors.primary };

  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card elevated style={{ flexDirection: 'row', gap: spacing.md, opacity: item.read ? 0.6 : 1 }}>
        <View style={{ width: 40, height: 40, borderRadius: radius.full, backgroundColor: tone.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={CATEGORY_ICON[item.category]} size={18} color={tone.fg} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ backgroundColor: theme.colors.secondary, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 1 }}>
              <Text variant="caption" color="mutedForeground" style={{ fontSize: 10, letterSpacing: 0.5 }}>
                {CATEGORY_LABEL[item.category]}
              </Text>
            </View>
            <Text variant="footnote" color="mutedForeground">
              {item.timeLabel}
            </Text>
          </View>
          <Text variant="title" style={item.severity === 'alert' ? { color: tone.fg } : undefined}>
            {item.title}
          </Text>
          <Text variant="body">{item.body}</Text>
          {item.actionLabel ? (
            <Pressable accessibilityRole="button" onPress={onAction} style={{ paddingTop: spacing.xs }}>
              <Text variant="callout" weight="semibold" color="success">
                {item.actionLabel}
              </Text>
            </Pressable>
          ) : null}
        </View>
        {!item.read ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.primary, marginTop: 4 }} /> : null}
      </Card>
    </Pressable>
  );
}
