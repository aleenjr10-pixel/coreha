import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// When "Remember me" is off, the session lives in memory only and is gone on restart.
let persistAuthSession = true;

export function setPersistAuthSession(value: boolean) {
  persistAuthSession = value;
}

const authStorage = {
  getItem: (key: string) => (persistAuthSession ? AsyncStorage.getItem(key) : Promise.resolve(null)),
  setItem: async (key: string, value: string) => {
    if (persistAuthSession) {
      await AsyncStorage.setItem(key, value);
    }
  },
  removeItem: (key: string) => AsyncStorage.removeItem(key),
};

export const supabase =
  supabaseUrl && supabasePublishableKey
    ? createClient(supabaseUrl, supabasePublishableKey, {
        auth: {
          storage: authStorage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      })
    : null;

export const missingConfigMessage =
  'Missing Supabase config. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to your environment.';

export function requireSupabase() {
  if (!supabase) {
    throw new Error(missingConfigMessage);
  }
  return supabase;
}

export function errorMessage(err: unknown, fallback: string) {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') return err.message;
  return fallback;
}
