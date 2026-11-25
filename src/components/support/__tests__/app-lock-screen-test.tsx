import { act, fireEvent, screen } from '@testing-library/react-native';
import { AppState, type AppStateStatus, BackHandler } from 'react-native';

import { AppLockScreen } from '@/components/support/app-lock-screen';
import { askToUnlock, setAppLock, type UnlockResult } from '@/lib/app-lock';
import { renderInApp } from '@/test/render';

jest.mock('@/lib/app-lock', () => ({ askToUnlock: jest.fn(), setAppLock: jest.fn(async () => true) }));

const mockAsk = askToUnlock as jest.MockedFunction<typeof askToUnlock>;
const mockSetLock = setAppLock as jest.MockedFunction<typeof setAppLock>;

const onUnlocked = jest.fn();
const onSignOut = jest.fn();
let appStateListener: ((state: AppStateStatus) => void) | null;

function appIs(state: AppStateStatus) {
  (AppState as { currentState: AppStateStatus }).currentState = state;
}

beforeEach(() => {
  mockAsk.mockReset().mockResolvedValue('unlocked');
  mockSetLock.mockClear();
  appStateListener = null;
  appIs('active');
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    appStateListener = listener as (state: AppStateStatus) => void;
    return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

const show = () => renderInApp(<AppLockScreen userId="user-a" onUnlocked={onUnlocked} onSignOut={onSignOut} />);

/** A question to the phone that stays open until the test answers it. */
function openQuestion() {
  let answer: (result: UnlockResult) => void = () => {};
  mockAsk.mockImplementation(() => new Promise<UnlockResult>((resolve) => (answer = resolve)));
  return (result: UnlockResult) => act(async () => answer(result));
}

describe('the lock screen', () => {
  test('asks the phone as soon as it appears, and opens the app on a yes', async () => {
    await show();

    expect(mockAsk).toHaveBeenCalledTimes(1);
    expect(mockAsk).toHaveBeenCalledWith('lock.prompt');
    expect(onUnlocked).toHaveBeenCalledTimes(1);
  });

  test('stays locked on a no, says so, and asks again when Unlock is pressed', async () => {
    mockAsk.mockResolvedValue('refused');
    await show();

    expect(onUnlocked).not.toHaveBeenCalled();
    expect(screen.getByText('lock.refused')).toBeTruthy();

    mockAsk.mockResolvedValue('unlocked');
    await fireEvent.press(screen.getByRole('button', { name: 'lock.unlock' }));

    expect(mockAsk).toHaveBeenCalledTimes(2);
    expect(onUnlocked).toHaveBeenCalledTimes(1);
  });

  test('asks the phone once while a question is still open', async () => {
    const answer = openQuestion();
    await show();

    await fireEvent.press(screen.getByRole('button', { name: 'lock.unlock' }));
    await fireEvent.press(screen.getByRole('button', { name: 'lock.unlock' }));

    expect(mockAsk).toHaveBeenCalledTimes(1);
    await answer('refused');
  });

  test('turns the lock off and opens the app when the phone has nothing left to confirm with', async () => {
    mockAsk.mockResolvedValue('unavailable');
    await show();

    expect(mockSetLock).toHaveBeenCalledWith('user-a', false);
    expect(onUnlocked).toHaveBeenCalledTimes(1);
  });

  test('always offers signing out, so a person who cannot unlock is not stuck', async () => {
    mockAsk.mockResolvedValue('refused');
    await show();

    await fireEvent.press(screen.getByRole('button', { name: 'auth.signOut' }));

    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(onUnlocked).not.toHaveBeenCalled();
  });

  test('waits to ask until the app is in view: the phone cannot ask out of sight', async () => {
    appIs('background');
    await show();
    expect(mockAsk).not.toHaveBeenCalled();

    await act(async () => appStateListener?.('inactive'));
    expect(mockAsk).not.toHaveBeenCalled();

    await act(async () => appStateListener?.('active'));
    expect(mockAsk).toHaveBeenCalledTimes(1);
    expect(onUnlocked).toHaveBeenCalledTimes(1);
  });

  test('swallows the phone’s back button, so the screens under the lock do not move', async () => {
    const back = jest.spyOn(BackHandler, 'addEventListener');
    mockAsk.mockResolvedValue('refused');
    await show();

    const [event, handler] = back.mock.calls[0];
    expect(event).toBe('hardwareBackPress');
    expect((handler as () => boolean)()).toBe(true);
  });
});
