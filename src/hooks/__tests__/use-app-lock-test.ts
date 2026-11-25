import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { useAppLock } from '@/hooks/use-app-lock';
import { RELOCK_AFTER_MS } from '@/lib/app-lock';

const mockLockOnFor = new Set<string>();

jest.mock('expo-local-authentication', () => ({ SecurityLevel: { NONE: 0 } }));
jest.mock('@/lib/device-prefs', () => ({
  readDevicePref: (key: string) => (mockLockOnFor.has(key.replace('app_lock.', '')) ? 'on' : null),
  writeDevicePref: async () => true,
}));

let appStateListener: (state: AppStateStatus) => void;
let now: number;

beforeEach(() => {
  mockLockOnFor.clear();
  now = 1_000_000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    appStateListener = listener as (state: AppStateStatus) => void;
    return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

interface Props {
  userId: string | null;
  loading: boolean;
}

const start = (props: Props) => renderHook((p: Props) => useAppLock(p.userId, p.loading), { initialProps: props });

/** The app goes out of sight, stays there for `ms`, and comes back. */
async function leaveFor(ms: number) {
  await act(async () => appStateListener('inactive'));
  await act(async () => appStateListener('background'));
  now += ms;
  await act(async () => appStateListener('active'));
}

describe('when the app starts', () => {
  test('it is locked for a session already on the phone, with the lock on', async () => {
    mockLockOnFor.add('user-a');

    const { result } = await start({ userId: 'user-a', loading: false });

    expect(result.current.locked).toBe(true);
  });

  test('it is not locked with the lock off', async () => {
    const { result } = await start({ userId: 'user-a', loading: false });

    expect(result.current.locked).toBe(false);
  });

  test('nothing is decided until the session is known, and then it is locked without a frame unlocked', async () => {
    mockLockOnFor.add('user-a');
    const seen: boolean[] = [];
    const { result, rerender } = await renderHook(
      (p: Props) => {
        const lock = useAppLock(p.userId, p.loading);
        if (!p.loading) seen.push(lock.locked);
        return lock;
      },
      { initialProps: { userId: null, loading: true } as Props },
    );
    expect(result.current.locked).toBe(false);

    await rerender({ userId: 'user-a', loading: false });

    expect(result.current.locked).toBe(true);
    // Every finished render with the session known was a locked one.
    expect(seen[seen.length - 1]).toBe(true);
  });

  test('a person who signs in with a code after the app opened is not locked straight away', async () => {
    mockLockOnFor.add('user-a');
    const { result, rerender } = await start({ userId: null, loading: false });

    await rerender({ userId: 'user-a', loading: false });

    expect(result.current.locked).toBe(false);
  });
});

describe('unlocking and signing out', () => {
  test('unlocking opens the app', async () => {
    mockLockOnFor.add('user-a');
    const { result } = await start({ userId: 'user-a', loading: false });

    await act(async () => result.current.unlock());

    expect(result.current.locked).toBe(false);
  });

  test('signing out from the lock leaves nothing locked, for this person or the next', async () => {
    mockLockOnFor.add('user-a');
    mockLockOnFor.add('user-b');
    const { result, rerender } = await start({ userId: 'user-a', loading: false });
    expect(result.current.locked).toBe(true);

    await rerender({ userId: null, loading: false });
    expect(result.current.locked).toBe(false);

    await rerender({ userId: 'user-b', loading: false });
    expect(result.current.locked).toBe(false);
  });
});

describe('coming back to the app', () => {
  test('it locks again after long enough out of sight', async () => {
    mockLockOnFor.add('user-a');
    const { result } = await start({ userId: 'user-a', loading: false });
    await act(async () => result.current.unlock());

    await leaveFor(RELOCK_AFTER_MS);

    expect(result.current.locked).toBe(true);
  });

  test('a glance at another app does not lock it', async () => {
    mockLockOnFor.add('user-a');
    const { result } = await start({ userId: 'user-a', loading: false });
    await act(async () => result.current.unlock());

    await leaveFor(RELOCK_AFTER_MS - 1);

    expect(result.current.locked).toBe(false);
  });

  test('a prompt drawn over the app does not count as out of sight, however long it stays', async () => {
    mockLockOnFor.add('user-a');
    const { result } = await start({ userId: 'user-a', loading: false });
    await act(async () => result.current.unlock());

    await act(async () => appStateListener('inactive'));
    now += RELOCK_AFTER_MS * 10;
    await act(async () => appStateListener('active'));

    expect(result.current.locked).toBe(false);
    expect(result.current.covered).toBe(false);
  });

  test('it never locks with the lock off', async () => {
    const { result } = await start({ userId: 'user-a', loading: false });

    await leaveFor(RELOCK_AFTER_MS * 10);

    expect(result.current.locked).toBe(false);
  });

  test('it never locks with nobody signed in', async () => {
    mockLockOnFor.add('user-a');
    const { result } = await start({ userId: null, loading: false });

    await leaveFor(RELOCK_AFTER_MS * 10);

    expect(result.current.locked).toBe(false);
    expect(result.current.covered).toBe(false);
  });

  test('time out of sight is counted from when the app left, and afresh each time', async () => {
    mockLockOnFor.add('user-a');
    const { result } = await start({ userId: 'user-a', loading: false });
    await act(async () => result.current.unlock());

    await leaveFor(RELOCK_AFTER_MS - 1);
    await leaveFor(RELOCK_AFTER_MS - 1);

    expect(result.current.locked).toBe(false);
  });
});

describe('the cover while the app is out of sight', () => {
  test('is drawn while out of sight with the lock on, and taken away on a quick return', async () => {
    mockLockOnFor.add('user-a');
    const { result } = await start({ userId: 'user-a', loading: false });
    await act(async () => result.current.unlock());

    await act(async () => appStateListener('background'));
    expect(result.current.covered).toBe(true);

    await act(async () => appStateListener('active'));
    expect(result.current.covered).toBe(false);
    expect(result.current.locked).toBe(false);
  });

  test('gives way to the lock in one step on a late return: the app is never seen between them', async () => {
    mockLockOnFor.add('user-a');
    const seen: string[] = [];
    const { result } = await renderHook(
      (p: Props) => {
        const lock = useAppLock(p.userId, p.loading);
        seen.push(lock.locked ? 'locked' : lock.covered ? 'covered' : 'open');
        return lock;
      },
      { initialProps: { userId: 'user-a', loading: false } as Props },
    );
    await act(async () => result.current.unlock());
    seen.length = 0;

    await leaveFor(RELOCK_AFTER_MS);

    expect(seen).not.toContain('open');
    expect(seen[seen.length - 1]).toBe('locked');
  });

  test('is not drawn with the lock off', async () => {
    const { result } = await start({ userId: 'user-a', loading: false });

    await act(async () => appStateListener('background'));

    expect(result.current.covered).toBe(false);
  });
});
