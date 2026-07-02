import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import {
  EXPO_PUBLIC_SUPABASE_ANON_KEY,
  EXPO_PUBLIC_SUPABASE_URL,
  isSupabaseConfigured,
} from './env';
import { LargeSecureStore } from './secure-store';

// Placeholder fallbacks keep createClient from throwing before .env is set.
// Real calls are gated by isSupabaseConfigured in the data/service layer, so an
// unconfigured app boots into a friendly state instead of crashing.
const url = isSupabaseConfigured ? EXPO_PUBLIC_SUPABASE_URL : 'https://placeholder.supabase.co';
const anonKey = isSupabaseConfigured ? EXPO_PUBLIC_SUPABASE_ANON_KEY : 'placeholder-anon-key';

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: LargeSecureStore,
    autoRefreshToken: true,
    persistSession: true,
    // No URL-based session detection on native (deep links handled explicitly).
    detectSessionInUrl: false,
  },
});

// Keep the auth session fresh while the app is foregrounded, per Supabase's
// React Native guidance. No-op on web.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
