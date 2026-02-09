/**
 * Native Bridge - Typed Web ↔ Native Message Protocol
 * 
 * This module provides type-safe communication between the React Native app
 * and the WebView-hosted web application.
 * 
 * SECURITY NOTES:
 * - Never transmit service-role keys through the bridge
 * - Auth tokens should be short-lived Supabase session tokens
 * - All sensitive operations go through authenticated Supabase RPC
 */

import { WebView } from 'react-native-webview';
import type { RefObject } from 'react';

// ============================================================================
// MESSAGE TYPES - Web → Native Commands
// ============================================================================

/** Commands sent from Web to Native */
export type WebToNativeCommand =
  | { type: 'AUTH_REQUEST' }
  | { type: 'AUTH_LOGOUT' }
  | { type: 'AUTH_SESSION_UPDATE'; payload: AuthSession }
  | { type: 'OPEN_EXTERNAL_LINK'; payload: { url: string } }
  | { type: 'REQUEST_FILE_DOWNLOAD'; payload: { url: string; filename?: string } }
  | { type: 'HAPTIC_FEEDBACK'; payload: { style: 'light' | 'medium' | 'heavy' } }
  | { type: 'SHARE_CONTENT'; payload: { title?: string; text: string; url?: string } }
  | { type: 'COPY_TO_CLIPBOARD'; payload: { text: string } }
  | { type: 'REQUEST_PUSH_PERMISSION' }
  | { type: 'NAVIGATION_READY' }
  | { type: 'PAGE_LOADED'; payload: { route: string; title?: string } }
  | { type: 'ERROR_REPORT'; payload: { message: string; stack?: string; componentStack?: string } }
  | { type: 'THEME_DETECTED'; payload: { mode: 'light' | 'dark' } }
  | { type: 'DEEP_LINK_ACK'; payload: { path: string; requestId?: string } }
  /**
   * Signal that the web app is visually ready (fonts loaded, critical content rendered).
   * Sent after initial load and route changes to dismiss the native loading overlay.
   */
  | { type: 'APP_READY' };

// ============================================================================
// MESSAGE TYPES - Native → Web Responses
// ============================================================================

/** Responses sent from Native to Web */
export type NativeToWebResponse =
  | { type: 'AUTH_TOKEN'; payload: AuthSession }
  | { type: 'AUTH_CLEARED' }
  | { type: 'PUSH_TOKEN'; payload: { token: string; platform: 'ios' | 'android' | 'unknown' } }
  | { type: 'PUSH_PERMISSION_RESULT'; payload: { granted: boolean; canAskAgain: boolean } }
  | { type: 'THEME_CHANGE'; payload: { mode: 'light' | 'dark' | 'system' } }
  | { type: 'NETWORK_STATUS'; payload: { isConnected: boolean; type: string | null } }
  | { type: 'APP_STATE'; payload: { state: string } }
  | { type: 'DEEP_LINK'; payload: { url: string; path: string; requestId?: string } }
  | { type: 'NATIVE_READY' };

// ============================================================================
// AUTH SESSION TYPE
// ============================================================================

/** Supabase session data (short-lived tokens only) */
export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp in seconds
  user: {
    id: string;
    email?: string;
    isScopedCustomer?: boolean;
    scopedCustomerId?: string | null;
  };
}

// ============================================================================
// BRIDGE HANDLER CLASS
// ============================================================================

/**
 * BridgeHandler manages all communication between Native and WebView
 */
export class BridgeHandler {
  private webViewRef: RefObject<WebView>;
  private messageHandlers: Map<string, (payload: any) => void>;

  constructor(webViewRef: RefObject<WebView>) {
    this.webViewRef = webViewRef;
    this.messageHandlers = new Map();
  }

  /**
   * Register a handler for a specific message type from the web
   */
  on<T extends WebToNativeCommand['type']>(
    type: T,
    handler: (payload: Extract<WebToNativeCommand, { type: T }> extends { payload: infer P } ? P : void) => void
  ): () => void {
    this.messageHandlers.set(type, handler as (payload: any) => void);

    // Return unsubscribe function
    return () => {
      this.messageHandlers.delete(type);
    };
  }

  /**
   * Handle incoming message from WebView
   */
  handleMessage(rawMessage: string): void {
    try {
      const message = JSON.parse(rawMessage) as WebToNativeCommand;

      if (__DEV__) {
        console.log('[Bridge] Received:', message.type);
      }

      const handler = this.messageHandlers.get(message.type);
      if (handler) {
        handler('payload' in message ? message.payload : undefined);
      } else if (__DEV__) {
        console.warn('[Bridge] No handler for message type:', message.type);
      }
    } catch (error) {
      console.error('[Bridge] Failed to parse message:', error);
    }
  }

  /**
   * Send a message to the WebView
   */
  sendToWeb(response: NativeToWebResponse): void {
    if (!this.webViewRef.current) {
      console.warn('[Bridge] WebView ref not available');
      return;
    }

    const script = `
      (function() {
        if (window.onNativeMessage) {
          window.onNativeMessage(${JSON.stringify(response)});
        } else {
          // Queue message if handler not ready
          window.__nativeMessageQueue = window.__nativeMessageQueue || [];
          window.__nativeMessageQueue.push(${JSON.stringify(response)});
        }
      })();
      true;
    `;

    this.webViewRef.current.injectJavaScript(script);

    if (__DEV__) {
      console.log('[Bridge] Sent to web:', response.type);
    }
  }
}

// ============================================================================
// INJECTED JAVASCRIPT FOR WEB APP
// ============================================================================

/**
 * JavaScript code injected into the WebView to set up the bridge
 * This runs before the web app loads
 */
export const BRIDGE_INJECTION_SCRIPT = `
(function() {
  'use strict';
  
  // Prevent double-injection
  if (window.__NATIVE_BRIDGE_INITIALIZED) return;
  window.__NATIVE_BRIDGE_INITIALIZED = true;
  
  console.log('[NativeBridge] Initializing...');
  
  // Message queue for messages received before handlers are ready
  window.__nativeMessageQueue = [];
  
  // =========================================================================
  // DEBUG LOGGING - Capture all errors for native debugging
  // =========================================================================
  
  // Store original console methods
  var originalError = console.error;
  var originalWarn = console.warn;
  
  // Helper to safely send error reports
  function reportToNative(type, message, extra) {
    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'ERROR_REPORT',
          payload: {
            errorType: type,
            message: String(message).substring(0, 1000),
            extra: extra || null,
            timestamp: new Date().toISOString(),
            url: window.location.href
          }
        }));
      }
    } catch (e) {
      // Silently fail if reporting fails
    }
  }
  
  // Intercept console.error
  console.error = function() {
    originalError.apply(console, arguments);
    var message = Array.prototype.slice.call(arguments).map(function(a) {
      return typeof a === 'object' ? JSON.stringify(a) : String(a);
    }).join(' ');
    reportToNative('console.error', message);
  };
  
  // Intercept console.warn (optional, for verbose debugging)
  console.warn = function() {
    originalWarn.apply(console, arguments);
    // Only report warnings in development (can be noisy)
    if (window.__DEV__ || window.location.hostname === 'localhost') {
      var message = Array.prototype.slice.call(arguments).map(function(a) {
        return typeof a === 'object' ? JSON.stringify(a) : String(a);
      }).join(' ');
      reportToNative('console.warn', message);
    }
  };
  
  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', function(event) {
    var reason = event.reason;
    var message = 'Unhandled Promise Rejection: ';
    if (reason instanceof Error) {
      message += reason.message;
      reportToNative('unhandledrejection', message, { stack: reason.stack });
    } else {
      message += String(reason);
      reportToNative('unhandledrejection', message);
    }
  });
  
  // Capture global JavaScript errors
  window.addEventListener('error', function(event) {
    reportToNative('window.error', event.message || 'Unknown error', {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
  });
  
  // Track page navigation using History API interception (more efficient than polling)
  // This intercepts pushState/replaceState and listens to popstate
  var lastUrl = window.location.href;
  
  var notifyUrlChange = function() {
    var newUrl = window.location.href;
    if (newUrl !== lastUrl) {
      lastUrl = newUrl;
      console.log('[NativeBridge] URL changed to:', lastUrl);
      
      // Signal page loaded - web app will send APP_READY when stable if needed
      if (window.sendToNative) {
        window.sendToNative('PAGE_LOADED', { route: window.location.pathname });
      }
    }
  };
  
  // Intercept History API - pushState
  var originalPushState = history.pushState;
  history.pushState = function() {
    originalPushState.apply(history, arguments);
    notifyUrlChange();
  };
  
  // Intercept History API - replaceState
  var originalReplaceState = history.replaceState;
  history.replaceState = function() {
    originalReplaceState.apply(history, arguments);
    notifyUrlChange();
  };
  
  // Listen for browser back/forward navigation
  window.addEventListener('popstate', notifyUrlChange);
  
  // Track loading state changes
  document.addEventListener('DOMContentLoaded', function() {
    console.log('[NativeBridge] DOMContentLoaded');
  });
  window.addEventListener('load', function() {
    console.log('[NativeBridge] Window loaded');
    // Web app will send APP_READY when visually stable
  });
  
  /**
   * Send a command to the native app
   * @param {string} type - Command type
   * @param {object} payload - Optional payload
   */
  window.sendToNative = function(type, payload) {
    const message = { type: type };
    if (payload !== undefined) {
      message.payload = payload;
    }
    
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify(message));
    } else {
      console.warn('[NativeBridge] ReactNativeWebView not available');
    }
  };
  
  /**
   * Check if running inside native app
   */
  window.isNativeApp = function() {
    return !!(window.ReactNativeWebView && window.ReactNativeWebView.postMessage);
  };
  
  /**
   * Register handler for native messages (call this in your web app)
   * @param {function} handler - Callback receiving NativeToWebResponse
   */
  window.registerNativeHandler = function(handler) {
    window.onNativeMessage = handler;
    
    // Process queued messages
    if (window.__nativeMessageQueue && window.__nativeMessageQueue.length > 0) {
      console.log('[NativeBridge] Processing', window.__nativeMessageQueue.length, 'queued messages');
      window.__nativeMessageQueue.forEach(function(msg) {
        handler(msg);
      });
      window.__nativeMessageQueue = [];
    }
  };
  
  // Convenience methods for common operations
  window.NativeBridge = {
    requestAuth: function() {
      window.sendToNative('AUTH_REQUEST');
    },
    
    logout: function() {
      window.sendToNative('AUTH_LOGOUT');
    },
    
    updateSession: function(session) {
      window.sendToNative('AUTH_SESSION_UPDATE', session);
    },
    
    openExternalLink: function(url) {
      window.sendToNative('OPEN_EXTERNAL_LINK', { url: url });
    },
    
    hapticFeedback: function(style) {
      window.sendToNative('HAPTIC_FEEDBACK', { style: style || 'medium' });
    },
    
    share: function(content) {
      window.sendToNative('SHARE_CONTENT', content);
    },
    
    copyToClipboard: function(text) {
      window.sendToNative('COPY_TO_CLIPBOARD', { text: text });
    },
    
    requestPushPermission: function() {
      window.sendToNative('REQUEST_PUSH_PERMISSION');
    },
    
    reportPageLoad: function(route, title) {
      window.sendToNative('PAGE_LOADED', { route: route, title: title });
    },
    
    reportError: function(message, stack, componentStack) {
      window.sendToNative('ERROR_REPORT', { 
        message: message, 
        stack: stack,
        componentStack: componentStack 
      });
    },
    
    reportTheme: function(mode) {
      window.sendToNative('THEME_DETECTED', { mode: mode });
    },
    
    reportDeepLinkAck: function(path, requestId) {
      window.sendToNative('DEEP_LINK_ACK', { path: path, requestId: requestId });
    },
    
    reportAppReady: function() {
      window.sendToNative('APP_READY');
    }
  };
  
  // Notify native that bridge is ready
  // window.sendToNative('NAVIGATION_READY'); // Removed: Prevents premature loading screen dismissal
  
  console.log('[NativeBridge] Ready');
})();
true;
`;

// ============================================================================
// WEB APP INTEGRATION EXAMPLE
// ============================================================================

/**
 * Example code to add to the web app (DataContext.tsx or App.tsx):
 * 
 * ```typescript
 * // Check if running in native app
 * const isNative = typeof window !== 'undefined' && window.isNativeApp?.();
 * 
 * useEffect(() => {
 *   if (!isNative) return;
 *   
 *   // Register handler for messages from native app
 *   window.registerNativeHandler?.((message) => {
 *     switch (message.type) {
 *       case 'AUTH_TOKEN':
 *         // Native sent auth token - set session
 *         supabase.auth.setSession({
 *           access_token: message.payload.accessToken,
 *           refresh_token: message.payload.refreshToken,
 *         });
 *         break;
 *       case 'PUSH_TOKEN':
 *         // Store push token via authenticated RPC
 *         supabase.rpc('update_push_token', { 
 *           token: message.payload.token 
 *         });
 *         break;
 *       case 'NETWORK_STATUS':
 *         // Handle offline/online state
 *         break;
 *     }
 *   });
 *   
 *   // When session changes, notify native
 *   const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
 *     if (session) {
 *       window.NativeBridge?.updateSession({
 *         accessToken: session.access_token,
 *         refreshToken: session.refresh_token,
 *         expiresAt: session.expires_at,
 *         user: { id: session.user.id, email: session.user.email }
 *       });
 *     }
 *   });
 *   
 *   return () => subscription.unsubscribe();
 * }, []);
 * ```
 */
