import { act, fireEvent, screen } from '@testing-library/react-native';
import { Alert, type AlertButton, Linking } from 'react-native';

import DeleteAccountScreen from '@/app/delete-account';
import { SUPPORT_EMAIL } from '@/lib/contact';
import { requestAccountDeletion } from '@/services/account-deletion';
import { renderInApp } from '@/test/render';

const mockNav = { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) };

jest.mock('expo-router', () => ({
  DefaultTheme: { colors: {}, fonts: {} },
  useRouter: () => mockNav,
}));
jest.mock('@/lib/auth-context', () => ({ useAuth: () => ({ user: { id: 'user-a', email: 'owner@example.com' } }) }));
jest.mock('@/services/account-deletion', () => ({ requestAccountDeletion: jest.fn() }));

const mockRequest = requestAccountDeletion as jest.MockedFunction<typeof requestAccountDeletion>;

let alertSpy: jest.SpiedFunction<typeof Alert.alert>;
let openSpy: jest.SpiedFunction<typeof Linking.openURL>;

beforeEach(() => {
  // An answer set in one test must not carry into the next.
  mockRequest.mockReset();
  mockNav.canGoBack.mockReturnValue(true);
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** Presses "Ask to delete my account" and returns the two buttons of the question that follows. */
async function askToDelete(): Promise<{ cancel: AlertButton; confirm: AlertButton }> {
  await fireEvent.press(screen.getByRole('button', { name: 'support.deleteAction' }));
  expect(alertSpy).toHaveBeenCalledTimes(1);
  const [, , buttons] = alertSpy.mock.calls[0];
  const [cancel, confirm] = buttons as AlertButton[];
  return { cancel, confirm };
}

async function confirmDeletion() {
  const { confirm } = await askToDelete();
  await act(async () => {
    confirm.onPress?.();
  });
}

describe('Delete my account', () => {
  test('says what is removed, what must be kept, and what happens next, before anything is sent', async () => {
    await renderInApp(<DeleteAccountScreen />);

    for (const key of ['deleteGoes', 'deleteStays', 'deleteAfter']) {
      expect(screen.getByText(`support.${key}Title`)).toBeOnTheScreen();
      expect(screen.getByText(`support.${key}Body`)).toBeOnTheScreen();
    }
    expect(mockRequest).not.toHaveBeenCalled();
  });

  test('asks once more before sending, with the destructive choice marked', async () => {
    await renderInApp(<DeleteAccountScreen />);

    const { cancel, confirm } = await askToDelete();

    expect(mockRequest).not.toHaveBeenCalled();
    expect(alertSpy.mock.calls[0][0]).toBe('support.deleteConfirmTitle');
    expect(alertSpy.mock.calls[0][1]).toBe('support.deleteConfirmBody');
    expect(cancel.style).toBe('cancel');
    expect(confirm.style).toBe('destructive');
  });

  test('sends nothing when the person cancels', async () => {
    await renderInApp(<DeleteAccountScreen />);

    const { cancel } = await askToDelete();
    await act(async () => {
      cancel.onPress?.();
    });

    expect(mockRequest).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'support.deleteAction' })).toBeOnTheScreen();
  });

  test('says the request was recorded when the server took it', async () => {
    mockRequest.mockResolvedValue({ status: 'requested' });
    await renderInApp(<DeleteAccountScreen />);

    await confirmDeletion();

    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('support.deleteSentBody')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'support.deleteAction' })).toBeNull();
  });

  test('shows whose account it is', async () => {
    await renderInApp(<DeleteAccountScreen />);

    expect(screen.getByText('owner@example.com')).toBeOnTheScreen();
  });

  test('sends one request when the confirmation is pressed twice', async () => {
    let finish: (outcome: { status: 'requested' }) => void = () => {};
    mockRequest.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    await renderInApp(<DeleteAccountScreen />);
    const { confirm } = await askToDelete();

    await act(async () => {
      confirm.onPress?.();
      confirm.onPress?.();
    });

    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'support.deleteAction' })).toBeBusy();

    await act(async () => {
      finish({ status: 'requested' });
    });
    expect(await screen.findByText('support.deleteSentBody')).toBeOnTheScreen();
  });

  test('leaves the screen from Done once the request is recorded', async () => {
    mockRequest.mockResolvedValue({ status: 'requested' });
    await renderInApp(<DeleteAccountScreen />);
    await confirmDeletion();

    await fireEvent.press(await screen.findByRole('button', { name: 'common.done' }));

    expect(mockNav.back).toHaveBeenCalledTimes(1);
  });

  test('clears the failure when a second try succeeds', async () => {
    mockRequest.mockRejectedValueOnce(new Error('deletion_request_failed')).mockResolvedValueOnce({ status: 'requested' });
    await renderInApp(<DeleteAccountScreen />);
    await confirmDeletion();
    expect(await screen.findByText('support.deleteFailed')).toBeOnTheScreen();
    alertSpy.mockClear();

    await confirmDeletion();

    expect(await screen.findByText('support.deleteSentBody')).toBeOnTheScreen();
    expect(screen.queryByText('support.deleteFailed')).toBeNull();
  });

  test('shows how to ask by email when the server does not take the request from the app', async () => {
    mockRequest.mockResolvedValue({ status: 'not_offered' });
    await renderInApp(<DeleteAccountScreen />);

    await confirmDeletion();

    expect(await screen.findByText(`support.deleteByEmailBody {"email":"${SUPPORT_EMAIL}"}`)).toBeOnTheScreen();
    expect(screen.queryByText('support.deleteSentBody')).toBeNull();
  });

  test('opens an email to support from the email route', async () => {
    mockRequest.mockResolvedValue({ status: 'not_offered' });
    await renderInApp(<DeleteAccountScreen />);
    await confirmDeletion();

    await fireEvent.press(await screen.findByRole('button', { name: 'support.deleteByEmailAction' }));

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy.mock.calls[0][0]).toMatch(new RegExp(`^mailto:${SUPPORT_EMAIL.replace('.', '\\.')}\\?subject=`));
  });

  test('shows the address when no mail app can be opened', async () => {
    mockRequest.mockResolvedValue({ status: 'not_offered' });
    openSpy.mockRejectedValue(new Error('no mail app'));
    await renderInApp(<DeleteAccountScreen />);
    await confirmDeletion();
    alertSpy.mockClear();

    await fireEvent.press(await screen.findByRole('button', { name: 'support.deleteByEmailAction' }));

    expect(alertSpy).toHaveBeenCalledWith('support.emailUs', SUPPORT_EMAIL);
  });

  test('says it failed when the request could not be sent, and never that it was recorded', async () => {
    mockRequest.mockRejectedValue(new Error('deletion_request_failed'));
    await renderInApp(<DeleteAccountScreen />);

    await confirmDeletion();

    expect(await screen.findByText('support.deleteFailed')).toBeOnTheScreen();
    expect(screen.queryByText('support.deleteSentBody')).toBeNull();
    expect(screen.getByRole('button', { name: 'support.deleteAction' })).toBeOnTheScreen();
  });

  test('offers the email route beside a failure, so deletion can always be started', async () => {
    mockRequest.mockRejectedValue(new Error('deletion_request_failed'));
    await renderInApp(<DeleteAccountScreen />);
    await confirmDeletion();

    await fireEvent.press(await screen.findByRole('button', { name: 'support.deleteByEmailAction' }));

    expect(await screen.findByText(`support.deleteByEmailBody {"email":"${SUPPORT_EMAIL}"}`)).toBeOnTheScreen();
  });

  test('does not offer the email route before anything has failed', async () => {
    await renderInApp(<DeleteAccountScreen />);

    expect(screen.queryByRole('button', { name: 'support.deleteByEmailAction' })).toBeNull();
  });

  test('"Keep my account" goes back and sends nothing', async () => {
    await renderInApp(<DeleteAccountScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'support.deleteKeep' }));

    expect(mockNav.back).toHaveBeenCalledTimes(1);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  test('"Keep my account" goes Home when there is nothing to go back to', async () => {
    mockNav.canGoBack.mockReturnValue(false);
    await renderInApp(<DeleteAccountScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'support.deleteKeep' }));

    expect(mockNav.back).not.toHaveBeenCalled();
    expect(mockNav.replace).toHaveBeenCalledWith('/');
  });
});
