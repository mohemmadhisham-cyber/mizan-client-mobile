/**
 * Client-safe environment.
 *
 * Only EXPO_PUBLIC_* vars are inlined into the app bundle by Expo. NEVER put a
 * service-role key, Claude key, Stripe secret, or any other secret here — those
 * live ONLY in Supabase edge functions. See the platform CLAUDE.md §8.
 */

export const EXPO_PUBLIC_SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const EXPO_PUBLIC_SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** Web app base URL — used to open browser-based flows (e.g. a renewal
 * payment link) that this native app doesn't render itself. Not a secret. */
export const EXPO_PUBLIC_WEB_APP_URL = process.env.EXPO_PUBLIC_WEB_APP_URL ?? 'https://mizan.team';

export const isSupabaseConfigured =
  EXPO_PUBLIC_SUPABASE_URL.length > 0 && EXPO_PUBLIC_SUPABASE_ANON_KEY.length > 0;

/**
 * Throw a clear, actionable error when a Supabase-backed call is attempted
 * before the app is configured. Call this at the data-layer boundary, not at
 * module load, so the app still boots into a friendly "not configured" state.
 */
export function assertSupabaseConfigured(): void {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase is not configured. Copy .env.example to .env and set ' +
        'EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }
}
