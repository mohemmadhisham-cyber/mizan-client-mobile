import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { DetailHeader } from '@/components/navigation/detail-header';
import { Card, EmptyState, Skeleton, Text } from '@/components/ui';
import { notificationsService } from '@/services/notifications';
import type { NotificationCategory, NotificationItem } from '@/services/types';
import { radius, softTone, spacing, useTheme } from '@/theme';

type Filter = NotificationCategory | 'all';

const FILTERS: { key: Filter; labelKey: string }[] = [
  { key: 'all', labelKey: 'notificationsScreen.filterAll' },
  { key: 'system', labelKey: 'notificationsScreen.filterSystem' },
  { key: 'accountant', labelKey: 'notificationsScreen.filterAccountant' },
  { key: 'ai_advisor', labelKey: 'notificationsScreen.filterAi' },
];

const CATEGORY_LABEL_KEY: Record<NotificationCategory, string> = {
  system: 'notificationsScreen.tagSystem',
  accountant: 'notificationsScreen.tagAccountant',
  ai_advisor: 'notificationsScreen.tagAi',
};

const CATEGORY_ICON: Record<NotificationCategory, keyof typeof Ionicons.glyphMap> = {
  system: 'shield-checkmark-outline',
  accountant: 'document-text-outline',
  ai_advisor: 'sparkles',
};

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('all');
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const { data } = useQuery({ queryKey: ['notifications'], queryFn: notificationsService.getAll });

  const items = useMemo(() => {
    const base = (data ?? []).map((n) => (readIds.has(n.id) ? { ...n, read: true } : n));
    return filter === 'all' ? base : base.filter((n) => n.category === filter);
  }, [data, filter, readIds]);

  // Optimistically flip locally for instant feedback, then persist to the
  // notifications table and refetch so the state survives a reload.
  function markOneRead(id: string) {
    setReadIds((prev) => new Set(prev).add(id));
    notificationsService
      .markRead(id)
      .then(() => queryClient.invalidateQueries({ queryKey: ['notifications'] }))
      .catch(() => {});
  }

  function markAllRead() {
    setReadIds(new Set((data ?? []).map((n) => n.id)));
    notificationsService
      .markAllRead()
      .then(() => queryClient.invalidateQueries({ queryKey: ['notifications'] }))
      .catch(() => {});
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top }}>
      <DetailHeader title={t('notificationsScreen.title')} />
      <View style={{ paddingHorizontal: spacing.gutter, marginBottom: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="footnote" color="mutedForeground">
          {t('notificationsScreen.subtitle')}
        </Text>
        <Pressable accessibilityRole="button" onPress={markAllRead}>
          <Text variant="caption" weight="semibold" color="success" style={{ letterSpacing: 0.6 }}>
            {t('notificationsScreen.markAllRead')}
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
                {t(f.labelKey)}
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
          <EmptyState icon="notifications-outline" title={t('notificationsScreen.emptyTitle')} message={t('notificationsScreen.emptyBody')} />
        ) : (
          items.map((n) => (
            <NotificationRow
              key={n.id}
              item={n}
              onPress={() => markOneRead(n.id)}
              onAction={() => markOneRead(n.id)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function NotificationRow({ item, onPress, onAction }: { item: NotificationItem; onPress: () => void; onAction: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const tone = softTone(theme.colors, item.severity === 'alert' ? 'danger' : item.severity === 'good' ? 'success' : 'neutral');

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
                {t(CATEGORY_LABEL_KEY[item.category])}
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
