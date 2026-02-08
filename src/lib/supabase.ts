// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './env';
import type { Database } from '../types';

// Create a single supabase client for interacting with your database
// NOTE: Token persistence and refresh behavior:
// - On web: Uses browser localStorage for session persistence
// - In native WebView: Native wrapper persists tokens via SecureStore
//   and provides them on app launch via AUTH_REQUEST/AUTH_TOKEN bridge messages
// - autoRefreshToken is enabled to automatically refresh expiring tokens
// - Error handling in DataContext catches refresh_token_not_found errors
//   and clears invalid sessions, notifying native to clear storage
export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);
