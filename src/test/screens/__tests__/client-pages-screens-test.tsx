import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { openBrowserAsync } from 'expo-web-browser';
import { type ReactElement } from 'react';

import BookMeetingScreen from '@/app/book-meeting';
import InvoicesToPayScreen from '@/app/invoices-to-pay';
import ServicesScreen from '@/app/services';
import {
  bookMeeting,
  type ClientInvoice,
  getClientInvoices,
  getClientServices,
  getMeetingSlots,
} from '@/services/client-pages';
import { renderInApp } from '@/test/render';

const mockNav = { back: jest.fn(), push: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) };

jest.mock('expo-router', () => ({
  DefaultTheme: { colors: {}, fonts: {} },
  useRouter: () => mockNav,
}));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn(() => Promise.resolve({ type: 'dismiss' })) }));
jest.mock('@/lib/auth-context', () => ({ useAuth: () => ({ user: { id: 'user-a' }, clientId: 'client-a', firmId: 'firm-a' }) }));
jest.mock('@/lib/env', () => ({ assertSupabaseConfigured: jest.fn(), EXPO_PUBLIC_WEB_APP_URL: 'https://mizan.team' }));
jest.mock('@/i18n', () => ({
  __esModule: true,
  default: { t: (key: string) => key, language: 'en' },
  currentLocale: () => 'en',
}));
jest.mock('@/services/client-pages', () => {
  const actual = jest.requireActual('@/services/client-pages');
  return {
    ...actual,
    getClientServices: jest.fn(),
    getClientInvoices: jest.fn(),
    getMeetingSlots: jest.fn(),
    bookMeeting: jest.fn(),
  };
});

const mockServices = getClientServices as jest.MockedFunction<typeof getClientServices>;
const mockInvoices = getClientInvoices as jest.MockedFunction<typeof getClientInvoices>;
const mockSlots = getMeetingSlots as jest.MockedFunction<typeof getMeetingSlots>;
const mockBook = bookMeeting as jest.MockedFunction<typeof bookMeeting>;
const mockOpen = openBrowserAsync as jest.MockedFunction<typeof openBrowserAsync>;

const TOKEN = '3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b';

function renderScreen(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return renderInApp(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const invoice = (over: Partial<ClientInvoice> = {}): ClientInvoice => ({
  id: 'p1',
  description: 'Invoice 12',
  amountMinor: 105000,
  currency: 'AED',
  state: 'due',
  createdAt: '2026-11-20T09:00:00Z',
  paidAt: null,
  payToken: TOKEN,
  payUntil: null,
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Your services', () => {
  test('lists the services of each engagement with their price and how often', async () => {
    mockServices.mockResolvedValue({
      status: 'ok',
      value: {
        firm: 'Acme Accounting',
        engagements: [{ id: 'e1', name: 'Monthly books', status: 'active', periodStart: null, periodEnd: null }],
        services: [
          { id: 's1', nameEn: 'Bookkeeping', nameAr: 'مسك الدفاتر', cadence: 'monthly', priceMinor: 150000, currency: 'AED', engagementId: 'e1', since: null },
        ],
      },
    });

    await renderScreen(<ServicesScreen />);

    expect(await screen.findByText('Bookkeeping')).toBeOnTheScreen();
    expect(screen.getByText('Monthly books')).toBeOnTheScreen();
    expect(screen.getByText('servicesScreen.perMonth')).toBeOnTheScreen();
  });

  test('says so when the server does not offer it yet', async () => {
    mockServices.mockResolvedValue({ status: 'not_offered' });

    await renderScreen(<ServicesScreen />);

    expect(await screen.findByText('servicesScreen.notOffered')).toBeOnTheScreen();
  });

  test('offers to book a meeting to change something', async () => {
    mockServices.mockResolvedValue({ status: 'ok', value: { firm: null, engagements: [], services: [] } });

    await renderScreen(<ServicesScreen />);
    await screen.findByText('servicesScreen.empty');
    await fireEvent.press(screen.getByRole('button', { name: 'servicesScreen.askChange. servicesScreen.book' }));

    expect(mockNav.push).toHaveBeenCalledWith('/book-meeting');
  });
});

describe('Invoices to pay', () => {
  test('a due invoice opens the secure pay page in the browser, and the list is read again after', async () => {
    mockInvoices.mockResolvedValue({ status: 'ok', value: { firm: 'Acme', invoices: [invoice()] } });

    await renderScreen(<InvoicesToPayScreen />);
    const row = await screen.findByRole('button', { name: /Invoice 12/ });
    await act(async () => {
      fireEvent.press(row);
    });

    expect(mockOpen).toHaveBeenCalledWith(`https://mizan.team/pay/${TOKEN}`);
    expect(mockInvoices).toHaveBeenCalledTimes(2);
  });

  test('a paid invoice cannot be paid again', async () => {
    mockInvoices.mockResolvedValue({
      status: 'ok',
      value: { firm: 'Acme', invoices: [invoice({ state: 'paid', payToken: null, paidAt: '2026-11-21T10:00:00Z' })] },
    });

    await renderScreen(<InvoicesToPayScreen />);
    await screen.findByText('Invoice 12');

    expect(screen.queryByRole('button', { name: /Invoice 12/ })).toBeNull();
  });

  test('a due invoice with no link says to ask for one, and opens nothing', async () => {
    mockInvoices.mockResolvedValue({ status: 'ok', value: { firm: 'Acme', invoices: [invoice({ payToken: null })] } });

    await renderScreen(<InvoicesToPayScreen />);

    expect(await screen.findByText(/billsScreen.stateDueNoLink/)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /Invoice 12/ })).toBeNull();
  });

  test('says when there is nothing to pay', async () => {
    mockInvoices.mockResolvedValue({ status: 'ok', value: { firm: null, invoices: [] } });

    await renderScreen(<InvoicesToPayScreen />);

    expect(await screen.findByText('billsScreen.empty')).toBeOnTheScreen();
  });
});

describe('Book a meeting', () => {
  const slots = {
    status: 'ok' as const,
    value: {
      firm: 'Acme',
      minutes: 30,
      timeZone: 'Asia/Dubai',
      accepting: true,
      slots: [
        { date: '2026-12-02', start: '10:00', end: '10:30' },
        { date: '2026-12-02', start: '10:30', end: '11:00' },
      ],
    },
  };
  const slotName = (start: string, end: string) => `meetingScreen.slot ${JSON.stringify({ start, end })}`;

  test('nothing is sent until a time is chosen', async () => {
    mockSlots.mockResolvedValue(slots);

    await renderScreen(<BookMeetingScreen />);
    await screen.findByRole('radio', { name: slotName('10:00', '10:30') });
    await fireEvent.press(screen.getByRole('button', { name: 'meetingScreen.request' }));

    expect(mockBook).not.toHaveBeenCalled();
  });

  test('sends the chosen day, time and note, then says it is a request', async () => {
    mockSlots.mockResolvedValue(slots);
    mockBook.mockResolvedValue({ status: 'requested', date: '2026-12-02', start: '10:30' });

    await renderScreen(<BookMeetingScreen />);
    await fireEvent.press(await screen.findByRole('radio', { name: slotName('10:30', '11:00') }));
    await fireEvent.changeText(screen.getByLabelText('meetingScreen.noteLabel'), 'VAT question');
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'meetingScreen.request' }));
    });

    expect(mockBook).toHaveBeenCalledWith({ date: '2026-12-02', start: '10:30', note: 'VAT question' });
    expect(await screen.findByText('meetingScreen.sentA')).toBeOnTheScreen();
  });

  test('a time someone just took asks for another and reads the slots again', async () => {
    mockSlots.mockResolvedValue(slots);
    mockBook.mockResolvedValue({ status: 'slot_taken' });

    await renderScreen(<BookMeetingScreen />);
    await fireEvent.press(await screen.findByRole('radio', { name: slotName('10:00', '10:30') }));
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'meetingScreen.request' }));
    });

    expect(await screen.findByText('meetingScreen.problem_taken')).toBeOnTheScreen();
    expect(mockSlots).toHaveBeenCalledTimes(2);
  });

  test('a firm not taking requests says so, with no times offered', async () => {
    mockSlots.mockResolvedValue({ ...slots, value: { ...slots.value, accepting: false } });

    await renderScreen(<BookMeetingScreen />);

    expect(await screen.findByText('meetingScreen.notAccepting')).toBeOnTheScreen();
    expect(screen.queryByRole('radio')).toBeNull();
  });
});
