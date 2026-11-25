import { isRequestGone, requestErrorKey, requestIdFromLink } from '@/services/accountant-requests';

jest.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));
jest.mock('@/lib/env', () => ({ assertSupabaseConfigured: jest.fn() }));

const REQUEST_ID = '3f2c1a9e-0b7d-4c5e-9a1f-2d3e4f5a6b7c';

describe('requestIdFromLink', () => {
  test('reads the request id from an approval link', () => {
    expect(requestIdFromLink(`/approvals/${REQUEST_ID}`)).toBe(REQUEST_ID);
  });

  test('accepts an id written in capitals', () => {
    expect(requestIdFromLink(`/approvals/${REQUEST_ID.toUpperCase()}`)).toBe(REQUEST_ID.toUpperCase());
  });

  test.each([
    ['no link', null],
    ['an empty link', ''],
    ['another screen', '/settings'],
    ['an approval link with no id', '/approvals/'],
    ['an id that is not a UUID', '/approvals/123'],
    ['a path that climbs out', `/approvals/../settings`],
    ['an approval link with more after the id', `/approvals/${REQUEST_ID}/extra`],
    ['an approval link with a query', `/approvals/${REQUEST_ID}?next=/settings`],
    ['a full web address', `https://example.com/approvals/${REQUEST_ID}`],
    ['an approval link with a line break', `/approvals/${REQUEST_ID}\n/settings`],
  ])('follows nothing for %s', (_name, link) => {
    expect(requestIdFromLink(link)).toBeNull();
  });

  test('follows nothing when the link is missing', () => {
    expect(requestIdFromLink(undefined)).toBeNull();
  });
});

describe('isRequestGone', () => {
  test.each(['not_waiting', 'not_found'])('is true for %s: the list must be reloaded', (code) => {
    expect(isRequestGone(code)).toBe(true);
  });

  test.each(['forbidden', 'budget_changed', 'unknown', ''])('is false for %s', (code) => {
    expect(isRequestGone(code)).toBe(false);
  });
});

describe('requestErrorKey', () => {
  test.each([
    ['not_waiting', 'requests.errNotWaiting'],
    ['not_found', 'requests.errNotFound'],
    ['forbidden', 'requests.errForbidden'],
    ['budget_changed', 'requests.errBudgetChanged'],
  ])('gives plain words for %s', (code, key) => {
    expect(requestErrorKey(code)).toBe(key);
  });

  test('gives a message for a code the app does not know, never the raw code', () => {
    const key = requestErrorKey('something_new_from_the_server');

    expect(key).toMatch(/^requests\./);
    expect(key).not.toContain('something_new');
  });
});
