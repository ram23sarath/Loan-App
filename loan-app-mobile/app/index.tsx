/**
 * Main WebView Screen
 * 
 * The primary screen that wraps the web application in a WebView.
 * Handles:
 * - Loading, offline, and error states
 * - Android back button navigation
 * - External link interception
 * - Web ↔ Native message bridge
 * - Deep link handling
 * - Auth token exchange
 * - Push notification registration
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { 
  View, 
  StyleSheet, 
  BackHandler, 
  Linking,
  AppState,
  Platform,
  Share,
  Alert,
  useColorScheme,
} from 'react-native';
import { WebView, WebViewMessageEvent, WebViewNavigation } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as Linking2 from 'expo-linking';

import { WEB_APP_URL, ENVIRONMENT } from '@/config/env';
import { 
  BridgeHandler, 
  BRIDGE_INJECTION_SCRIPT,
  type WebToNativeCommand,
  type AuthSession,
} from '@/native/bridge';
import { 
  getExpoPushToken, 
  addNotificationReceivedListener,
  addNotificationResponseListener,
} from '@/native/notifications';

import LoadingScreen from '@/components/LoadingScreen';
import OfflineScreen from '@/components/OfflineScreen';
import ErrorScreen from '@/components/ErrorScreen';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function WebViewScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  // Refs
  const webViewRef = useRef<WebView>(null);
  const bridgeRef = useRef<BridgeHandler | null>(null);
  
  // State
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(WEB_APP_URL);
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);

  // ============================================================================
  // BRIDGE SETUP
  // ============================================================================

  useEffect(() => {
    if (webViewRef.current) {
      bridgeRef.current = new BridgeHandler(webViewRef as React.RefObject<WebView>);
      
      // Register message handlers
      bridgeRef.current.on('AUTH_REQUEST', () => {
        // If we have a stored session, send it to web
        if (authSession) {
          bridgeRef.current?.sendToWeb({ type: 'AUTH_TOKEN', payload: authSession });
        }
      });

      bridgeRef.current.on('AUTH_LOGOUT', () => {
        setAuthSession(null);
        bridgeRef.current?.sendToWeb({ type: 'AUTH_CLEARED' });
      });

      bridgeRef.current.on('AUTH_SESSION_UPDATE', (payload) => {
        // Store session from web for persistence
        setAuthSession(payload as AuthSession);
      });

      bridgeRef.current.on('OPEN_EXTERNAL_LINK', (payload) => {
        const { url } = payload as { url: string };
        Linking.openURL(url).catch((err) => {
          console.error('[WebView] Failed to open external link:', err);
        });
      });

      bridgeRef.current.on('HAPTIC_FEEDBACK', async (payload) => {
        const { style } = payload as { style: 'light' | 'medium' | 'heavy' };
        try {
          switch (style) {
            case 'light':
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              break;
            case 'medium':
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              break;
            case 'heavy':
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              break;
          }
        } catch (err) {
          // Haptics not available on all devices
        }
      });

      bridgeRef.current.on('SHARE_CONTENT', async (payload) => {
        const { title, text, url } = payload as { title?: string; text: string; url?: string };
        try {
          await Share.share({
            title: title,
            message: url ? `${text}\n${url}` : text,
            url: Platform.OS === 'ios' ? url : undefined,
          });
        } catch (err) {
          console.error('[WebView] Share failed:', err);
        }
      });

      bridgeRef.current.on('COPY_TO_CLIPBOARD', async (payload) => {
        const { text } = payload as { text: string };
        await Clipboard.setStringAsync(text);
        // Haptic feedback on copy
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      });

      bridgeRef.current.on('REQUEST_PUSH_PERMISSION', async () => {
        const result = await getExpoPushToken();
        if (result.success && result.token) {
          bridgeRef.current?.sendToWeb({
            type: 'PUSH_TOKEN',
            payload: { token: result.token, platform: result.platform },
          });
        } else {
          bridgeRef.current?.sendToWeb({
            type: 'PUSH_PERMISSION_RESULT',
            payload: { granted: false, canAskAgain: true },
          });
        }
      });

      bridgeRef.current.on('NAVIGATION_READY', () => {
        // Web is ready, send native ready signal back
        bridgeRef.current?.sendToWeb({ type: 'NATIVE_READY' });
        setIsLoading(false); // Failsafe: ensure loading screen is dismissed
        
        // Send push token if available
        getExpoPushToken().then((result) => {
          if (result.success && result.token) {
            bridgeRef.current?.sendToWeb({
              type: 'PUSH_TOKEN',
              payload: { token: result.token, platform: result.platform },
            });
          }
        });
      });

      bridgeRef.current.on('PAGE_LOADED', (payload) => {
        const { route } = payload as { route: string; title?: string };
        setIsLoading(false); // Failsafe: page is definitely loaded
        if (__DEV__) {
          console.log('[WebView] Page loaded:', route);
        }
      });

      bridgeRef.current.on('ERROR_REPORT', (payload) => {
        const { message, stack } = payload as { message: string; stack?: string };
        console.error('[WebView] Error from web:', message, stack);
      });

      bridgeRef.current.on('THEME_DETECTED', (payload) => {
        // Could sync theme with native here if needed
        if (__DEV__) {
          console.log('[WebView] Theme detected:', payload);
        }
      });
    }
  }, [authSession]);

  // ============================================================================
  // NETWORK STATUS
  // ============================================================================

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const wasOffline = isOffline;
      setIsOffline(!state.isConnected);
      
      // Notify web of network change
      bridgeRef.current?.sendToWeb({
        type: 'NETWORK_STATUS',
        payload: { 
          isConnected: state.isConnected ?? false, 
          type: state.type 
        },
      });

      // Auto-reload when coming back online
      if (wasOffline && state.isConnected) {
        webViewRef.current?.reload();
      }
    });

    return () => unsubscribe();
  }, [isOffline]);

  // ============================================================================
  // APP STATE
  // ============================================================================

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      bridgeRef.current?.sendToWeb({
        type: 'APP_STATE',
        payload: { state: nextAppState },
      });
    });

    return () => subscription.remove();
  }, []);

  // ============================================================================
  // ANDROID BACK BUTTON
  // ============================================================================

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true; // Prevent default behavior
      }
      return false; // Allow default back behavior (exit app)
    });

    return () => backHandler.remove();
  }, [canGoBack]);

  // ============================================================================
  // DEEP LINKING
  // ============================================================================

  useEffect(() => {
    // Handle deep links when app is already open
    const subscription = Linking2.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    // Handle deep link on initial launch
    Linking2.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    });

    return () => subscription.remove();
  }, []);

  const handleDeepLink = useCallback((url: string) => {
    try {
      const parsed = Linking2.parse(url);
      const path = parsed.path || '/';
      
      if (__DEV__) {
        console.log('[DeepLink] Handling:', url, '→', path);
      }

      // Navigate WebView to the path
      const targetUrl = `${WEB_APP_URL}${path.startsWith('/') ? path : '/' + path}`;
      setCurrentUrl(targetUrl);
      
      // Also notify web of deep link
      bridgeRef.current?.sendToWeb({
        type: 'DEEP_LINK',
        payload: { url, path },
      });
    } catch (err) {
      console.error('[DeepLink] Failed to parse:', err);
    }
  }, []);

  // ============================================================================
  // PUSH NOTIFICATIONS
  // ============================================================================

  useEffect(() => {
    // Handle notification received while app is open
    const receivedListener = addNotificationReceivedListener((notification) => {
      if (__DEV__) {
        console.log('[Notification] Received:', notification.request.content);
      }
    });

    // Handle notification tap
    const responseListener = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.route && typeof data.route === 'string') {
        handleDeepLink(`loanapp://${data.route}`);
      }
    });

    return () => {
      receivedListener.remove();
      responseListener.remove();
    };
  }, [handleDeepLink]);

  // ============================================================================
  // WEBVIEW HANDLERS
  // ============================================================================

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    bridgeRef.current?.handleMessage(event.nativeEvent.data);
  }, []);

  const handleNavigationStateChange = useCallback((navState: WebViewNavigation) => {
    setCanGoBack(navState.canGoBack);
  }, []);

  const handleShouldStartLoadWithRequest = useCallback((request: WebViewNavigation) => {
    const { url } = request;
    
    // Allow navigation within our domain
    if (url.startsWith(WEB_APP_URL) || url.startsWith('about:')) {
      return true;
    }

    // Handle tel: and mailto: links
    if (url.startsWith('tel:') || url.startsWith('mailto:') || url.startsWith('sms:')) {
      Linking.openURL(url);
      return false;
    }

    // Open external links in browser
    if (url.startsWith('http://') || url.startsWith('https://')) {
      Linking.openURL(url);
      return false;
    }

    return true;
  }, []);

  const handleLoadStart = useCallback(() => {
    console.log('[WebView] Load started');
    setIsLoading(true);
    setError(null);
  }, []);

  const handleLoadEnd = useCallback(() => {
    console.log('[WebView] Load ended');
    setIsLoading(false);
  }, []);

  const handleError = useCallback((syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    setError(nativeEvent.description || 'Failed to load the application');
    setIsLoading(false);
  }, []);

  const handleHttpError = useCallback((syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    if (nativeEvent.statusCode >= 400) {
      setError(`Server error: ${nativeEvent.statusCode}`);
    }
  }, []);

  const handleRetry = useCallback(() => {
    setError(null);
    setIsLoading(true);
    webViewRef.current?.reload();
  }, []);

  // ============================================================================
  // RENDER
  // ============================================================================

  // Show offline screen
  if (isOffline) {
    return (
      <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
        <OfflineScreen onRetry={handleRetry} />
      </SafeAreaView>
    );
  }

  // Show error screen
  if (error) {
    return (
      <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
        <ErrorScreen 
          error={error}
          onRetry={handleRetry}
          onReload={handleRetry}
        />
      </SafeAreaView>
    );
  }

  // Web Platform Support
  if (Platform.OS === 'web') {
    return (
      <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
        {/* @ts-ignore: web-only iframe */}
        <iframe
          src={currentUrl}
          style={{ width: '100%', height: '100%', border: 'none' }}
          onLoad={() => setIsLoading(false)}
        />
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <LoadingScreen message="Loading..." />
          </View>
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView 
      style={[styles.container, isDark && styles.containerDark]}
      edges={['top', 'left', 'right']} // Don't add bottom padding for web's bottom nav
    >
      <WebView
        ref={webViewRef}
        source={{ uri: currentUrl }}
        style={styles.webView}
        
        // JavaScript & Injection
        javaScriptEnabled={true}
        injectedJavaScriptBeforeContentLoaded={BRIDGE_INJECTION_SCRIPT}
        
        // Improved loading reliability
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loadingOverlay}>
            <LoadingScreen message="Loading..." />
          </View>
        )}
        
        // User Agent (helps web detect native wrapper)
        applicationNameForUserAgent="LoanAppMobile/1.0"
        
        // Allow inline media playback (iOS)
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        
        // Performance
        cacheEnabled={true}
        cacheMode="LOAD_DEFAULT"
        
        // Android: enable hardware acceleration
        androidLayerType="hardware"
        
        // Prevent stale content
        incognito={false}
        
        // Security
        originWhitelist={['*']}
        mixedContentMode="compatibility"
        
        // Events
        onMessage={handleMessage}
        onNavigationStateChange={handleNavigationStateChange}
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
        onLoadStart={handleLoadStart}
        onLoadEnd={handleLoadEnd}
        onError={handleError}
        onHttpError={handleHttpError}
        
        // Android specific
        domStorageEnabled={true}
        thirdPartyCookiesEnabled={true}
        
        // iOS specific
        allowsBackForwardNavigationGestures={Platform.OS === 'ios'}
        decelerationRate={Platform.OS === 'ios' ? 'normal' : undefined}
        contentInsetAdjustmentBehavior={Platform.OS === 'ios' ? 'automatic' : undefined}
        
        // Pull to refresh (Android)
        pullToRefreshEnabled={true}
        
        // Render process handling
        onRenderProcessGone={(syntheticEvent) => {
          const { didCrash } = syntheticEvent.nativeEvent;
          console.error('[WebView] Render process gone, crashed:', didCrash);
          setError('The app encountered an issue. Please reload.');
        }}
        
        // Content process termination (iOS)
        onContentProcessDidTerminate={() => {
          console.error('[WebView] Content process terminated');
          webViewRef.current?.reload();
        }}
      />
      
      {/* Loading overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <LoadingScreen message="Loading your dashboard..." />
        </View>
      )}
    </SafeAreaView>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  containerDark: {
    backgroundColor: '#0F172A',
  },
  webView: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
});
