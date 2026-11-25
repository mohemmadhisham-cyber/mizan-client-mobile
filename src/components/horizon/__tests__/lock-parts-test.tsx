import { fireEvent, screen } from '@testing-library/react-native';

import { RuledRow } from '@/components/horizon/ruled';
import { DeclineSheet } from '@/components/requests/decline-sheet';
import { AppLockedContext } from '@/hooks/use-app-lock';
import { renderInApp } from '@/test/render';

jest.mock('expo-local-authentication', () => ({ SecurityLevel: { NONE: 0 } }));

describe('a row that turns something on or off', () => {
  test('is read as a switch that says whether it is on, without the word on the row said twice', async () => {
    const onPress = jest.fn();
    await renderInApp(<RuledRow title="Lock the app" meta="Asks the phone" action="On" checked onPress={onPress} />);

    const row = screen.getByRole('switch', { name: 'Lock the app. Asks the phone' });
    expect(row).toBeChecked();

    await fireEvent.press(row);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('says it is off when it is off', async () => {
    await renderInApp(<RuledRow title="Lock the app" action="Off" checked={false} onPress={() => {}} />);

    expect(screen.getByRole('switch', { name: 'Lock the app' })).not.toBeChecked();
  });

  test('a row that opens something is still a button, with its word read', async () => {
    await renderInApp(<RuledRow title="Backup codes" action="Open" onPress={() => {}} />);

    expect(screen.getByRole('button', { name: 'Backup codes. Open' })).toBeTruthy();
    expect(screen.queryByRole('switch')).toBeNull();
  });
});

describe('a sheet over the app', () => {
  const sheet = (locked: boolean) =>
    renderInApp(
      <AppLockedContext.Provider value={locked}>
        <DeclineSheet visible busy={false} onCancel={() => {}} onDecline={() => {}} />
      </AppLockedContext.Provider>,
    );

  test('is shown while the app is open', async () => {
    await sheet(false);

    expect(screen.queryAllByRole('button').length).toBeGreaterThan(0);
  });

  test('is closed while the app is locked: it would be drawn above the lock', async () => {
    await sheet(true);

    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
