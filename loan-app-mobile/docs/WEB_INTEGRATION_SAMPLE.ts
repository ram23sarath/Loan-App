/**
 * Web App Integration Sample
 * 
 * This file shows how to integrate the native bridge into your existing 
 * React web application. Add this code to your DataContext.tsx or App.tsx.
 * 
 * DO NOT include this file in the mobile app - it's for the WEB app!
 */

// =============================================================================
// STEP 1: Add to your DataContext.tsx or create a separate hook
// =============================================================================

import { useEffect, useCallback } from 'react';
import { supabase } from './lib/supabase';

/**
 * Hook to integrate with the native mobile app wrapper
 */
export function useNativeBridge() {
    // Check if running inside the native app
    const isNative = typeof window !== 'undefined' && window.isNativeApp?.();

    // Handle messages from native app
    const handleNativeMessage = useCallback((message: any) => {
        console.log('[NativeBridge] Received:', message.type);

        switch (message.type) {
            case 'NATIVE_READY':
                // Native is ready, we can start communicating
                console.log('[NativeBridge] Native app is ready');
                break;

            case 'PUSH_TOKEN':
                // Store push token in Supabase via authenticated RPC
                // This requires the update_push_token function (see notifications.ts SQL)
                supabase.rpc('update_push_token', {
                    p_token: message.payload.token,
                    p_platform: message.payload.platform,
                }).then(({ error }) => {
                    if (error) {
                        console.error('[NativeBridge] Failed to store push token:', error);
                    } else {
                        console.log('[NativeBridge] Push token stored successfully');
                    }
                });
                break;

            case 'NETWORK_STATUS':
                // Handle online/offline state
                if (!message.payload.isConnected) {
                    console.warn('[NativeBridge] Device is offline');
                    // You could show an offline banner here
                }
                break;

            case 'APP_STATE':
                // Handle app going to background/foreground
                if (message.payload.state === 'active') {
                    // App came to foreground - refresh data
                    // fetchData(); // Call your data refresh function
                }
                break;

            case 'DEEP_LINK':
                // Handle deep link navigation
                const path = message.payload.path;
                if (path && path !== '/') {
                    // Use your router to navigate
                    // navigate(path);
                    console.log('[NativeBridge] Navigate to:', path);
                }
                break;

            case 'THEME_CHANGE':
                // Native theme changed
                // You could sync your theme context here
                break;
        }
    }, []);

    // Set up bridge on mount
    useEffect(() => {
        if (!isNative) return;

        // Register our message handler
        window.registerNativeHandler?.(handleNativeMessage);

        // Listen for auth state changes and sync to native
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                if (session) {
                    // Send session to native for persistence
                    window.NativeBridge?.updateSession({
                        accessToken: session.access_token,
                        refreshToken: session.refresh_token,
                        expiresAt: session.expires_at ?? 0,
                        user: {
                            id: session.user.id,
                            email: session.user.email,
                        },
                    });
                } else if (event === 'SIGNED_OUT') {
                    // Notify native of logout
                    window.NativeBridge?.logout();
                }
            }
        );

        return () => {
            subscription.unsubscribe();
        };
    }, [isNative, handleNativeMessage]);

    return { isNative };
}


// =============================================================================
// STEP 2: Add to your DataContext provider or App component
// =============================================================================

/*
// In your DataContext.tsx or App.tsx:

export const DataProvider = ({ children }: { children: ReactNode }) => {
  // ... existing code ...

  // Add native bridge integration
  const { isNative } = useNativeBridge();

  // ... rest of provider ...
};
*/


// =============================================================================
// STEP 3: Use native features conditionally
// =============================================================================

/*
// Example: Native share button

function ShareButton({ text, url }: { text: string; url?: string }) {
  const isNative = window.isNativeApp?.();

  const handleShare = async () => {
    if (isNative) {
      // Use native share sheet
      window.NativeBridge?.share({ text, url });
    } else {
      // Use Web Share API or fallback
      if (navigator.share) {
        await navigator.share({ text, url });
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(url || text);
        alert('Link copied to clipboard!');
      }
    }
  };

  return <button onClick={handleShare}>Share</button>;
}
*/


// =============================================================================
// STEP 4: Report errors to native for debugging
// =============================================================================

/*
// Add to your ErrorBoundary component:

class ErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to console
    console.error('Error caught by boundary:', error, errorInfo);

    // Report to native app for crash analytics
    if (window.isNativeApp?.()) {
      window.NativeBridge?.reportError(
        error.message,
        error.stack,
        errorInfo.componentStack
      );
    }
  }

  // ... render method ...
}
*/


// =============================================================================
// STEP 5: Request push notifications (call when appropriate)
// =============================================================================

/*
// Don't request on app load! Request when user is about to enable notifications.

function NotificationSettings() {
  const [hasToken, setHasToken] = useState(false);
  const isNative = window.isNativeApp?.();

  const handleEnableNotifications = () => {
    if (isNative) {
      window.NativeBridge?.requestPushPermission();
    }
  };

  useEffect(() => {
    if (!isNative) return;
    
    // Listen for push token
    window.registerNativeHandler?.((msg) => {
      if (msg.type === 'PUSH_TOKEN') {
        setHasToken(true);
      }
    });
  }, [isNative]);

  if (!isNative) return null; // Don't show on web

  return (
    <div>
      <h3>Notifications</h3>
      {hasToken ? (
        <p>✅ Notifications enabled</p>
      ) : (
        <button onClick={handleEnableNotifications}>
          Enable Notifications
        </button>
      )}
    </div>
  );
}
*/
