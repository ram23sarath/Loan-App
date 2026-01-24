/**
 * Permissions Utilities
 * 
 * Handles requesting and checking device permissions in a consistent way.
 */

import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform, Alert, Linking } from 'react-native';

// ============================================================================
// PERMISSION STATUS TYPES
// ============================================================================

export interface PermissionStatus {
    granted: boolean;
    canAskAgain: boolean;
    status: 'granted' | 'denied' | 'undetermined';
}

// ============================================================================
// PUSH NOTIFICATION PERMISSIONS
// ============================================================================

/**
 * Check current push notification permission status
 */
export async function checkNotificationPermission(): Promise<PermissionStatus> {
    if (!Device.isDevice) {
        return { granted: false, canAskAgain: false, status: 'denied' };
    }

    const { status } = await Notifications.getPermissionsAsync();

    return {
        granted: status === 'granted',
        canAskAgain: status === 'undetermined',
        status: status as 'granted' | 'denied' | 'undetermined',
    };
}

/**
 * Request push notification permission
 * Returns the new permission status after the request
 */
export async function requestNotificationPermission(): Promise<PermissionStatus> {
    if (!Device.isDevice) {
        console.warn('[Permissions] Push notifications require a physical device');
        return { granted: false, canAskAgain: false, status: 'denied' };
    }

    // Check current status first
    const currentStatus = await checkNotificationPermission();

    // If already granted, return immediately
    if (currentStatus.granted) {
        return currentStatus;
    }

    // If can't ask again, prompt user to go to settings
    if (!currentStatus.canAskAgain && currentStatus.status === 'denied') {
        Alert.alert(
            'Notifications Disabled',
            'Push notifications are disabled. Please enable them in your device settings to receive loan updates.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Open Settings',
                    onPress: () => {
                        if (Platform.OS === 'ios') {
                            Linking.openURL('app-settings:');
                        } else {
                            Linking.openSettings();
                        }
                    }
                },
            ]
        );
        return currentStatus;
    }

    // Request permission
    const { status } = await Notifications.requestPermissionsAsync();

    return {
        granted: status === 'granted',
        canAskAgain: status === 'undetermined',
        status: status as 'granted' | 'denied' | 'undetermined',
    };
}

// ============================================================================
// ANDROID NOTIFICATION CHANNEL
// ============================================================================

/**
 * Set up Android notification channel (required for Android 8+)
 * Call this during app initialization
 */
export async function setupNotificationChannel(): Promise<void> {
    if (Platform.OS !== 'android') return;

    await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4F46E5',
        description: 'Default notification channel for loan updates',
    });

    await Notifications.setNotificationChannelAsync('urgent', {
        name: 'Urgent',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 500, 500],
        lightColor: '#EF4444',
        description: 'Urgent notifications for overdue payments',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
    });
}

// ============================================================================
// DEVICE CHECKS
// ============================================================================

/**
 * Check if running on a physical device (required for push notifications)
 */
export function isPhysicalDevice(): boolean {
    return Device.isDevice;
}

/**
 * Get device type for debugging
 */
export function getDeviceInfo(): {
    isDevice: boolean;
    brand: string | null;
    modelName: string | null;
    osName: string | null;
    osVersion: string | null;
} {
    return {
        isDevice: Device.isDevice,
        brand: Device.brand,
        modelName: Device.modelName,
        osName: Device.osName,
        osVersion: Device.osVersion,
    };
}
