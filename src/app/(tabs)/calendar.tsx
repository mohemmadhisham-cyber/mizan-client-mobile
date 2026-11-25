import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AddEventModal } from '@/components/calendar/add-event-modal';
import { FieldMark, HORIZON_GUTTER, HorizonScreen } from '@/components/horizon/horizon-screen';
import { Figure, RuledRow, SectionLabel } from '@/components/horizon/ruled';
import { Text } from '@/components/ui';
import i18n from '@/i18n';
import { useAuth } from '@/lib/auth-context';
import { localeTag } from '@/lib/format';
import { calendarService } from '@/services/calendar';
import type { CalendarEvent, CalendarEventKind, NewCalendarEvent } from '@/services/types';
import { useTheme } from '@/theme';
import { horizonColors } from '@/theme/horizon';

const CALENDAR_FIELD = 200;
const DAY_WIDTH = 56;
const DAY_HEIGHT = 78;
const DAY_MARKER_WIDTH = 28;
const MARKER_HEIGHT = 2;
const KIND_MARK = 4;
const ADD_ICON = 26;
const TIME_COLUMN = 76;
const PRESSED_OPACITY = 0.6;

const KIND_LABEL_KEY: Record<CalendarEventKind, string> = {
  deadline: 'calendar.kindDeadline',
  meeting: 'calendar.kindMeeting',
  task: 'calendar.kindTask',
};

function formatTimeLabel(time?: string | null): string {
  if (!time) return i18n.t('calendar.allDay');
  const [h, m] = time.split(':').map(Number);
  // A fixed date: only the clock time is shown, in the app language.
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(localeTag(), { hour12: true, hour: 'numeric', minute: '2-digit' });
}

function monthYearLabel(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString(localeTag(), { month: 'long', year: 'numeric' });
}

function longDayLabel(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString(localeTag(), { weekday: 'long', month: 'long', day: 'numeric' });
}

export default function CalendarScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const colors = horizonColors(theme.colors);
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
      Alert.alert(t('common.notLinkedTitle'), t('chat.notLinkedShort'));
      return;
    }
    const res = await calendarService.createEvent({ ...draft, eventDate: selectedDate }, clientId, user.id);
    if (!res.ok) {
      Alert.alert(t('calendar.addFailed'), res.error ?? t('common.tryAgainShort'));
      return;
    }
    setAddingEvent(false);
    void qc.invalidateQueries({ queryKey: ['calendar-events', selectedDate] });
    void qc.invalidateQueries({ queryKey: ['calendar-days'] });
  }

  async function handleDelete(id: string) {
    const res = await calendarService.deleteEvent(id);
    if (!res.ok) {
      Alert.alert(t('calendar.deleteFailed'), res.error ?? t('common.tryAgainShort'));
      return;
    }
    void qc.invalidateQueries({ queryKey: ['calendar-events', selectedDate] });
    void qc.invalidateQueries({ queryKey: ['calendar-days'] });
  }

  return (
    <>
      <HorizonScreen
        field={CALENDAR_FIELD}
        small
        lines={[{ text: monthYearLabel(selectedDate) }]}
        // Said only once the day's events are known: "0 events" while loading would be a claim.
        sub={events.data ? t('calendar.eventsThisDay', { count: events.data.length }) : undefined}
        top={
          <>
            <FieldMark />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('calendar.addEvent')}
              onPress={() => setAddingEvent(true)}
              hitSlop={10}
              style={({ pressed }) => ({ opacity: pressed ? PRESSED_OPACITY : 1 })}>
              <Ionicons name="add" size={ADD_ICON} color={colors.onField} />
            </Pressable>
          </>
        }
        // A diary: nothing here is waiting for the person.
        bridge={null}
        safeBottom={false}>
        {/* The days sit right under the line. The chosen day carries an ink marker, like the tab bar. */}
        <View style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0, minHeight: DAY_HEIGHT }}
            contentContainerStyle={{ paddingHorizontal: HORIZON_GUTTER - (DAY_WIDTH - DAY_MARKER_WIDTH) / 2 }}>
            {(days.data ?? []).map((d) => {
              const active = d.date === selectedDate;
              return (
                <Pressable
                  key={d.date}
                  accessibilityRole="button"
                  accessibilityLabel={longDayLabel(d.date)}
                  accessibilityState={{ selected: active }}
                  onPress={() => setSelectedDate(d.date)}
                  style={({ pressed }) => [styles.day, { opacity: pressed ? PRESSED_OPACITY : 1 }]}>
                  <Text
                    variant="caption"
                    weight="semibold"
                    style={{ color: active ? theme.colors.foreground : theme.colors.mutedForeground }}>
                    {d.dayLabel}
                  </Text>
                  <Figure size={20} style={{ textAlign: 'center' }}>
                    {String(d.dayNumber)}
                  </Figure>
                  <View style={styles.kinds}>
                    {d.eventKinds.map((kind) => (
                      <View
                        key={kind}
                        style={[
                          styles.kind,
                          // A deadline is the one kind worth a colour.
                          { backgroundColor: kind === 'deadline' ? theme.colors.danger : theme.colors.mutedForeground },
                        ]}
                      />
                    ))}
                  </View>
                  {active ? <View style={[styles.dayMarker, { backgroundColor: theme.colors.foreground }]} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <SectionLabel>{t('calendar.schedule')}</SectionLabel>
        {events.isError && !events.data ? (
          <RuledRow title={t('common.listLoadFailed')} action={t('common.retry')} onPress={() => void events.refetch()} />
        ) : !events.data ? (
          <RuledRow title={t('common.loading')} />
        ) : events.data.length === 0 ? (
          <RuledRow title={t('calendar.nothingScheduled')} plain />
        ) : (
          events.data.map((e) => <EventRow key={e.id} event={e} onDelete={() => void handleDelete(e.id)} />)
        )}
        <RuledRow title={t('calendar.addEvent')} onPress={() => setAddingEvent(true)} />
      </HorizonScreen>

      <AddEventModal
        visible={addingEvent}
        dateLabel={longDayLabel(selectedDate)}
        onCancel={() => setAddingEvent(false)}
        onCreate={handleCreate}
      />
    </>
  );
}

/** One event as a line of a timetable: the time, then what it is, then where. */
function EventRow({ event, onDelete }: { event: CalendarEvent; onDelete: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View style={[styles.event, { borderBottomColor: theme.colors.border }]}>
      <Text variant="subhead" weight="semibold" style={{ width: TIME_COLUMN }}>
        {formatTimeLabel(event.eventTime)}
      </Text>
      <View style={styles.eventText}>
        <Text variant="body" weight="semibold">
          {event.title}
        </Text>
        <Text variant="subhead" color={event.kind === 'deadline' ? 'danger' : 'mutedForeground'}>
          {[t(KIND_LABEL_KEY[event.kind]), event.location].filter(Boolean).join(' · ')}
        </Text>
        {event.description ? (
          <Text variant="subhead" color="mutedForeground">
            {event.description}
          </Text>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('common.delete')}: ${event.title}`}
        onPress={onDelete}
        hitSlop={12}
        style={({ pressed }) => ({ opacity: pressed ? PRESSED_OPACITY : 1 })}>
        <Text variant="footnote" weight="semibold" color="danger">
          {t('common.delete')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  day: {
    width: DAY_WIDTH,
    height: DAY_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  kinds: {
    flexDirection: 'row',
    gap: 3,
    height: KIND_MARK,
  },
  kind: {
    width: KIND_MARK,
    height: KIND_MARK,
    borderRadius: KIND_MARK / 2,
  },
  dayMarker: {
    position: 'absolute',
    bottom: 0,
    width: DAY_MARKER_WIDTH,
    height: MARKER_HEIGHT,
  },
  event: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginHorizontal: HORIZON_GUTTER,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  eventText: {
    flex: 1,
    gap: 2,
  },
});
