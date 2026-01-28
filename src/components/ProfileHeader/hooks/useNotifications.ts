import { useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';

export interface Notification {
    id: number | string;
    message: string;
    status: 'success' | 'processing' | 'warning' | 'error';
    created_at: string;
    isLocal?: boolean;
}

export interface UseNotificationsReturn {
    notifications: Notification[];
    notificationLoading: boolean;
    isClearing: boolean;
    deletingNotificationId: number | string | null;
    swipedNotificationId: number | string | null;
    swipeDirection: 'left' | 'right' | null;
    fetchNotifications: () => Promise<void>;
    deleteNotification: (id: number | string) => Promise<void>;
    clearAllNotifications: () => Promise<void>;
    setSwipedNotificationId: (id: number | string | null) => void;
    setSwipeDirection: (dir: 'left' | 'right' | null) => void;
}

export function useNotifications(isScopedCustomer: boolean): UseNotificationsReturn {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [notificationLoading, setNotificationLoading] = useState(false);
    const [isClearing, setIsClearing] = useState(false);
    const [deletingNotificationId, setDeletingNotificationId] = useState<number | string | null>(null);
    const [swipedNotificationId, setSwipedNotificationId] = useState<number | string | null>(null);
    const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);

    const fetchNotifications = useCallback(async () => {
        setNotificationLoading(true);

        try {
            const { data, error } = await supabase
                .from('system_notifications')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) {
                console.warn("Could not fetch notifications (table might be missing)", error);
                setNotifications([]);
            } else {
                setNotifications(data || []);
            }
        } catch (error) {
            console.error("Error fetching notifications", error);
            setNotifications([]);
        } finally {
            setNotificationLoading(false);
        }
    }, []);

    const deleteNotification = useCallback(async (notificationId: number | string) => {
        if (isScopedCustomer) return;

        setDeletingNotificationId(notificationId);

        try {
            // Trigger animation first (wait for swipe or shake animation)
            const animationDuration = swipedNotificationId === notificationId ? 300 : 600;
            await new Promise(r => setTimeout(r, animationDuration));

            if (notificationId) {
                // Delete from DB
                const { error } = await supabase
                    .from('system_notifications')
                    .delete()
                    .eq('id', notificationId.toString());

                if (error) throw error;
            }

            // Remove from local state
            setNotifications(prev => prev.filter(n => n.id !== notificationId));
        } catch (err) {
            console.error("Failed to delete notification:", err);
            setDeletingNotificationId(null);
        } finally {
            setSwipedNotificationId(null);
            setSwipeDirection(null);
        }
    }, [isScopedCustomer, swipedNotificationId]);

    const clearAllNotifications = useCallback(async () => {
        if (notifications.length === 0 || isClearing || isScopedCustomer) return;

        setIsClearing(true);

        try {
            // Trigger animations first (wait 1.5s for "snap" effect)
            await new Promise(r => setTimeout(r, 1500));

            // Delete from DB: collect IDs
            const dbIDs = notifications
                .map(n => n.id)
                .filter(id => id !== null && id !== undefined);

            // Delete database notifications
            if (dbIDs.length > 0) {
                const { error } = await supabase
                    .from('system_notifications')
                    .delete()
                    .in('id', dbIDs);

                if (error) throw error;
            }

            setNotifications([]);
        } catch (err) {
            console.error("Failed to clear notifications:", err);
        } finally {
            setIsClearing(false);
        }
    }, [notifications, isClearing, isScopedCustomer]);

    return {
        notifications,
        notificationLoading,
        isClearing,
        deletingNotificationId,
        swipedNotificationId,
        swipeDirection,
        fetchNotifications,
        deleteNotification,
        clearAllNotifications,
        setSwipedNotificationId,
        setSwipeDirection,
    };
}
