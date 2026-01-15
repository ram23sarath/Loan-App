// src/lib/env.ts
// Supabase configuration
// Note: The anon key is designed to be public (client-side safe).
// It only allows access controlled by Row Level Security (RLS) policies.
//
// These values are loaded from environment variables:
// - VITE_SUPABASE_URL: Your Supabase project URL
// - VITE_SUPABASE_ANON_KEY: Your Supabase anon/public key
//
// For local development, create a .env.local file with these values.
// See .env.example for the required format.

const getEnvVar = (key: string): string => {
    const value = import.meta.env[key];
    if (!value) {
        throw new Error(
            `Missing environment variable: ${key}. ` +
            `Please ensure you have a .env.local file with the required Supabase credentials. ` +
            `See .env.example for the required format.`
        );
    }
    return value;
};

export const SUPABASE_URL = getEnvVar('VITE_SUPABASE_URL');
export const SUPABASE_ANON_KEY = getEnvVar('VITE_SUPABASE_ANON_KEY');
