import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { useAppLock } from '@/hooks/use-app-lock';
import { RELOCK_AFTER_MS } from '@/lib/app-lock';

const mockLockOnFor = new Set<string>();

jest.mock('expo-local-authentication', () => ({ SecurityLevel: { NONE: 0 } }));
jest.mock('@/lib/device-prefs', () => ({
  readDevicePrefOrThrow: (key: string) => (mockLockOnFor.has(key.replace('app_lock.', '')) ? 'on' : null),
  writeDevicePref: async () => true,
}));

let appStateListener: (state: AppStateStatus) => void;
/** The phone's own clock, which a person can set. */
let wall: number;
/** The clock that only runs forward. */
let steady: number;

beforeEach(() => {
  mockLockOnFor.clear();
  wall = 1_000_000;
  steady = 5_000;
  jest.spyOn(Date, 'now').mockImplementation(() => wall);
  jest.spyOn(globalThis.performance, 'now').mockImplementation(() => steady);
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

/** A person with the lock on, past the lock screen and using the app. */
async function usingTheApp() {
  mockLockOnFor.add('user-a');
  const hook = await start({ userId: 'user-a', loading: false });
  await act(async () => hook.result.current.unlock());
  return hook;
}

const appBecomes = (state: AppStateStatus) => act(async () => appStateListener(state));

/** Both clocks move on by `ms`. */
function timePasses(ms: number) {
  wall += ms;
  steady += ms;
}

/** The app goes out of view, stays there for `ms`, and comes back. */
async function leaveFor(ms: number) {
  await appBecomes('inactive');
  await appBecomes('background');
  timePasses(ms);
  await appBecomes('active');
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

  test('nothing is decided until the session is known, and then it is locked', async () => {
    mockLockOnFor.add('user-a');
    const { result, rerender } = await start({ userId: null, loading: true });
    expect(result.current.locked).toBe(false);

    await rerender({ userId: 'user-a', loading: false });

    expect(result.current.locked).toBe(true);
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

  test('signing out from the lock leaves nothing locked for the next person', async () => {
    mockLockOnFor.add('user-a');
    mockLockOnFor.add('user-b');
    const { result, rerender } = await start({ userId: 'user-a', loading: false });
    expect(result.current.locked).toBe(true);

    await rerender({ userId: null, loading: false });
    expect(result.current.locked).toBe(false);

    await rerender({ userId: 'user-b', loading: false });
    expect(result.current.locked).toBe(false);
  });

  test('signing out from the lock and in again with a code is not met with the lock', async () => {
    mockLockOnFor.add('user-a');
    const { result, rerender } = await start({ userId: 'user-a', loading: false });
    expect(result.current.locked).toBe(true);

    await rerender({ userId: null, loading: false });
    await rerender({ userId: 'user-a', loading: false });

    expect(result.current.locked).toBe(false);
  });
});

describe('coming back to the app', () => {
  test('it locks again after long enough out of view', async () => {
    const { result } = await usingTheApp();

    await leaveFor(RELOCK_AFTER_MS);

    expect(result.current.locked).toBe(true);
  });

  test('a glance at another app does not lock it', async () => {
    const { result } = await usingTheApp();

    await leaveFor(RELOCK_AFTER_MS - 1);

    expect(result.current.locked).toBe(false);
  });

  test('a short prompt drawn over the app does not lock it', async () => {
    const { result } = await usingTheApp();

    await appBecomes('inactive');
    timePasses(5_000);
    await appBecomes('active');

    expect(result.current.locked).toBe(false);
    expect(result.current.covered).toBe(false);
  });

  test('time is counted from the first moment out of view, not from each step of leaving', async () => {
    const { result } = await usingTheApp();

    await appBecomes('inactive');
    timePasses(RELOCK_AFTER_MS - 1);
    await appBecomes('background');
    timePasses(1);
    await appBecomes('active');

    expect(result.current.locked).toBe(true);
  });

  test('it locks when the phone’s clock was set back while the app was away', async () => {
    const { result } = await usingTheApp();

    await appBecomes('background');
    wall -= 3_600_000;
    steady += 2_000;
    await appBecomes('active');

    expect(result.current.locked).toBe(true);
  });

  test('it locks when the phone’s clock says a moment and the forward-only clock says a minute', async () => {
    const { result } = await usingTheApp();

    await appBecomes('background');
    wall += 1_000;
    steady += RELOCK_AFTER_MS;
    await appBecomes('active');

    expect(result.current.locked).toBe(true);
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

  test('each time away is counted afresh', async () => {
    const { result } = await usingTheApp();

    await leaveFor(RELOCK_AFTER_MS - 1);
    await leaveFor(RELOCK_AFTER_MS - 1);

    expect(result.current.locked).toBe(false);
  });

  test('unlocking starts the count again: the prompt that unlocked it does not lock it', async () => {
    mockLockOnFor.add('user-a');
    const { result } = await start({ userId: 'user-a', loading: false });

    // The phone's own prompt puts the app out of view while the person answers it.
    await appBecomes('inactive');
    timePasses(RELOCK_AFTER_MS * 2);
    await act(async () => result.current.unlock());
    await appBecomes('active');

    expect(result.current.locked).toBe(false);
  });
});

describe('the cover while the app is out of view', () => {
  test('is drawn as soon as the app is not in view, and taken away on a quick return', async () => {
    const { result } = await usingTheApp();

    await appBecomes('inactive');
    expect(result.current.covered).toBe(true);

    await appBecomes('background');
    expect(result.current.covered).toBe(true);

    await appBecomes('active');
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

    await appBecomes('background');

    expect(result.current.covered).toBe(false);
  });
});
