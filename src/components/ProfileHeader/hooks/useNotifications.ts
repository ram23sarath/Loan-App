import { useState, useCallback, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import {
    NOTIFICATION_FILTER_KEYS,
    NOTIFICATION_STATUSES,
    NOTIFICATION_TYPES,
} from '../../../../shared/notificationSchema.js';

export interface Notification {
    id: number | string;
    message: string;
    status: typeof NOTIFICATION_STATUSES[keyof typeof NOTIFICATION_STATUSES];
    type: typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES];
    created_at: string;
    metadata?: Record<string, any> | null;
    isLocal?: boolean;
}

export interface UseNotificationsReturn {
    notifications: Notification[];
    notificationLoading: boolean;
    hasMoreNotifications: boolean;
    isClearing: boolean;
    deletingNotificationId: number | string | null;
    swipedNotificationId: number | string | null;
    swipeDirection: 'left' | 'right' | null;
    /**
     * Fetch notifications. Returns `true` on success, `false` on failure.
     * If `propagateErrors` is true the function will re-throw on error.
     */
    fetchNotifications: (reset?: boolean, propagateErrors?: boolean) => Promise<boolean>;
    loadMoreNotifications: () => Promise<void>;
    deleteNotification: (id: number | string) => Promise<void>;
    clearAllNotifications: () => Promise<void>;
    setSwipedNotificationId: (id: number | string | null) => void;
    setSwipeDirection: (dir: 'left' | 'right' | null) => void;
    notificationError: string | null;
    setNotificationError: (err: string | null) => void;
}

const PAGE_SIZE = 25;
const MAX_SCAN_PAGES = 5;
const READ_BATCH_SIZE = 1000;
const MAX_READ_BATCHES = 50;

export function useNotifications(
    isScopedCustomer: boolean,
    userId: string | null | undefined,
): UseNotificationsReturn {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [notificationLoading, setNotificationLoading] = useState(false);
    const [hasMoreNotifications, setHasMoreNotifications] = useState(false);
    const nextOffsetRef = useRef(0);
    const [isClearing, setIsClearing] = useState(false);
    const [deletingNotificationId, setDeletingNotificationId] = useState<number | string | null>(null);
    const [swipedNotificationId, setSwipedNotificationId] = useState<number | string | null>(null);
    const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
    const [notificationError, setNotificationError] = useState<string | null>(null);

    const fetchReadIds = useCallback(async (): Promise<Set<string>> => {
        if (!userId || isScopedCustomer) {
            return new Set();
        }

        try {
            const ids = new Set<string>();
            let from = 0;
            let batch = 0;

            while (batch < MAX_READ_BATCHES) {
                const to = from + READ_BATCH_SIZE - 1;
                const { data, error } = await supabase
                    .from('notification_reads')
                    .select('notification_id')
                    .eq('user_id', userId)
                    .range(from, to);

                if (error) {
                    console.warn('Could not fetch notification read state', error);
                    return new Set();
                }

                if (!data || data.length === 0) break;

                for (const row of data) {
                    ids.add(String(row.notification_id));
                }

                if (data.length < READ_BATCH_SIZE) break;

                batch += 1;
                from += READ_BATCH_SIZE;
            }

            return ids;
        } catch (error) {
            console.error('Error fetching notification read state', error);
            return new Set();
        }
    }, [isScopedCustomer, userId]);

    const fetchNotifications = useCallback(async (reset = true, propagateErrors = false): Promise<boolean> => {
        setNotificationLoading(true);
        setNotificationError(null);

        try {
            if (isScopedCustomer) {
                setNotifications([]);
                setHasMoreNotifications(false);
                return true;
            }

            const readIds = await fetchReadIds();
            let scanOffset = reset ? 0 : nextOffsetRef.current;
            let scannedPages = 0;
            let reachedEnd = false;
            const collected: Notification[] = [];

            while (collected.length < PAGE_SIZE && scannedPages < MAX_SCAN_PAGES) {
                const { data, error } = await supabase
                    .from('system_notifications')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .range(scanOffset, scanOffset + PAGE_SIZE - 1);

                if (error) {
                    throw error;
                }

                if (!data || data.length === 0) {
                    reachedEnd = true;
                    break;
                }

                const unread = data.filter((notification: any) => !readIds.has(String(notification.id)));

                const validTypes = new Set(Object.values(NOTIFICATION_TYPES));

                const validated = unread.map((notification: any) => {
                    const rawType = notification.type as any;
                    const type = validTypes.has(rawType) ? rawType : NOTIFICATION_TYPES.SYSTEM;
                    return {
                        ...notification,
                        type,
                    } as Notification;
                });

                collected.push(...validated);

                scanOffset += PAGE_SIZE;
                scannedPages += 1;

                if (data.length < PAGE_SIZE) {
                    reachedEnd = true;
                    break;
                }
            }

            if (reset) {
                setNotifications(collected);
            } else {
                setNotifications((prev) => {
                    const seen = new Set(prev.map((n) => String(n.id)));
                    const merged = [...prev];
                    for (const nextNotification of collected) {
                        const key = String(nextNotification.id);
                        if (!seen.has(key)) {
                            seen.add(key);
                            merged.push(nextNotification);
                        }
                    }
                    return merged;
                });
            }

            nextOffsetRef.current = scanOffset;
            setHasMoreNotifications(!reachedEnd);

            return true;
        } catch (error) {
            console.error('Error fetching notifications', error);
            const message = error && (error as any).message ? (error as any).message : String(error || 'Failed to fetch notifications');
            setNotificationError(message);
            if (reset) {
                setNotifications([]);
            }
            setHasMoreNotifications(false);

            if (propagateErrors) {
                throw error;
            }

            return false;
        } finally {
            setDeletingNotificationId(null);
            setSwipedNotificationId(null);
            setSwipeDirection(null);
            setNotificationLoading(false);
        }
    }, [fetchReadIds, isScopedCustomer]);

    const loadMoreNotifications = useCallback(async () => {
        if (notificationLoading || !hasMoreNotifications) return;
        await fetchNotifications(false);
    }, [fetchNotifications, hasMoreNotifications, notificationLoading]);

    const markNotificationsRead = useCallback(async (ids: Array<number | string>) => {
        if (!userId || ids.length === 0) return;

        const payload = ids.map((id) => ({
            user_id: userId,
            notification_id: String(id),
            read_at: new Date().toISOString(),
        }));

        const { error } = await supabase
            .from('notification_reads')
            .upsert(payload, { onConflict: 'user_id,notification_id' });

        if (error) throw error;
    }, [userId]);

    const deleteNotification = useCallback(async (notificationId: number | string) => {
        if (isScopedCustomer) return;

        setDeletingNotificationId(notificationId);

        try {
            // Trigger animation first (wait for swipe or shake animation)
            const animationDuration = swipedNotificationId === notificationId ? 300 : 600;
            await new Promise(r => setTimeout(r, animationDuration));

            if (notificationId) {
                await markNotificationsRead([notificationId]);
            }

            // Remove from local state
            setNotifications(prev => prev.filter(n => n.id !== notificationId));
        } catch (err) {
            console.error('Failed to mark notification read:', err);
            setDeletingNotificationId(null);
        } finally {
            setSwipedNotificationId(null);
            setSwipeDirection(null);
        }
    }, [isScopedCustomer, markNotificationsRead, swipedNotificationId]);

    const clearAllNotifications = useCallback(async () => {
        if (notifications.length === 0 || isClearing || isScopedCustomer) return;

        setIsClearing(true);

        try {
            // Trigger animations first (wait 1.5s for "snap" effect)
            await new Promise(r => setTimeout(r, 1500));

            const dbIDs = notifications
                .map(n => n.id)
                .filter(id => id !== null && id !== undefined);

            if (dbIDs.length > 0) {
                await markNotificationsRead(dbIDs);
            }

            const fetchResult = await fetchNotifications(true);
            if (fetchResult === false) {
                return;
            }
        } catch (err) {
            console.error('Failed to clear notifications:', err);
        } finally {
            setIsClearing(false);
        }
    }, [fetchNotifications, isClearing, isScopedCustomer, markNotificationsRead, notifications]);

    return {
        notifications,
        notificationLoading,
        hasMoreNotifications,
        isClearing,
        deletingNotificationId,
        swipedNotificationId,
        swipeDirection,
        fetchNotifications,
        loadMoreNotifications,
        deleteNotification,
        clearAllNotifications,
        setSwipedNotificationId,
        setSwipeDirection,
        notificationError,
        setNotificationError,
    };
}
