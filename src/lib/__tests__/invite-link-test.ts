import { inviteTokenFrom } from '@/lib/invite-link';

const TOKEN = 'a3f1c9e07b2d4e8f9a6b5c4d3e2f1a0b9c8d7e6f';

describe('the invitation token in a link', () => {
  test('is taken in the form the server gives out', () => {
    expect(inviteTokenFrom(TOKEN)).toBe(TOKEN);
  });

  test('is the first one when a link carries it twice', () => {
    expect(inviteTokenFrom([TOKEN, 'other'])).toBe(TOKEN);
  });

  test.each([
    ['nothing', undefined],
    ['an empty value', ''],
    ['too short', 'a3f1c9'],
    ['capital letters', TOKEN.toUpperCase()],
    ['a path', '../../settings'],
    ['an address', 'https://example.com/x'],
    ['spaces', `${TOKEN} `],
    ['a number', 7],
  ])('is refused when it is %s', (_name, value) => {
    expect(inviteTokenFrom(value)).toBeNull();
  });
});
