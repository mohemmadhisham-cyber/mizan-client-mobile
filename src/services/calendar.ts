import type { CalendarDay, CalendarEvent } from './types';

/** Compliance calendar. Fixture-backed (real interface) -- swap to a live
 * query once obligation-deadline delivery (balance-beams compliance_items) is
 * exposed to the client. */

const DAYS: CalendarDay[] = [
  { date: '2023-10-12', dayLabel: 'Mon', dayNumber: 12, eventKinds: [] },
  { date: '2023-10-13', dayLabel: 'Tue', dayNumber: 13, eventKinds: [] },
  { date: '2023-10-14', dayLabel: 'Wed', dayNumber: 14, eventKinds: ['task', 'deadline'] },
  { date: '2023-10-15', dayLabel: 'Thu', dayNumber: 15, eventKinds: ['meeting'] },
  { date: '2023-10-16', dayLabel: 'Fri', dayNumber: 16, eventKinds: [] },
  { date: '2023-10-17', dayLabel: 'Sat', dayNumber: 17, eventKinds: [] },
  { date: '2023-10-18', dayLabel: 'Sun', dayNumber: 18, eventKinds: [] },
];

const EVENTS_BY_DATE: Record<string, CalendarEvent[]> = {
  '2023-10-14': [
    {
      id: 'e1',
      kind: 'deadline',
      title: 'Tax Deadline',
      subtitle: 'Q3 Estimated Taxes',
      timeLabel: '10:00 AM',
      description: 'Ensure all documentation is submitted to the portal before EOD.',
    },
    {
      id: 'e2',
      kind: 'meeting',
      title: 'Meeting with Accountant',
      subtitle: 'Virtual · Zoom',
      timeLabel: '2:00 PM',
      description: 'Sarah Jenkins',
    },
    {
      id: 'e3',
      kind: 'task',
      title: 'Payroll Approval Due',
      subtitle: 'Review timesheets',
      timeLabel: '5:00 PM',
      actionLabel: 'Review Now',
    },
  ],
};

export const calendarService = {
  async getDays(): Promise<CalendarDay[]> {
    return DAYS;
  },
  async getEventsForDate(date: string): Promise<CalendarEvent[]> {
    return EVENTS_BY_DATE[date] ?? [];
  },
  defaultDate: '2023-10-14',
};
