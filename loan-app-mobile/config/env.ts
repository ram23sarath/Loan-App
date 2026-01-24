/**
 * Environment Configuration
 * 
 * Provides environment-based URL switching for production, staging, and development.
 * The app automatically detects the environment based on Expo constants.
 */

import Constants from 'expo-constants';

// Environment types
export type Environment = 'development' | 'staging' | 'production';

// Environment configuration
interface EnvConfig {
    webUrl: string;
    supabaseUrl: string;
    supabaseAnonKey: string;
}

// Environment configurations
const ENV_CONFIG: Record<Environment, EnvConfig> = {
    production: {
        webUrl: 'https://welfare-ctr.netlify.app',
        supabaseUrl: 'https://lhffcmefliaptsijuyay.supabase.co',
        supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoZmZjbWVmbGlhcHRzaWp1eWF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4NjAxOTMsImV4cCI6MjA2OTQzNjE5M30.HKGrEokNOl6EJnClwTZ-oITGLkZhoIzpQ4sda2JeCxw',
    },
    staging: {
        webUrl: 'https://welfare-ctr.netlify.app',
        supabaseUrl: 'https://lhffcmefliaptsijuyay.supabase.co',
        supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoZmZjbWVmbGlhcHRzaWp1eWF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4NjAxOTMsImV4cCI6MjA2OTQzNjE5M30.HKGrEokNOl6EJnClwTZ-oITGLkZhoIzpQ4sda2JeCxw',
    },
    development: {
        // For local development, use your local Vite dev server
        // Update this IP to your machine's local IP for testing on physical devices
        // webUrl: 'http://localhost:5173',
        webUrl: 'https://welfare-ctr.netlify.app', // Using staging for testing wrapper
        supabaseUrl: 'https://lhffcmefliaptsijuyay.supabase.co',
        supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoZmZjbWVmbGlhcHRzaWp1eWF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4NjAxOTMsImV4cCI6MjA2OTQzNjE5M30.HKGrEokNOl6EJnClwTZ-oITGLkZhoIzpQ4sda2JeCxw',
    },
};

/**
 * Detect current environment based on Expo release channel or app variant
 */
function getEnvironment(): Environment {
    // Check for explicit environment override in extra config
    const extraEnv = Constants.expoConfig?.extra?.environment as Environment | undefined;
    if (extraEnv && ENV_CONFIG[extraEnv]) {
        return extraEnv;
    }

    // Check EAS build profile
    const easProfile = Constants.expoConfig?.extra?.eas?.profile as string | undefined;
    if (easProfile === 'production') return 'production';
    if (easProfile === 'preview' || easProfile === 'staging') return 'staging';

    // Default to development for local dev
    if (__DEV__) {
        return 'development';
    }

    // Default to production for release builds
    return 'production';
}

// Current environment
export const ENVIRONMENT = getEnvironment();

// Export config for current environment
export const config = ENV_CONFIG[ENVIRONMENT];

// Convenience exports
export const WEB_APP_URL = config.webUrl;
export const SUPABASE_URL = config.supabaseUrl;
export const SUPABASE_ANON_KEY = config.supabaseAnonKey;

// Debug helper (only logs in development)
if (__DEV__) {
    console.log(`[ENV] Running in ${ENVIRONMENT} mode`);
    console.log(`[ENV] Web URL: ${WEB_APP_URL}`);
}
