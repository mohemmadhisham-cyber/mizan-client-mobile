import { useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';

import { useAuth } from '@/lib/auth-context';

/**
 * Routes users based on auth state:
 *  - no session and outside onboarding → send to the onboarding welcome screen
 *  - has a session but still in onboarding → send into the app (tabs)
 *  - has a session but no linked client company yet → pending-approval screen
 *    (covers self-serve "Get Started" signups, which never exchange an
 *    invite token, so user_roles.client_id stays null; invite-link signups
 *    already have client_id by the time this runs and skip straight through)
 * RLS enforces per-tenant data access regardless, so this gate is UX, not the
 * security boundary.
 */
export function useAuthGate() {
  const { session, loading, rolesLoading, clientId } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inOnboarding = segments[0] === '(onboarding)';
    const onPendingScreen = segments[0] === 'pending-approval';

    if (!session && !inOnboarding) {
      router.replace('/welcome');
      return;
    }
    if (session && inOnboarding) {
      router.replace('/');
      return;
    }
    if (session && !rolesLoading && !clientId && !inOnboarding && !onPendingScreen) {
      router.replace('/pending-approval');
      return;
    }
    if (session && clientId && onPendingScreen) {
      router.replace('/');
    }
  }, [session, loading, rolesLoading, clientId, segments, router]);
}
