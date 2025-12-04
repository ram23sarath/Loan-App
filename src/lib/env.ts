// src/lib/env.ts
// Environment variables are loaded from .env file via Vite
// VITE_ prefixed variables are exposed to client-side code
// 
// Create a .env file in the project root with:
//   VITE_SUPABASE_URL=your_supabase_url
//   VITE_SUPABASE_ANON_KEY=your_anon_key
//
// Note: The anon key is designed to be public, but keeping it in env vars
// allows for easy configuration across environments without code changes.

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Validate required environment variables
if (!SUPABASE_URL) {
  console.error('Missing VITE_SUPABASE_URL environment variable');
}
if (!SUPABASE_ANON_KEY) {
  console.error('Missing VITE_SUPABASE_ANON_KEY environment variable');
}
