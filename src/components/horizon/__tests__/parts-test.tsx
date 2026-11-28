import { fireEvent, screen } from '@testing-library/react-native';
import { View } from 'react-native';

import { Cta } from '@/components/horizon/cta';
import { ChoiceRow, RuledRow } from '@/components/horizon/ruled';
import { WordTabs } from '@/components/horizon/word-tabs';
import { renderInApp } from '@/test/render';

jest.mock('expo-router', () => ({ DefaultTheme: { colors: {}, fonts: {} } }));

describe('Cta', () => {
  test('runs its action when pressed', async () => {
    const onPress = jest.fn();
    await renderInApp(<Cta title="Send" onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Send' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('ignores a press while disabled, and says so to a screen reader', async () => {
    const onPress = jest.fn();
    await renderInApp(<Cta title="Send" onPress={onPress} disabled />);

    const button = screen.getByRole('button', { name: 'Send' });
    await fireEvent.press(button);

    expect(onPress).not.toHaveBeenCalled();
    expect(button).toBeDisabled();
  });

  test('ignores a press while busy, and keeps its name while the spinner shows', async () => {
    const onPress = jest.fn();
    await renderInApp(<Cta title="Send" onPress={onPress} busy />);

    const button = screen.getByRole('button', { name: 'Send' });
    await fireEvent.press(button);

    expect(onPress).not.toHaveBeenCalled();
    expect(button).toBeBusy();
    expect(screen.queryByText('Send')).toBeNull();
  });
});

describe('RuledRow', () => {
  test('is a button that reads its title, its quiet line and its action', async () => {
    const onPress = jest.fn();
    await renderInApp(<RuledRow title="VAT return" meta="Due in 3 days" action="Review" onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button', { name: 'VAT return. Due in 3 days. Review' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('is not a button when there is nothing to open', async () => {
    await renderInApp(<RuledRow title="Nothing scheduled" />);

    expect(screen.getByText('Nothing scheduled')).toBeOnTheScreen();
    expect(screen.queryByRole('button')).toBeNull();
  });

  test('shows what it is given at its end', async () => {
    await renderInApp(<RuledRow title="Invoice" end={<View testID="amount" />} />);

    expect(screen.getByTestId('amount')).toBeOnTheScreen();
  });
});

describe('ChoiceRow', () => {
  test('says which option is chosen', async () => {
    await renderInApp(
      <>
        <ChoiceRow title="English" selected onPress={jest.fn()} />
        <ChoiceRow title="Arabic" selected={false} onPress={jest.fn()} />
      </>,
    );

    expect(screen.getByRole('radio', { name: 'English' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Arabic' })).not.toBeChecked();
  });

  test('chooses its option when pressed', async () => {
    const onPress = jest.fn();
    await renderInApp(<ChoiceRow title="Arabic" selected={false} onPress={onPress} />);

    await fireEvent.press(screen.getByRole('radio', { name: 'Arabic' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('WordTabs', () => {
  const options = [
    { key: 'all', label: 'All' },
    { key: 'system', label: 'System' },
  ] as const;

  test('says which word is chosen', async () => {
    await renderInApp(<WordTabs options={options} value="all" onChange={jest.fn()} />);

    expect(screen.getByRole('tab', { name: 'All' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'System' })).not.toBeSelected();
  });

  test('reports the key of the word that was pressed', async () => {
    const onChange = jest.fn();
    await renderInApp(<WordTabs options={options} value="all" onChange={onChange} />);

    await fireEvent.press(screen.getByRole('tab', { name: 'System' }));

    expect(onChange).toHaveBeenCalledWith('system');
  });
});
