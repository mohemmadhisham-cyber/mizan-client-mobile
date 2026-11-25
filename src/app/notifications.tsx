import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { type Href, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { HorizonList } from '@/components/horizon/horizon-list';
import { FieldBack, HORIZON_GUTTER, HorizonScreen } from '@/components/horizon/horizon-screen';
import { RuledRow } from '@/components/horizon/ruled';
import { Text } from '@/components/ui';
import { usePagedList } from '@/hooks/use-paged-list';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { chevronForward } from '@/lib/direction';
import { requestIdFromLink } from '@/services/accountant-requests';
import { NOTIFICATIONS_PAGE_SIZE, notificationsService } from '@/services/notifications';
import type { NotificationCategory, NotificationItem } from '@/services/types';
import { useTheme } from '@/theme';
import { horizonColors } from '@/theme/horizon';

const NOTIFICATIONS_FIELD = 176;
const FILTER_HEIGHT = 46;
const FILTER_GAP = 22;
const MARKER_HEIGHT = 2;
const UNREAD_MARK = 8;
const PRESSED_OPACITY = 0.6;

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

const notificationId = (n: NotificationItem): string => n.id;

/** A filtered view keeps loading pages until it shows at least this many rows. */
const MIN_FILTERED_ROWS = 8;

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const colors = horizonColors(theme.colors);
  const queryClient = useQueryClient();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const { items: loaded, isLoading, isError, isFetchingMore, hasMore, loadMore, refetch } = usePagedList(
    ['notifications', 'pages'],
    notificationsService.getPage,
    NOTIFICATIONS_PAGE_SIZE,
    notificationId,
  );
  const { refreshing, onRefresh } = usePullToRefresh(refetch);

  const items = useMemo(() => {
    const base = loaded.map((n) => (readIds.has(n.id) ? { ...n, read: true } : n));
    return filter === 'all' ? base : base.filter((n) => n.category === filter);
  }, [loaded, filter, readIds]);

  // The category filter runs on the rows already loaded (the category is worked
  // out on the device from the notification type). Keep loading until the view
  // has a screenful or the list ends, so a rare category never looks empty
  // while older rows exist on the server.
  useEffect(() => {
    if (filter !== 'all' && items.length < MIN_FILTERED_ROWS && hasMore && !isFetchingMore) loadMore();
  }, [filter, items.length, hasMore, isFetchingMore, loadMore]);
  const stillSearching = items.length === 0 && filter !== 'all' && hasMore;

  // Optimistically flip locally for instant feedback, then persist to the
  // notifications table and refetch so the state survives a reload.
  function markOneRead(id: string) {
    setReadIds((prev) => new Set(prev).add(id));
    notificationsService
      .markRead(id)
      .then(() => queryClient.invalidateQueries({ queryKey: ['notifications'] }))
      .catch(() => {});
  }

  // "View" marks the notification read and, when it is about a request from
  // the accountant, opens that request.
  function openNotification(item: NotificationItem) {
    markOneRead(item.id);
    const requestId = requestIdFromLink(item.link);
    if (requestId) router.push(`/approvals/${requestId}` as Href);
  }

  function markAllRead() {
    setReadIds(new Set(loaded.map((n) => n.id)));
    notificationsService
      .markAllRead()
      .then(() => queryClient.invalidateQueries({ queryKey: ['notifications'] }))
      .catch(() => {});
  }

  return (
    <HorizonScreen
      field={NOTIFICATIONS_FIELD}
      small
      scroll={false}
      safeBottom={false}
      lines={[{ text: t('notificationsScreen.title') }]}
      sub={t('notificationsScreen.subtitle')}
      top={
        <>
          <FieldBack colors={colors} />
          <Pressable
            accessibilityRole="button"
            onPress={markAllRead}
            hitSlop={12}
            style={({ pressed }) => ({ opacity: pressed ? PRESSED_OPACITY : 1 })}>
            <Text variant="subhead" weight="semibold" style={{ color: colors.onField }}>
              {t('notificationsScreen.markAllRead')}
            </Text>
          </Pressable>
        </>
      }
      // What needs the person is on Requests. This is the record of what was said.
      bridge={null}>
      {/* The filter is a line of words; the chosen one is inked and underlined. */}
      <View style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border }}>
        <ScrollView
          horizontal
          accessibilityRole="tablist"
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={{ paddingHorizontal: HORIZON_GUTTER, gap: FILTER_GAP }}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setFilter(f.key)}
                style={({ pressed }) => ({
                  height: FILTER_HEIGHT,
                  justifyContent: 'center',
                  opacity: pressed ? PRESSED_OPACITY : 1,
                })}>
                <Text
                  variant="subhead"
                  weight={active ? 'semibold' : 'regular'}
                  style={{ color: active ? theme.colors.foreground : theme.colors.mutedForeground }}>
                  {t(f.labelKey)}
                </Text>
                {active ? (
                  <View
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      start: 0,
                      end: 0,
                      height: MARKER_HEIGHT,
                      backgroundColor: theme.colors.foreground,
                    }}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <HorizonList
        data={items}
        keyExtractor={notificationId}
        renderItem={(item) => (
          <NotificationRow item={item} onPress={() => markOneRead(item.id)} onAction={() => openNotification(item)} />
        )}
        onEndReached={loadMore}
        loadingMore={isFetchingMore}
        refreshing={refreshing}
        onRefresh={onRefresh}
        listEmpty={
          isLoading || stillSearching ? (
            <RuledRow title={t('common.loading')} />
          ) : isError ? (
            <RuledRow title={t('common.listLoadFailed')} action={t('common.retry')} onPress={onRefresh} />
          ) : (
            <RuledRow
              title={t('notificationsScreen.emptyTitle')}
              meta={t('notificationsScreen.emptyBody')}
              plain
            />
          )
        }
      />
    </HorizonScreen>
  );
}

function NotificationRow({ item, onPress, onAction }: { item: NotificationItem; onPress: () => void; onAction: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: theme.colors.border, opacity: pressed ? PRESSED_OPACITY : 1 },
      ]}>
      <View style={styles.rowHead}>
        <Text variant="footnote" weight="semibold" color="mutedForeground" style={{ flex: 1 }}>
          {`${t(CATEGORY_LABEL_KEY[item.category])} · ${item.timeLabel}`}
        </Text>
        {/* Unread is an ink mark and a heavier title. A read row stays at full strength, so it stays readable. */}
        {!item.read ? <View style={[styles.unread, { backgroundColor: theme.colors.foreground }]} /> : null}
      </View>
      <Text
        variant="body"
        weight={item.read ? 'regular' : 'semibold'}
        color={item.severity === 'alert' ? 'danger' : undefined}>
        {item.title}
      </Text>
      <Text variant="subhead">{item.body}</Text>
      {item.actionLabel ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          hitSlop={10}
          style={({ pressed }) => [styles.action, { opacity: pressed ? PRESSED_OPACITY : 1 }]}>
          <Text variant="subhead" weight="bold">
            {item.actionLabel}
          </Text>
          <Ionicons name={chevronForward()} size={16} color={theme.colors.foreground} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    marginHorizontal: HORIZON_GUTTER,
    paddingVertical: 16,
    gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  unread: {
    width: UNREAD_MARK,
    height: UNREAD_MARK,
    borderRadius: UNREAD_MARK / 2,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingTop: 6,
  },
});
