/**
 * Secure Token Storage
 * 
 * Provides secure persistent storage for auth tokens using Expo SecureStore.
 * This ensures tokens survive app restarts and are available for the WebView.
 */

import * as SecureStore from 'expo-secure-store';
import type { AuthSession } from './bridge';

const AUTH_SESSION_KEY = 'loan_app_auth_session';
const LANDING_SCREEN_SEEN_KEY = 'loan_app_landing_screen_seen';

/**
 * Save auth session to secure storage
 */
export async function saveAuthSession(session: AuthSession): Promise<void> {
  try {
    const serialized = JSON.stringify(session);
    await SecureStore.setItemAsync(AUTH_SESSION_KEY, serialized);
    console.log('[Storage] Auth session saved to secure storage');
  } catch (error) {
    console.error('[Storage] Failed to save auth session:', error);
    throw error;
  }
}

/**
 * Load auth session from secure storage
 */
export async function loadAuthSession(): Promise<AuthSession | null> {
  try {
    const serialized = await SecureStore.getItemAsync(AUTH_SESSION_KEY);
    if (!serialized) {
      console.log('[Storage] No auth session found in secure storage');
      return null;
    }
    
    const session = JSON.parse(serialized) as AuthSession;
    
    // Check if session is expired
    const now = Math.floor(Date.now() / 1000);
    if (session.expiresAt && session.expiresAt < now) {
      console.log('[Storage] Auth session expired, clearing storage');
      await clearAuthSession();
      return null;
    }
    
    console.log('[Storage] Auth session loaded from secure storage');
    return session;
  } catch (error) {
    console.error('[Storage] Failed to load auth session:', error);
    return null;
  }
}

/**
 * Clear auth session from secure storage
 */
export async function clearAuthSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(AUTH_SESSION_KEY);
    console.log('[Storage] Auth session cleared from secure storage');
  } catch (error) {
    console.error('[Storage] Failed to clear auth session:', error);
    throw error;
  }
}

/**
 * Check if auth session exists in storage
 */
export async function hasAuthSession(): Promise<boolean> {
  try {
    const serialized = await SecureStore.getItemAsync(AUTH_SESSION_KEY);
    return !!serialized;
  } catch (error) {
    console.error('[Storage] Failed to check auth session:', error);
    return false;
  }
}

/**
 * Mark landing screen as seen (user has dismissed it at least once)
 */
export async function saveLandingScreenSeen(): Promise<void> {
  try {
    await SecureStore.setItemAsync(LANDING_SCREEN_SEEN_KEY, 'true');
    console.log('[Storage] Landing screen marked as seen');
  } catch (error) {
    console.error('[Storage] Failed to save landing screen state:', error);
    // Non-critical: don't throw, just log the error
  }
}

/**
 * Check if landing screen has been seen before
 */
export async function hasSeenLandingScreen(): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(LANDING_SCREEN_SEEN_KEY);
    return value === 'true';
  } catch (error) {
    console.error('[Storage] Failed to check landing screen state:', error);
    // Default to false (show landing) if there's an error
    return false;
  }
}
