import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DetailHeader } from '@/components/navigation/detail-header';
import { Badge, Button, Card, Skeleton, Text } from '@/components/ui';
import { calendarService } from '@/services/calendar';
import type { CalendarEvent, CalendarEventKind } from '@/services/types';
import { radius, spacing, useTheme } from '@/theme';

const KIND_ICON: Record<CalendarEventKind, keyof typeof Ionicons.glyphMap> = {
  deadline: 'alert-circle',
  meeting: 'videocam',
  task: 'checkmark-done',
};

const KIND_COLOR: Record<CalendarEventKind, { bg: string; fg: string; dot: string }> = {
  deadline: { bg: '#FFDAD6', fg: '#BA1A1A', dot: '#BA1A1A' },
  meeting: { bg: '#D5E3FF', fg: '#001E40', dot: '#001E40' },
  task: { bg: '#6BFE9C', fg: '#006D37', dot: '#006D37' },
};

export default function CalendarScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedDate, setSelectedDate] = useState(calendarService.defaultDate);

  const days = useQuery({ queryKey: ['calendar-days'], queryFn: calendarService.getDays });
  const events = useQuery({
    queryKey: ['calendar-events', selectedDate],
    queryFn: () => calendarService.getEventsForDate(selectedDate),
  });

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top }}>
      <DetailHeader title="October 2023" />

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.gutter, marginBottom: spacing.md }}>
          <Text variant="footnote" color="mutedForeground">
            {events.data?.length ?? 0} events today
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add event"
            onPress={() => Alert.alert('Coming soon', 'Creating calendar events is not yet available.')}
            style={{ width: 40, height: 40, borderRadius: radius.full, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="add" size={18} color={theme.colors.primaryForeground} />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.gutter, gap: spacing.sm, marginBottom: spacing.lg }}>
          {!days.data
            ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} width={64} height={88} radius={radius.lg} />)
            : days.data.map((d) => {
                const active = d.date === selectedDate;
                return (
                  <Pressable
                    key={d.date}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => setSelectedDate(d.date)}
                    style={{
                      width: 64,
                      height: 88,
                      borderRadius: radius.lg,
                      backgroundColor: active ? theme.colors.primary : theme.colors.secondary,
                      borderWidth: active ? 0 : 1,
                      borderColor: theme.colors.border,
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                    }}>
                    <Text variant="caption" weight="semibold" style={{ color: active ? theme.colors.primaryForeground : theme.colors.mutedForeground, opacity: active ? 0.8 : 1 }}>
                      {d.dayLabel}
                    </Text>
                    <Text variant="title" style={{ color: active ? theme.colors.primaryForeground : theme.colors.foreground }}>
                      {d.dayNumber}
                    </Text>
                    {d.eventKinds.length > 0 ? (
                      <View style={{ flexDirection: 'row', gap: 4 }}>
                        {d.eventKinds.map((k, i) => (
                          <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: active ? '#FFFFFF' : KIND_COLOR[k].dot }} />
                        ))}
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
        </ScrollView>

        <View style={{ paddingHorizontal: spacing.gutter }}>
          <Text variant="title" style={{ marginBottom: spacing.md }}>
            Today&apos;s Schedule
          </Text>

          {!events.data ? (
            <Skeleton height={200} radius={radius.lg} />
          ) : events.data.length === 0 ? (
            <Card>
              <Text variant="callout" color="mutedForeground">
                Nothing scheduled for this day.
              </Text>
            </Card>
          ) : (
            <View style={{ borderLeftWidth: 2, borderLeftColor: theme.colors.border, paddingLeft: spacing.lg, gap: spacing.lg }}>
              {events.data.map((e) => (
                <EventCard
                  key={e.id}
                  event={e}
                  onAction={() => {
                    if (e.actionLabel === 'Review Now') router.push('/tasks');
                  }}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function EventCard({ event, onAction }: { event: CalendarEvent; onAction: () => void }) {
  const theme = useTheme();
  const colors = KIND_COLOR[event.kind];
  return (
    <View style={{ position: 'relative' }}>
      <View style={{ position: 'absolute', left: -27, top: 18, width: 16, height: 16, borderRadius: 8, backgroundColor: colors.dot, borderWidth: 4, borderColor: theme.colors.background }} />
      <Card elevated style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flexDirection: 'row', gap: spacing.sm, flex: 1 }}>
            <View style={{ width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={KIND_ICON[event.kind]} size={18} color={colors.fg} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="title">{event.title}</Text>
              <Text variant="footnote" color="mutedForeground">
                {event.subtitle}
              </Text>
            </View>
          </View>
          <Badge label={event.timeLabel} bg={colors.bg} fg={colors.fg} />
        </View>
        {event.description ? (
          <View style={{ borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: spacing.sm }}>
            <Text variant="footnote" color="mutedForeground">
              {event.description}
            </Text>
          </View>
        ) : null}
        {event.actionLabel ? (
          <Button title={event.actionLabel} variant="secondary" fullWidth onPress={onAction} />
        ) : null}
      </Card>
    </View>
  );
}
