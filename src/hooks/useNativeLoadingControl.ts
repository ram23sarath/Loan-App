import { useCallback } from 'react';

/**
 * Hook to control the native loading screen overlay
 * 
 * Use this hook to prevent the loading flash when performing in-page actions
 * like opening modals, clicking edit/delete buttons, etc.
 * 
 * @example
 * ```tsx
 * const { suppressNextLoading } = useNativeLoadingControl();
 * 
 * const handleEditClick = () => {
 *   suppressNextLoading(); // Prevent loading flash
 *   setShowEditModal(true);
 * };
 * ```
 */
export function useNativeLoadingControl() {
    const isNativeApp = typeof window !== 'undefined' &&
        typeof (window as any).NativeBridge !== 'undefined';

    /**
     * Suppress the loading screen for the next navigation/action
     * Call this before performing in-page actions that shouldn't show loading
     */
    const suppressNextLoading = useCallback(() => {
        if (isNativeApp && (window as any).NativeBridge?.suppressLoadingScreen) {
            (window as any).NativeBridge.suppressLoadingScreen();
        }
    }, [isNativeApp]);

    /**
     * Explicitly show the loading screen
     * Use this when you want to show loading for a specific action
     */
    const showLoading = useCallback(() => {
        if (isNativeApp && (window as any).NativeBridge?.showLoadingScreen) {
            (window as any).NativeBridge.showLoadingScreen();
        }
    }, [isNativeApp]);

    return {
        suppressNextLoading,
        showLoading,
        isNativeApp,
    };
}

/**
 * Higher-order function to wrap event handlers with loading suppression
 * 
 * @example
 * ```tsx
 * const { withSuppressedLoading } = useNativeLoadingControl();
 * 
 * <button onClick={withSuppressedLoading(() => setShowModal(true))}>
 *   Edit
 * </button>
 * ```
 */
export function withSuppressedLoading<T extends (...args: any[]) => any>(
    handler: T,
): T {
    return ((...args: any[]) => {
        if (typeof window !== 'undefined' && (window as any).NativeBridge?.suppressLoadingScreen) {
            (window as any).NativeBridge.suppressLoadingScreen();
        }
        return handler(...args);
    }) as T;
}
