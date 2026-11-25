import { act, fireEvent, screen } from '@testing-library/react-native';
import { Alert, BackHandler, Linking } from 'react-native';

import { UpdateRequiredScreen } from '@/components/support/update-required-screen';
import { renderInApp } from '@/test/render';

const STORE = 'https://apps.apple.com/app/id123456789';

let openSpy: jest.SpiedFunction<typeof Linking.openURL>;
let alertSpy: jest.SpiedFunction<typeof Alert.alert>;

beforeEach(() => {
  openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('the update screen', () => {
  test('says the app must be updated and opens the store page', async () => {
    await renderInApp(<UpdateRequiredScreen storeUrl={STORE} />);
    expect(screen.getByText('update.body')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'update.action' }));

    expect(openSpy).toHaveBeenCalledWith(STORE);
    expect(alertSpy).not.toHaveBeenCalled();
  });

  test('says where to update when the store page will not open', async () => {
    openSpy.mockRejectedValue(new Error('no handler'));
    await renderInApp(<UpdateRequiredScreen storeUrl={STORE} />);

    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'update.action' }));
    });

    expect(alertSpy).toHaveBeenCalledWith('update.openFailedTitle', 'update.noLink');
  });

  test('with no store page to open, says where to update and offers no button', async () => {
    await renderInApp(<UpdateRequiredScreen storeUrl={null} />);

    expect(screen.getByText('update.noLink')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(openSpy).not.toHaveBeenCalled();
  });

  test('offers no way past it: there is nothing to press but the update', async () => {
    await renderInApp(<UpdateRequiredScreen storeUrl={STORE} />);

    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  test('swallows the phone’s back button, so the screens underneath do not move', async () => {
    const back = jest.spyOn(BackHandler, 'addEventListener');
    await renderInApp(<UpdateRequiredScreen storeUrl={STORE} />);

    const [event, handler] = back.mock.calls[0];
    expect(event).toBe('hardwareBackPress');
    expect((handler as () => boolean)()).toBe(true);
  });
});
