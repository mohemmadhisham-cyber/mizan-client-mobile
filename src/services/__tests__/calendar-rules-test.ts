import { calendarService, clientEventControl, requestStatusKey } from '@/services/calendar';
import type { CalendarEvent } from '@/services/types';

const mockFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({ supabase: { from: (...args: unknown[]) => mockFrom(...args) } }));

const ME = 'user-a';

const event = (over: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: 'ev1',
  kind: 'task',
  title: 'Send receipts',
  eventDate: '2026-12-02',
  status: 'confirmed',
  source: 'manual',
  createdBy: ME,
  ...over,
});

/** A query chain that records its filters and answers with `result`. */
function chain(result: unknown) {
  const calls: unknown[][] = [];
  const query: Record<string, unknown> = {};
  for (const name of ['update', 'eq', 'select', 'insert', 'delete']) {
    query[name] = (...args: unknown[]) => {
      calls.push([name, ...args]);
      return name === 'select' || name === 'insert' ? Promise.resolve(result) : query;
    };
  }
  return { query, calls };
}

beforeEach(() => {
  mockFrom.mockReset();
});

describe('what a client may do with an event', () => {
  test('withdraw their own meeting request while it waits', () => {
    expect(clientEventControl(event({ kind: 'meeting', source: 'client_request', status: 'pending' }), ME)).toBe('cancel');
  });

  test('nothing once the firm has answered it', () => {
    expect(clientEventControl(event({ kind: 'meeting', source: 'client_request', status: 'confirmed' }), ME)).toBeNull();
    expect(clientEventControl(event({ kind: 'meeting', source: 'client_request', status: 'declined' }), ME)).toBeNull();
  });

  test('delete an entry they made that is not a meeting', () => {
    expect(clientEventControl(event(), ME)).toBe('delete');
    expect(clientEventControl(event({ kind: 'deadline' }), ME)).toBe('delete');
  });

  test('the firm’s events, and meetings made before requests existed, are read only', () => {
    expect(clientEventControl(event({ createdBy: 'agent-1' }), ME)).toBeNull();
    expect(clientEventControl(event({ kind: 'meeting', source: 'manual', createdBy: ME }), ME)).toBeNull();
    expect(clientEventControl(event({ kind: 'meeting', source: 'public_booking', createdBy: null }), ME)).toBeNull();
    expect(clientEventControl(event(), null)).toBeNull();
  });
});

describe('the words for a request', () => {
  test('a waiting request reads "Requested" until the firm confirms', () => {
    expect(requestStatusKey(event({ source: 'client_request', status: 'pending' }))).toBe('calendar.statusRequested');
    expect(requestStatusKey(event({ source: 'client_request', status: 'confirmed' }))).toBe('calendar.statusConfirmed');
    expect(requestStatusKey(event({ source: 'client_request', status: 'declined' }))).toBe('calendar.statusDeclined');
  });

  test('other events say nothing, unless cancelled', () => {
    expect(requestStatusKey(event())).toBeNull();
    expect(requestStatusKey(event({ status: 'cancelled' }))).toBe('calendar.statusCancelled');
  });
});

describe('withdrawing a request', () => {
  test('cancels only a pending client request', async () => {
    const { query, calls } = chain({ data: [{ id: 'ev1' }], error: null });
    mockFrom.mockReturnValue(query);

    expect(await calendarService.cancelRequest('ev1')).toEqual({ ok: true });
    expect(calls).toEqual([
      ['update', { status: 'cancelled' }],
      ['eq', 'id', 'ev1'],
      ['eq', 'source', 'client_request'],
      ['eq', 'status', 'pending'],
      ['select', 'id'],
    ]);
  });

  test('says when the firm answered it in the meantime', async () => {
    const { query } = chain({ data: [], error: null });
    mockFrom.mockReturnValue(query);

    expect(await calendarService.cancelRequest('ev1')).toEqual({ ok: false, error: 'not_pending' });
  });
});

describe('adding an event', () => {
  test('too many open requests is told apart from other failures', async () => {
    const { query } = chain({ error: { message: 'calendar_events: too many open meeting requests' } });
    mockFrom.mockReturnValue(query);

    const res = await calendarService.createEvent({ kind: 'meeting', title: 'Talk', eventDate: '2026-12-02' }, 'client-a', ME);

    expect(res).toEqual({ ok: false, error: 'too_many_requests' });
  });
});
