import { useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';

import { useAuth } from '@/lib/auth-context';

/**
 * Routes users based on auth state:
 *  - no session and outside onboarding → send to the onboarding welcome screen
 *  - has a session but still in onboarding → send into the app (tabs)
 * RLS enforces per-tenant data access regardless, so this gate is UX, not the
 * security boundary.
 */
export function useAuthGate() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inOnboarding = segments[0] === '(onboarding)';
    if (!session && !inOnboarding) {
      router.replace('/welcome');
    } else if (session && inOnboarding) {
      router.replace('/');
    }
  }, [session, loading, segments, router]);
}
