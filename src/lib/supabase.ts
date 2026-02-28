// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './env';
import type { Database } from '../types';

const SUPABASE_HOST = new URL(SUPABASE_URL).host;
const shouldProxySupabase = import.meta.env.PROD;

const getProxyPath = (url: URL): string | null => {
  if (url.host !== SUPABASE_HOST) {
    return null;
  }

  if (url.pathname.startsWith('/auth/v1/')) {
    const path = url.pathname.replace('/auth/v1/', '');
    const query = new URLSearchParams(url.search);
    query.set('path', path);
    return `/.netlify/functions/supabase-auth?${query.toString()}`;
  }

  if (url.pathname.startsWith('/rest/v1/')) {
    const path = url.pathname.replace('/rest/v1/', '');
    const query = new URLSearchParams(url.search);
    query.set('path', path);
    return `/.netlify/functions/supabase-rest?${query.toString()}`;
  }

  return null;
};

const supabaseFetch: typeof fetch = async (input, init) => {
  if (!shouldProxySupabase) {
    return fetch(input, init);
  }

  const inputUrl =
    typeof input === 'string'
      ? new URL(input)
      : input instanceof URL
      ? input
      : new URL(input.url);

  const proxyPath = getProxyPath(inputUrl);

  if (!proxyPath) {
    return fetch(input, init);
  }

  if (input instanceof Request) {
    return fetch(new Request(proxyPath, input), init);
  }

  return fetch(proxyPath, init);
};

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
    global: {
      fetch: supabaseFetch,
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    realtime: {
      heartbeatIntervalMs: 30000,
      timeout: 15000,
    },
  }
);
