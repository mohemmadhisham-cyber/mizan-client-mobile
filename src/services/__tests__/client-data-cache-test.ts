import { clearDashboardCache, clientDataService, fetchDashboardAnswer } from '@/services/client-data';

const mockInvoke = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));
jest.mock('@/i18n', () => ({ __esModule: true, default: { t: (key: string) => key }, currentLocale: () => 'en' }));

/** One person's dashboard, told apart by its cash figure and its first customer. */
function dashboardOf(person: string, cash: number) {
  return {
    ok: true,
    currency: 'AED',
    topCustomers: [{ name: `${person}'s customer`, amount: 1 }],
    mobile: { cash, moneyIn: 0, moneyOut: 0, profit: 0, vatDue: 0, vatDueDate: '', currency: 'AED', revenueSeries: [], expenseSeries: [] },
  };
}

function serverAnswers(data: unknown) {
  mockInvoke.mockResolvedValueOnce({ data, error: null });
}

/** An answer that arrives only when the test says so. */
function serverAnswersLater() {
  let arrive: (data: unknown) => void = () => {};
  mockInvoke.mockReturnValueOnce(new Promise((resolve) => (arrive = (data) => resolve({ data, error: null }))));
  return (data: unknown) => arrive(data);
}

beforeEach(() => {
  mockInvoke.mockReset();
  clearDashboardCache();
});

describe('the dashboard cache', () => {
  test('asks the server once for the summary and the detail', async () => {
    serverAnswers(dashboardOf('A', 100));

    const kpis = await clientDataService.getKpis();
    const answer = await fetchDashboardAnswer();

    expect(kpis.cash).toBe(100);
    expect(answer).toMatchObject({ topCustomers: [{ name: "A's customer" }] });
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  test('shares one request between callers that arrive while it is in the air', async () => {
    const arrive = serverAnswersLater();

    const first = clientDataService.getKpis();
    const second = fetchDashboardAnswer();
    arrive(dashboardOf('A', 100));
    await Promise.all([first, second]);

    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  test('goes back to the server after a clear', async () => {
    serverAnswers(dashboardOf('A', 100));
    await clientDataService.getKpis();
    clearDashboardCache();
    serverAnswers(dashboardOf('A', 250));

    expect((await clientDataService.getKpis()).cash).toBe(250);
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });
});

describe('when the signed-in person changes', () => {
  test('the next person is never shown the last person’s figures, customers or invoices', async () => {
    serverAnswers(dashboardOf('A', 100));
    await clientDataService.getKpis();

    // A signs out, B signs in: the app clears the cache.
    clearDashboardCache();
    serverAnswers(dashboardOf('B', 999));

    expect((await clientDataService.getKpis()).cash).toBe(999);
    expect(await fetchDashboardAnswer()).toMatchObject({ topCustomers: [{ name: "B's customer" }] });
  });

  test('a request the last person left in the air is not given to the next person', async () => {
    const arriveForA = serverAnswersLater();
    const forA = clientDataService.getKpis();

    // A signs out while their request is still in the air; B signs in.
    clearDashboardCache();
    serverAnswers(dashboardOf('B', 999));
    const forB = clientDataService.getKpis();

    arriveForA(dashboardOf('A', 100));
    await forA;

    expect((await forB).cash).toBe(999);
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });

  test('an answer that arrives late for the last person is not kept for the next read', async () => {
    const arriveForA = serverAnswersLater();
    const forA = clientDataService.getKpis();
    clearDashboardCache();

    arriveForA(dashboardOf('A', 100));
    await forA;
    serverAnswers(dashboardOf('B', 999));

    // Nothing of A's was cached: this read goes to the server.
    expect(await fetchDashboardAnswer()).toMatchObject({ topCustomers: [{ name: "B's customer" }] });
  });
});
