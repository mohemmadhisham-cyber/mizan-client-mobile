import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { type ReactElement } from 'react';

import AccountantRequestScreen from '@/app/approvals/[id]';
import { type AccountantRequest, decideRequest, listPendingRequests } from '@/services/accountant-requests';
import { renderInApp } from '@/test/render';

const REQUEST_ID = '3f2c1a9e-0b7d-4c5e-9a1f-2d3e4f5a6b7c';
const mockNav = { back: jest.fn(), push: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) };

jest.mock('expo-router', () => ({
  DefaultTheme: { colors: {}, fonts: {} },
  useRouter: () => mockNav,
  useLocalSearchParams: () => ({ id: '3f2c1a9e-0b7d-4c5e-9a1f-2d3e4f5a6b7c' }),
}));
jest.mock('@/lib/env', () => ({ assertSupabaseConfigured: jest.fn(), EXPO_PUBLIC_WEB_APP_URL: 'https://mizan.team' }));
jest.mock('@/i18n', () => ({
  __esModule: true,
  default: { t: (key: string) => key, language: 'en' },
  currentLocale: () => 'en',
}));
jest.mock('@/components/tasks/step-up-modal', () => ({ StepUpModal: () => null }));
jest.mock('@/services/accountant-requests', () => {
  const actual = jest.requireActual('@/services/accountant-requests');
  return { ...actual, listPendingRequests: jest.fn(), decideRequest: jest.fn() };
});

const mockList = listPendingRequests as jest.MockedFunction<typeof listPendingRequests>;
const mockDecide = decideRequest as jest.MockedFunction<typeof decideRequest>;

const request: AccountantRequest = {
  id: REQUEST_ID,
  kind: 'set_prices',
  title: 'New prices',
  sentAt: '2026-11-26T10:00:00Z',
  changes: [
    { id: 11, label: 'Latte', from: 1800, to: 2000 },
    { id: 12, label: 'Mocha', from: 1900, to: 2100 },
    { id: 13, label: 'Tea', from: 900, to: 1000 },
  ],
};

function renderScreen(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return renderInApp(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockList.mockResolvedValue({ requests: [request], unreadable: 0 });
});

describe('approving a price change line by line', () => {
  test('every line starts approved, and approving sends the whole request as before', async () => {
    mockDecide.mockResolvedValue({ status: 'applied' });

    await renderScreen(<AccountantRequestScreen />);
    const lines = await screen.findAllByRole('checkbox');
    expect(lines).toHaveLength(3);
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'requests.approve' }));
    });

    expect(mockDecide).toHaveBeenCalledWith(REQUEST_ID, 'approve', undefined, null);
    expect(await screen.findByText('requests.appliedTitle')).toBeOnTheScreen();
  });

  test('a kept line, with its reason, is sent; "2 of 3" is said only from the answer', async () => {
    mockDecide.mockResolvedValue({ status: 'applied', approved: 2, of: 3, notWritten: [] });

    await renderScreen(<AccountantRequestScreen />);
    await fireEvent.press((await screen.findAllByRole('checkbox'))[1]);
    await fireEvent.changeText(screen.getByPlaceholderText('requests.keptReasonPlaceholder'), 'Too soon');
    const approve = screen.getByRole('button', { name: `requests.approveSome ${JSON.stringify({ approved: 2, of: 3 })}` });
    await act(async () => {
      fireEvent.press(approve);
    });

    expect(mockDecide).toHaveBeenCalledWith(REQUEST_ID, 'approve', undefined, { items: [11, 13], keptReasons: { '12': 'Too soon' } });
    expect(await screen.findByText(`requests.partialTitle ${JSON.stringify({ approved: 2, of: 3 })}`)).toBeOnTheScreen();
  });

  test('with no line chosen, approving is not offered', async () => {
    await renderScreen(<AccountantRequestScreen />);
    for (const line of await screen.findAllByRole('checkbox')) await fireEvent.press(line);

    expect(screen.getByText('requests.linesNoneChosen')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: `requests.approveSome ${JSON.stringify({ approved: 0, of: 3 })}` }));
    expect(mockDecide).not.toHaveBeenCalled();
  });

  test('a refusal for variants of one product is explained', async () => {
    mockDecide.mockResolvedValue({ status: 'error', code: 'same_product' });

    await renderScreen(<AccountantRequestScreen />);
    await fireEvent.press((await screen.findAllByRole('checkbox'))[0]);
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: `requests.approveSome ${JSON.stringify({ approved: 2, of: 3 })}` }));
    });

    expect(await screen.findByText('requests.errSameProduct')).toBeOnTheScreen();
  });
});
