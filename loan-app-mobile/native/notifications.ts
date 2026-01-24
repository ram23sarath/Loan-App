/**
 * Push Notifications Module
 * 
 * Handles registering for push notifications, getting the Expo push token,
 * and storing it in Supabase via authenticated RPC (no service-role key).
 * 
 * SECURITY: Never embed service-role keys. Token registration uses the
 * user's authenticated session to call a Supabase RPC function.
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import {
    requestNotificationPermission,
    setupNotificationChannel,
    checkNotificationPermission,
} from './permissions';

// ============================================================================
// NOTIFICATION HANDLER CONFIGURATION
// ============================================================================

/**
 * Configure how notifications are displayed when app is in foreground
 * Call this during app initialization
 */
export function configureNotificationHandler(): void {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: true,
            shouldShowList: true,
        }),
    });
}

// ============================================================================
// PUSH TOKEN REGISTRATION
// ============================================================================

export interface PushTokenResult {
    success: boolean;
    token?: string;
    error?: string;
    platform: 'ios' | 'android' | 'unknown';
}

/**
 * Get the Expo push token for this device
 * Returns null if not on a physical device or permission denied
 */
export async function getExpoPushToken(): Promise<PushTokenResult> {
    // Check if on physical device
    if (!Device.isDevice) {
        return {
            success: false,
            error: 'Push notifications require a physical device. Running on simulator/emulator.',
            platform: Platform.OS as 'ios' | 'android' | 'unknown',
        };
    }

    // Set up Android notification channel first
    await setupNotificationChannel();

    // Check/request permission
    const permission = await requestNotificationPermission();

    if (!permission.granted) {
        return {
            success: false,
            error: 'Push notification permission not granted',
            platform: Platform.OS as 'ios' | 'android' | 'unknown',
        };
    }

    try {
        // Get the push token
        const projectId = Constants.expoConfig?.extra?.eas?.projectId;

        if (!projectId) {
            console.warn('[Notifications] No EAS project ID found. Using default.');
        }

        const tokenData = await Notifications.getExpoPushTokenAsync({
            projectId: projectId || undefined,
        });

        return {
            success: true,
            token: tokenData.data,
            platform: Platform.OS as 'ios' | 'android' | 'unknown',
        };
    } catch (error) {
        console.error('[Notifications] Failed to get push token:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error getting push token',
            platform: Platform.OS as 'ios' | 'android' | 'unknown',
        };
    }
}

// ============================================================================
// NOTIFICATION LISTENERS
// ============================================================================

export interface NotificationListener {
    remove: () => void;
}

/**
 * Set up listener for when a notification is received while app is foregrounded
 */
export function addNotificationReceivedListener(
    callback: (notification: Notifications.Notification) => void
): NotificationListener {
    const subscription = Notifications.addNotificationReceivedListener(callback);
    return { remove: () => subscription.remove() };
}

/**
 * Set up listener for when user taps on a notification
 */
export function addNotificationResponseListener(
    callback: (response: Notifications.NotificationResponse) => void
): NotificationListener {
    const subscription = Notifications.addNotificationResponseReceivedListener(callback);
    return { remove: () => subscription.remove() };
}

// ============================================================================
// BADGE MANAGEMENT
// ============================================================================

/**
 * Set the app badge number (iOS/Android)
 */
export async function setBadgeCount(count: number): Promise<boolean> {
    try {
        await Notifications.setBadgeCountAsync(count);
        return true;
    } catch (error) {
        console.error('[Notifications] Failed to set badge count:', error);
        return false;
    }
}

/**
 * Clear the app badge
 */
export async function clearBadge(): Promise<boolean> {
    return setBadgeCount(0);
}

// ============================================================================
// LOCAL NOTIFICATIONS (for testing)
// ============================================================================

/**
 * Schedule a local notification (useful for testing)
 */
export async function scheduleLocalNotification(
    title: string,
    body: string,
    options?: {
        data?: Record<string, unknown>;
        seconds?: number;
        channelId?: string;
    }
): Promise<string | null> {
    try {
        const permission = await checkNotificationPermission();
        if (!permission.granted) {
            console.warn('[Notifications] Cannot schedule notification: permission not granted');
            return null;
        }

        const notificationId = await Notifications.scheduleNotificationAsync({
            content: {
                title,
                body,
                data: options?.data || {},
                ...(Platform.OS === 'android' && options?.channelId
                    ? { channelId: options.channelId }
                    : {}
                ),
            },
            trigger: options?.seconds ? {
                type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                seconds: options.seconds,
                repeats: false,
            } : null,
        });

        return notificationId;
    } catch (error) {
        console.error('[Notifications] Failed to schedule notification:', error);
        return null;
    }
}

// ============================================================================
// SUPABASE PUSH TOKEN STORAGE
// ============================================================================

/**
 * SQL for creating the RPC function in Supabase (run this in Supabase SQL editor):
 * 
 * ```sql
 * -- Function to update user's push token (called from mobile app)
 * CREATE OR REPLACE FUNCTION update_push_token(
 *   p_token TEXT,
 *   p_platform TEXT DEFAULT 'unknown'
 * )
 * RETURNS BOOLEAN
 * LANGUAGE plpgsql
 * SECURITY DEFINER
 * AS $$
 * DECLARE
 *   v_user_id UUID;
 * BEGIN
 *   -- Get the authenticated user's ID
 *   v_user_id := auth.uid();
 *   
 *   IF v_user_id IS NULL THEN
 *     RAISE EXCEPTION 'Not authenticated';
 *   END IF;
 *   
 *   -- Upsert the push token into a user_push_tokens table
 *   -- (You'll need to create this table)
 *   INSERT INTO user_push_tokens (user_id, token, platform, updated_at)
 *   VALUES (v_user_id, p_token, p_platform, NOW())
 *   ON CONFLICT (user_id) 
 *   DO UPDATE SET 
 *     token = EXCLUDED.token,
 *     platform = EXCLUDED.platform,
 *     updated_at = NOW();
 *   
 *   RETURN TRUE;
 * END;
 * $$;
 * 
 * -- Table to store push tokens
 * CREATE TABLE IF NOT EXISTS user_push_tokens (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
 *   token TEXT NOT NULL,
 *   platform TEXT DEFAULT 'unknown',
 *   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
 *   updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
 * );
 * 
 * -- Enable RLS
 * ALTER TABLE user_push_tokens ENABLE ROW LEVEL SECURITY;
 * 
 * -- RLS policy: users can only see their own token
 * CREATE POLICY "Users can view own push token" ON user_push_tokens
 *   FOR SELECT USING (auth.uid() = user_id);
 * 
 * -- RLS policy: users can insert/update their own token  
 * CREATE POLICY "Users can insert own push token" ON user_push_tokens
 *   FOR INSERT WITH CHECK (auth.uid() = user_id);
 * 
 * CREATE POLICY "Users can update own push token" ON user_push_tokens
 *   FOR UPDATE USING (auth.uid() = user_id);
 * ```
 */

export const SUPABASE_PUSH_TOKEN_SETUP_SQL = `
-- Function to update user's push token
CREATE OR REPLACE FUNCTION update_push_token(
  p_token TEXT,
  p_platform TEXT DEFAULT 'unknown'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  INSERT INTO user_push_tokens (user_id, token, platform, updated_at)
  VALUES (v_user_id, p_token, p_platform, NOW())
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    token = EXCLUDED.token,
    platform = EXCLUDED.platform,
    updated_at = NOW();
  
  RETURN TRUE;
END;
$$;

-- Table to store push tokens
CREATE TABLE IF NOT EXISTS user_push_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  token TEXT NOT NULL,
  platform TEXT DEFAULT 'unknown',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE user_push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own push token" ON user_push_tokens
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own push token" ON user_push_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own push token" ON user_push_tokens
  FOR UPDATE USING (auth.uid() = user_id);
`;
