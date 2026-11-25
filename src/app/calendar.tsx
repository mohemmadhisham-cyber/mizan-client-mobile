import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddEventModal } from '@/components/calendar/add-event-modal';
import { DetailHeader } from '@/components/navigation/detail-header';
import { Badge, Card, Skeleton, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { calendarService } from '@/services/calendar';
import type { CalendarEvent, CalendarEventKind, NewCalendarEvent } from '@/services/types';
import { radius, softTone, spacing, useTheme, type SoftTone } from '@/theme';

const KIND_ICON: Record<CalendarEventKind, keyof typeof Ionicons.glyphMap> = {
  deadline: 'alert-circle',
  meeting: 'videocam',
  task: 'checkmark-done',
};

const KIND_TONE: Record<CalendarEventKind, SoftTone> = {
  deadline: 'danger',
  meeting: 'info',
  task: 'success',
};

function formatTimeLabel(time?: string | null): string {
  if (!time) return 'All day';
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function monthYearLabel(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export default function CalendarScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { clientId, user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(calendarService.defaultDate);
  const [addingEvent, setAddingEvent] = useState(false);

  const days = useQuery({ queryKey: ['calendar-days'], queryFn: calendarService.getDays });
  const events = useQuery({
    queryKey: ['calendar-events', selectedDate],
    queryFn: () => calendarService.getEventsForDate(selectedDate),
  });

  async function handleCreate(draft: Omit<NewCalendarEvent, 'eventDate'>) {
    if (!clientId || !user) {
      Alert.alert('Not linked yet', 'Your account is not linked to a company yet.');
      return;
    }
    const res = await calendarService.createEvent({ ...draft, eventDate: selectedDate }, clientId, user.id);
    if (!res.ok) {
      Alert.alert('Could not add event', res.error ?? 'Try again.');
      return;
    }
    setAddingEvent(false);
    void qc.invalidateQueries({ queryKey: ['calendar-events', selectedDate] });
    void qc.invalidateQueries({ queryKey: ['calendar-days'] });
  }

  async function handleDelete(id: string) {
    const res = await calendarService.deleteEvent(id);
    if (!res.ok) {
      Alert.alert('Could not delete event', res.error ?? 'Try again.');
      return;
    }
    void qc.invalidateQueries({ queryKey: ['calendar-events', selectedDate] });
    void qc.invalidateQueries({ queryKey: ['calendar-days'] });
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top }}>
      <DetailHeader title={monthYearLabel(selectedDate)} />

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.gutter, marginBottom: spacing.md }}>
          <Text variant="footnote" color="mutedForeground">
            {events.data?.length ?? 0} events this day
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add event"
            onPress={() => setAddingEvent(true)}
            style={{ width: 40, height: 40, borderRadius: radius.full, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="add" size={18} color={theme.colors.primaryForeground} />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={{ alignItems: 'center', paddingHorizontal: spacing.gutter, gap: spacing.sm, marginBottom: spacing.lg }}>
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
                          <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: active ? theme.colors.primaryForeground : softTone(theme.colors, KIND_TONE[k]).fg }} />
                        ))}
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
        </ScrollView>

        <View style={{ paddingHorizontal: spacing.gutter }}>
          <Text variant="title" style={{ marginBottom: spacing.md }}>
            Schedule
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
                <EventCard key={e.id} event={e} onDelete={() => handleDelete(e.id)} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <AddEventModal
        visible={addingEvent}
        dateLabel={new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        onCancel={() => setAddingEvent(false)}
        onCreate={handleCreate}
      />
    </View>
  );
}

function EventCard({ event, onDelete }: { event: CalendarEvent; onDelete: () => void }) {
  const theme = useTheme();
  const colors = softTone(theme.colors, KIND_TONE[event.kind]);
  return (
    <View style={{ position: 'relative' }}>
      <View style={{ position: 'absolute', left: -27, top: 18, width: 16, height: 16, borderRadius: 8, backgroundColor: colors.fg, borderWidth: 4, borderColor: theme.colors.background }} />
      <Card elevated style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flexDirection: 'row', gap: spacing.sm, flex: 1 }}>
            <View style={{ width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={KIND_ICON[event.kind]} size={18} color={colors.fg} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="title">{event.title}</Text>
              {event.location ? (
                <Text variant="footnote" color="mutedForeground">
                  {event.location}
                </Text>
              ) : null}
            </View>
          </View>
          <Badge label={formatTimeLabel(event.eventTime)} bg={colors.bg} fg={colors.fg} />
        </View>
        {event.description ? (
          <View style={{ borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: spacing.sm }}>
            <Text variant="footnote" color="mutedForeground">
              {event.description}
            </Text>
          </View>
        ) : null}
        <Pressable accessibilityRole="button" onPress={onDelete} style={{ alignSelf: 'flex-end' }}>
          <Text variant="caption" weight="semibold" color="danger">
            Delete
          </Text>
        </Pressable>
      </Card>
    </View>
  );
}
