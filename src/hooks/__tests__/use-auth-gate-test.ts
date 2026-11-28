import { renderHook } from '@testing-library/react-native';

import { useAuthGate } from '@/hooks/use-auth-gate';

const mockReplace = jest.fn();
const mockRouter = { replace: mockReplace };
const mockRoute: { segments: string[] } = { segments: ['(tabs)'] };

interface GateAuth {
  session: object | null;
  loading: boolean;
  rolesLoading: boolean;
  clientId: string | null;
  clientStatus: string | null;
}

const SIGNED_IN: GateAuth = {
  session: { user: { id: 'user-a' } },
  loading: false,
  rolesLoading: false,
  clientId: 'client-a',
  clientStatus: 'active',
};

const mockAuth: { value: GateAuth } = { value: SIGNED_IN };

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useSegments: () => mockRoute.segments,
}));
jest.mock('@/lib/auth-context', () => ({ useAuth: () => mockAuth.value }));

/** Where the gate sends a person in this state who is on this screen: a route, or null for "stays". */
async function gate(auth: Partial<GateAuth>, segments: string[]): Promise<string | null> {
  mockAuth.value = { ...SIGNED_IN, ...auth };
  mockRoute.segments = segments;
  await renderHook(() => useAuthGate());
  expect(mockReplace.mock.calls.length).toBeLessThanOrEqual(1);
  return mockReplace.mock.calls[0]?.[0] ?? null;
}

const SIGNED_OUT = { session: null, clientId: null, clientStatus: null };
const WAITING = { clientId: null, clientStatus: null };
const SUSPENDED = { clientStatus: 'suspended' };

describe('the auth gate, as things change', () => {
  /** Renders the gate in one state, then moves to another, and gives where that sends the person. */
  async function change(before: Partial<GateAuth>, after: Partial<GateAuth>, segments: string[]) {
    mockAuth.value = { ...SIGNED_IN, ...before };
    mockRoute.segments = segments;
    const { rerender } = await renderHook(() => useAuthGate());
    mockReplace.mockClear();
    mockAuth.value = { ...SIGNED_IN, ...after };
    await rerender(undefined);
    return mockReplace.mock.calls[0]?.[0] ?? null;
  }

  test('lets a waiting person in the moment their company is linked', async () => {
    expect(await change(WAITING, {}, ['pending-approval'])).toBe('/');
  });

  test('sends a person to Welcome the moment their session ends', async () => {
    expect(await change({}, SIGNED_OUT, ['(tabs)'])).toBe('/welcome');
  });

  test('holds a person with no company once the roles have been read', async () => {
    expect(await change({ ...WAITING, rolesLoading: true }, WAITING, ['(tabs)'])).toBe('/pending-approval');
  });

  test('holds a person the moment their company is suspended', async () => {
    expect(await change({}, SUSPENDED, ['(tabs)'])).toBe('/access-suspended');
  });
});

describe('the auth gate', () => {
  test('does nothing while the session is still being read', async () => {
    expect(await gate({ ...SIGNED_OUT, loading: true }, ['(tabs)'])).toBeNull();
  });

  describe('signed out', () => {
    test.each([[['(tabs)']], [['settings']], [['delete-account']], [['approvals', 'some-id']]])(
      'sends %j to the welcome screen',
      async (segments) => {
        expect(await gate(SIGNED_OUT, segments)).toBe('/welcome');
      },
    );

    test('leaves the sign-in screens alone', async () => {
      expect(await gate(SIGNED_OUT, ['(onboarding)', 'email'])).toBeNull();
    });

    test.each([[['pending-approval']], [['access-suspended']]])('is not left on %j', async (segments) => {
      expect(await gate(SIGNED_OUT, segments)).toBe('/welcome');
    });
  });

  describe('signed in with a company', () => {
    test('stays on the app screens', async () => {
      expect(await gate({}, ['(tabs)'])).toBeNull();
      mockReplace.mockClear();
      expect(await gate({}, ['settings'])).toBeNull();
    });

    test('is sent into the app from the sign-in screens', async () => {
      expect(await gate({}, ['(onboarding)', 'verify'])).toBe('/');
    });

    test('leaves the sign-in screens at once, before the roles are read', async () => {
      expect(await gate({ rolesLoading: true }, ['(onboarding)', 'verify'])).toBe('/');
    });

    test.each(['inactive', 'archived', null])('is held only when suspended, not when the status is %s', async (clientStatus) => {
      expect(await gate({ clientStatus }, ['(tabs)'])).toBeNull();
    });

    test('is sent into the app from the waiting screen once the company is linked', async () => {
      expect(await gate({}, ['pending-approval'])).toBe('/');
    });

    test('is sent into the app from the suspended screen once access is back', async () => {
      expect(await gate({}, ['access-suspended'])).toBe('/');
    });
  });

  describe('signed in, waiting for a company', () => {
    test.each([[['(tabs)']], [['settings']], [['help']], [['ai-advisor']], [['approvals', 'some-id']]])(
      'is held on the waiting screen, away from %j',
      async (segments) => {
        expect(await gate(WAITING, segments)).toBe('/pending-approval');
      },
    );

    test('leaves the sign-in screens first: the waiting screen follows from inside the app', async () => {
      expect(await gate(WAITING, ['(onboarding)', 'verify'])).toBe('/');
    });

    test('is waiting, not suspended, when there is no company even if a status says suspended', async () => {
      expect(await gate({ clientId: null, clientStatus: 'suspended' }, ['(tabs)'])).toBe('/pending-approval');
    });

    test('stays on the waiting screen', async () => {
      expect(await gate(WAITING, ['pending-approval'])).toBeNull();
    });

    test('can still reach Delete my account: the stores require it for every account', async () => {
      expect(await gate(WAITING, ['delete-account'])).toBeNull();
    });

    test('is not judged while the roles are still being read', async () => {
      expect(await gate({ ...WAITING, rolesLoading: true }, ['(tabs)'])).toBeNull();
    });
  });

  describe('signed in, company suspended', () => {
    test.each([[['(tabs)']], [['settings']], [['reports']], [['pending-approval']]])(
      'is held on the suspended screen, away from %j',
      async (segments) => {
        expect(await gate(SUSPENDED, segments)).toBe('/access-suspended');
      },
    );

    test('stays on the suspended screen', async () => {
      expect(await gate(SUSPENDED, ['access-suspended'])).toBeNull();
    });

    test('can still reach Delete my account', async () => {
      expect(await gate(SUSPENDED, ['delete-account'])).toBeNull();
    });

    test('is not judged while the roles are still being read', async () => {
      expect(await gate({ ...SUSPENDED, rolesLoading: true }, ['(tabs)'])).toBeNull();
    });
  });
});
