import NetInfo, { useNetInfo } from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { screen } from '@testing-library/react-native';

import { OfflineNote } from '@/components/horizon/offline-note';
import { isOffline, wireOnlineManager } from '@/lib/online';
import { renderInApp } from '@/test/render';

jest.mock('expo-router', () => ({ DefaultTheme: { colors: {}, fonts: {} } }));

const mockUseNetInfo = useNetInfo as jest.MockedFunction<typeof useNetInfo>;
const mockAddListener = NetInfo.addEventListener as jest.MockedFunction<typeof NetInfo.addEventListener>;

type Status = ReturnType<typeof useNetInfo>;
const status = (isConnected: boolean | null, isInternetReachable: boolean | null = null) =>
  ({ isConnected, isInternetReachable }) as Status;

describe('isOffline', () => {
  test('is true only when the phone says it has no connection', () => {
    expect(isOffline({ isConnected: false })).toBe(true);
    expect(isOffline({ isConnected: true })).toBe(false);
  });

  test('treats "not known yet" as online, so nothing flashes at launch', () => {
    expect(isOffline({ isConnected: null })).toBe(false);
  });
});

describe('the no-connection note', () => {
  test('shows nothing while online', async () => {
    mockUseNetInfo.mockReturnValue(status(true, true));

    await renderInApp(<OfflineNote />);

    expect(screen.queryByText('support.offline')).toBeNull();
  });

  test('says what is on screen may be old while offline', async () => {
    mockUseNetInfo.mockReturnValue(status(false, false));

    await renderInApp(<OfflineNote />);

    expect(screen.getByText('support.offline')).toBeOnTheScreen();
    expect(screen.getByRole('alert')).toBeOnTheScreen();
  });

  test('shows nothing when the reach probe fails but the phone is connected: the probe can be blocked', async () => {
    mockUseNetInfo.mockReturnValue(status(true, false));

    await renderInApp(<OfflineNote />);

    expect(screen.queryByText('support.offline')).toBeNull();
  });
});

describe('the data layer', () => {
  afterEach(() => {
    onlineManager.setOnline(true);
  });

  test('is told when the phone goes offline and when it is back', () => {
    wireOnlineManager();
    const listener = mockAddListener.mock.calls[mockAddListener.mock.calls.length - 1][0];

    listener(status(false) as Parameters<typeof listener>[0]);
    expect(onlineManager.isOnline()).toBe(false);

    listener(status(true) as Parameters<typeof listener>[0]);
    expect(onlineManager.isOnline()).toBe(true);
  });

  test('is not told it is offline by a failed reach probe alone', () => {
    wireOnlineManager();
    const listener = mockAddListener.mock.calls[mockAddListener.mock.calls.length - 1][0];

    listener(status(true, false) as Parameters<typeof listener>[0]);

    expect(onlineManager.isOnline()).toBe(true);
  });
});
