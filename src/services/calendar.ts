import { supabase } from '@/lib/supabase';

import type { CalendarDay, CalendarEvent, CalendarEventKind, NewCalendarEvent } from './types';

/** Real calendar backed by the `calendar_events` table (RLS-scoped to the
 * caller's own client_id). Client-created events only today -- syncing
 * firm-generated compliance deadlines into the same view is a later pass. */

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface EventRow {
  id: string;
  kind: CalendarEventKind;
  title: string;
  description: string | null;
  location: string | null;
  event_date: string;
  event_time: string | null;
}

function fromRow(r: EventRow): CalendarEvent {
  return {
    id: r.id,
    kind: r.kind,
    title: r.title,
    description: r.description,
    location: r.location,
    eventDate: r.event_date,
    eventTime: r.event_time,
  };
}

export const calendarService = {
  defaultDate: toDateKey(new Date()),

  /** 7-day strip starting today, with real event-kind dots per day. */
  async getDays(): Promise<CalendarDay[]> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);

    const { data } = await supabase
      .from('calendar_events')
      .select('event_date, kind')
      .gte('event_date', toDateKey(start))
      .lte('event_date', toDateKey(end));

    const kindsByDate = new Map<string, Set<CalendarEventKind>>();
    for (const row of data ?? []) {
      const set = kindsByDate.get(row.event_date) ?? new Set<CalendarEventKind>();
      set.add(row.kind as CalendarEventKind);
      kindsByDate.set(row.event_date, set);
    }

    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const key = toDateKey(d);
      return {
        date: key,
        dayLabel: DAY_LABELS[d.getDay()],
        dayNumber: d.getDate(),
        eventKinds: Array.from(kindsByDate.get(key) ?? []),
      };
    });
  },

  async getEventsForDate(date: string): Promise<CalendarEvent[]> {
    const { data, error } = await supabase
      .from('calendar_events')
      .select('id, kind, title, description, location, event_date, event_time')
      .eq('event_date', date)
      .order('event_time', { ascending: true, nullsFirst: false });
    // Thrown, so the screen can say the day could not be read: an empty list would read as a free day.
    if (error) throw new Error(error.message);
    return ((data ?? []) as EventRow[]).map(fromRow);
  },

  async createEvent(event: NewCalendarEvent, clientId: string, userId: string): Promise<{ ok: boolean; error?: string }> {
    const { error } = await supabase.from('calendar_events').insert({
      client_id: clientId,
      created_by: userId,
      kind: event.kind,
      title: event.title,
      description: event.description || null,
      location: event.location || null,
      event_date: event.eventDate,
      event_time: event.eventTime || null,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  },

  async deleteEvent(id: string): Promise<{ ok: boolean; error?: string }> {
    const { error } = await supabase.from('calendar_events').delete().eq('id', id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  },
};
