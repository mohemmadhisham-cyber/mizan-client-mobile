import { fireEvent, screen } from '@testing-library/react-native';

import { AiConsent } from '@/components/ai-advisor/ai-consent';
import { setAiConsent } from '@/lib/ai-consent';
import { renderInApp } from '@/test/render';

jest.mock('expo-router', () => ({
  DefaultTheme: { colors: {}, fonts: {} },
  useRouter: () => ({ back: jest.fn(), canGoBack: () => true, replace: jest.fn() }),
}));
jest.mock('@/lib/ai-consent', () => ({ setAiConsent: jest.fn() }));

const mockSave = setAiConsent as jest.MockedFunction<typeof setAiConsent>;

beforeEach(() => {
  // An answer set in one test must not carry into the next.
  mockSave.mockReset();
});

function setup() {
  const onAgreed = jest.fn();
  const onDeclined = jest.fn();
  return { onAgreed, onDeclined, ui: <AiConsent userId="user-a" onAgreed={onAgreed} onDeclined={onDeclined} /> };
}

describe('the AI consent screen', () => {
  test('says what leaves the app, where it goes, what the answers are worth, and that it is a choice', async () => {
    const { ui } = setup();

    await renderInApp(ui);

    for (const key of ['aiWhat', 'aiWhere', 'aiWorth', 'aiChoice']) {
      expect(screen.getByText(`support.${key}Title`)).toBeOnTheScreen();
      expect(screen.getByText(`support.${key}Body`)).toBeOnTheScreen();
    }
  });

  test('records nothing until the person chooses', async () => {
    const { ui, onAgreed, onDeclined } = setup();

    await renderInApp(ui);

    expect(mockSave).not.toHaveBeenCalled();
    expect(onAgreed).not.toHaveBeenCalled();
    expect(onDeclined).not.toHaveBeenCalled();
  });

  test('saves the agreement for this person, then lets them in', async () => {
    mockSave.mockResolvedValue(true);
    const { ui, onAgreed } = setup();
    await renderInApp(ui);

    await fireEvent.press(screen.getByRole('button', { name: 'support.aiAgree' }));

    expect(mockSave).toHaveBeenCalledWith('user-a', true);
    expect(onAgreed).toHaveBeenCalledTimes(1);
  });

  test('does not let the person in when the agreement could not be saved, and says so', async () => {
    mockSave.mockResolvedValue(false);
    const { ui, onAgreed } = setup();
    await renderInApp(ui);

    await fireEvent.press(screen.getByRole('button', { name: 'support.aiAgree' }));

    expect(onAgreed).not.toHaveBeenCalled();
    expect(await screen.findByText('support.aiSaveFailed')).toBeOnTheScreen();
  });

  test('"Not now" declines and saves nothing', async () => {
    const { ui, onAgreed, onDeclined } = setup();
    await renderInApp(ui);

    await fireEvent.press(screen.getByRole('button', { name: 'support.aiNotNow' }));

    expect(onDeclined).toHaveBeenCalledTimes(1);
    expect(onAgreed).not.toHaveBeenCalled();
    expect(mockSave).not.toHaveBeenCalled();
  });

  test('Back declines too: leaving is never agreement', async () => {
    const { ui, onAgreed, onDeclined } = setup();
    await renderInApp(ui);

    await fireEvent.press(screen.getByRole('button', { name: 'common.back' }));

    expect(onDeclined).toHaveBeenCalledTimes(1);
    expect(onAgreed).not.toHaveBeenCalled();
    expect(mockSave).not.toHaveBeenCalled();
  });
});
