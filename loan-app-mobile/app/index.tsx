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

import React, { useRef, useState, useEffect, useCallback } from "react";
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
  Animated,
  Easing,
} from "react-native";
import {
  WebView,
  WebViewMessageEvent,
  WebViewNavigation,
} from "react-native-webview";
import { SafeAreaView } from "react-native-safe-area-context";
import NetInfo from "@react-native-community/netinfo";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import * as Linking2 from "expo-linking";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { WEB_APP_URL, ENVIRONMENT, TRUSTED_ORIGINS } from "@/config/env";
import {
  BridgeHandler,
  BRIDGE_INJECTION_SCRIPT,
  type WebToNativeCommand,
  type AuthSession,
} from "@/native/bridge";
import {
  getExpoPushToken,
  addNotificationReceivedListener,
  addNotificationResponseListener,
} from "@/native/notifications";
import {
  loadAuthSession,
  saveAuthSession,
  clearAuthSession,
} from "@/native/storage";

import LoadingScreen from "@/components/LoadingScreen";
import OfflineScreen from "@/components/OfflineScreen";
import ErrorScreen from "@/components/ErrorScreen";

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function WebViewScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  // Refs
  const webViewRef = useRef<WebView>(null);
  const bridgeRef = useRef<BridgeHandler | null>(null);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const authSessionRef = useRef<AuthSession | null>(null);
  const handlerUnsubscribersRef = useRef<Array<() => void>>([]);
  const previousIsOfflineRef = useRef<boolean>(false);
  const overlayOpacity = useRef(new Animated.Value(1)).current;

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [showOverlay, setShowOverlay] = useState(true);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(WEB_APP_URL);
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);

  // Keep ref in sync with state for use in closures without re-running effect
  useEffect(() => {
    authSessionRef.current = authSession;
  }, [authSession]);

  // Animate loading overlay fade-in/fade-out
  useEffect(() => {
    if (isLoading) {
      // Show overlay immediately, fade in
      setShowOverlay(true);
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    } else {
      // Fade out, then unmount
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 350,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setShowOverlay(false);
        }
      });
    }
  }, [isLoading, overlayOpacity]);

  // ============================================================================
  // LOAD PERSISTED SESSION ON MOUNT
  // ============================================================================

  useEffect(() => {
    loadAuthSession()
      .then((session) => {
        if (session) {
          console.log("[Storage] Loaded persisted auth session");
          setAuthSession(session);
        }
      })
      .catch((error) => {
        console.error("[Storage] Failed to load persisted session:", error);
      });
  }, []);

  // ============================================================================
  // BRIDGE SETUP
  // ============================================================================

  useEffect(() => {
    if (webViewRef.current) {
      // Clean up any previous handlers before creating new bridge
      handlerUnsubscribersRef.current.forEach((unsubscribe) => unsubscribe());
      handlerUnsubscribersRef.current = [];

      bridgeRef.current = new BridgeHandler(
        webViewRef as React.RefObject<WebView>,
      );

      // Register message handlers and store unsubscribers
      handlerUnsubscribersRef.current.push(
        bridgeRef.current.on("AUTH_REQUEST", () => {
          // If we have a stored session, send it to web
          if (authSessionRef.current) {
            bridgeRef.current?.sendToWeb({
              type: "AUTH_TOKEN",
              payload: authSessionRef.current,
            });
          }
        }),
      );

      handlerUnsubscribersRef.current.push(
        bridgeRef.current.on("AUTH_LOGOUT", async () => {
          setAuthSession(null);
          await clearAuthSession().catch((err) =>
            console.error("[Storage] Failed to clear session:", err),
          );
          bridgeRef.current?.sendToWeb({ type: "AUTH_CLEARED" });
        }),
      );

      handlerUnsubscribersRef.current.push(
        bridgeRef.current.on("AUTH_SESSION_UPDATE", async (payload) => {
          // Store session from web for persistence
          const session = payload as AuthSession;
          setAuthSession(session);
          await saveAuthSession(session).catch((err) =>
            console.error("[Storage] Failed to save session:", err),
          );
        }),
      );

      handlerUnsubscribersRef.current.push(
        bridgeRef.current.on("OPEN_EXTERNAL_LINK", (payload) => {
          const { url } = payload as { url: string };
          Linking.openURL(url).catch((err) => {
            console.error("[WebView] Failed to open external link:", err);
          });
        }),
      );

      handlerUnsubscribersRef.current.push(
        bridgeRef.current.on("REQUEST_FILE_DOWNLOAD", async (payload) => {
          const { url, filename } = payload as {
            url?: string;
            filename?: string;
          };

          if (!url) {
            Alert.alert("Download failed", "Missing download URL.");
            return;
          }

          const fallbackName = `document-${Date.now()}`;
          const safeName = (
            filename && filename.trim().length > 0
              ? filename.trim()
              : fallbackName
          ).replace(/[^\w.\-() ]+/g, "_");

          const baseDir =
            FileSystem.documentDirectory || FileSystem.cacheDirectory;
          if (!baseDir) {
            Alert.alert("Download failed", "No writable directory available.");
            return;
          }

          const targetUri = `${baseDir}${safeName}`;

          try {
            const result = await FileSystem.downloadAsync(url, targetUri);
            if (await Sharing.isAvailableAsync()) {
              await Sharing.shareAsync(result.uri);
            } else {
              await Linking.openURL(result.uri);
            }
          } catch (err) {
            console.error("[WebView] File download failed:", err);
            Alert.alert("Download failed", "Unable to save the file.");
          }
        }),
      );

      handlerUnsubscribersRef.current.push(
        bridgeRef.current.on("HAPTIC_FEEDBACK", async (payload) => {
          const { style } = payload as { style: "light" | "medium" | "heavy" };
          try {
            switch (style) {
              case "light":
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                break;
              case "medium":
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                break;
              case "heavy":
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                break;
            }
          } catch (err) {
            // Haptics not available on all devices
          }
        }),
      );

      handlerUnsubscribersRef.current.push(
        bridgeRef.current.on("SHARE_CONTENT", async (payload) => {
          const { title, text, url } = payload as {
            title?: string;
            text: string;
            url?: string;
          };
          try {
            await Share.share({
              title: title,
              message: url ? `${text}\n${url}` : text,
              url: Platform.OS === "ios" ? url : undefined,
            });
          } catch (err) {
            console.error("[WebView] Share failed:", err);
          }
        }),
      );

      handlerUnsubscribersRef.current.push(
        bridgeRef.current.on("COPY_TO_CLIPBOARD", async (payload) => {
          const { text } = payload as { text: string };
          await Clipboard.setStringAsync(text);
          // Haptic feedback on copy
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          );
        }),
      );

      handlerUnsubscribersRef.current.push(
        bridgeRef.current.on("REQUEST_PUSH_PERMISSION", async () => {
          const result = await getExpoPushToken();
          if (result.success && result.token) {
            bridgeRef.current?.sendToWeb({
              type: "PUSH_TOKEN",
              payload: { token: result.token, platform: result.platform },
            });
          } else {
            bridgeRef.current?.sendToWeb({
              type: "PUSH_PERMISSION_RESULT",
              payload: { granted: false, canAskAgain: true },
            });
          }
        }),
      );

      handlerUnsubscribersRef.current.push(
        bridgeRef.current.on("NAVIGATION_READY", () => {
          // Web is ready, send native ready signal back
          bridgeRef.current?.sendToWeb({ type: "NATIVE_READY" });

          // Clear timeout and dismiss loading - web app confirmed ready
          if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current);
            loadingTimeoutRef.current = null;
          }
          setIsLoading(false);

          // Send push token if available
          getExpoPushToken()
            .then((result) => {
              if (result.success && result.token) {
                bridgeRef.current?.sendToWeb({
                  type: "PUSH_TOKEN",
                  payload: { token: result.token, platform: result.platform },
                });
              }
            })
            .catch((error) => {
              console.error(
                "[NativeBridge] Failed to get push token:",
                error instanceof Error ? error.message : String(error),
              );
              // Log detailed context for debugging, but don't block the app
              console.warn(
                "[NativeBridge] Push token retrieval failed during initialization - app will continue without push notifications",
              );
            });
        }),
      );

      handlerUnsubscribersRef.current.push(
        bridgeRef.current.on("PAGE_LOADED", (payload) => {
          const { route } = payload as { route: string; title?: string };

          // Clear fallback timeout - page confirmed ready
          // Loading screen dismissed immediately when this signal arrives
          if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current);
            loadingTimeoutRef.current = null;
            console.log(
              "[WebView] PAGE_LOADED signal received, clearing fallback timeout",
            );
          }

          console.log(
            "[WebView] Web app ready - dismissing loading screen. Route:",
            route,
          );
          setIsLoading(false);

          // Mark that initial load is complete - subsequent navigations won't show loading
          if (!hasInitiallyLoaded) {
            setHasInitiallyLoaded(true);
            console.log(
              "[WebView] Initial load complete - subsequent navigations will not show loading overlay",
            );
          }
        }),
      );

      handlerUnsubscribersRef.current.push(
        bridgeRef.current.on("ERROR_REPORT", (payload) => {
          const { message, stack } = payload as {
            message: string;
            stack?: string;
          };
          console.error("[WebView] Error from web:", message, stack);
        }),
      );

      handlerUnsubscribersRef.current.push(
        bridgeRef.current.on("THEME_DETECTED", (payload) => {
          // Could sync theme with native here if needed
          if (__DEV__) {
            console.log("[WebView] Theme detected:", payload);
          }
        }),
      );

      // Cleanup function: unsubscribe all handlers when component unmounts or bridge is recreated
      return () => {
        handlerUnsubscribersRef.current.forEach((unsubscribe) => unsubscribe());
        handlerUnsubscribersRef.current = [];
        bridgeRef.current = null;
      };
    }
  }, []);

  // ============================================================================
  // NETWORK STATUS
  // ============================================================================

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const wasOffline = previousIsOfflineRef.current;
      const isNowOffline = !state.isConnected;
      setIsOffline(isNowOffline);

      // Notify web of network change
      bridgeRef.current?.sendToWeb({
        type: "NETWORK_STATUS",
        payload: {
          isConnected: state.isConnected ?? false,
          type: state.type,
        },
      });

      // Auto-reload when coming back online
      if (wasOffline && state.isConnected) {
        webViewRef.current?.reload();
      }

      // Update the ref to the new offline state
      previousIsOfflineRef.current = isNowOffline;
    });

    return () => unsubscribe();
  }, []);

  // ============================================================================
  // APP STATE
  // ============================================================================

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      bridgeRef.current?.sendToWeb({
        type: "APP_STATE",
        payload: { state: nextAppState },
      });
    });

    return () => subscription.remove();
  }, []);

  // ============================================================================
  // ANDROID BACK BUTTON
  // ============================================================================

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (canGoBack && webViewRef.current) {
          webViewRef.current.goBack();
          return true; // Prevent default behavior
        }
        return false; // Allow default back behavior (exit app)
      },
    );

    return () => backHandler.remove();
  }, [canGoBack]);

  // ============================================================================
  // DEEP LINKING
  // ============================================================================

  const handleDeepLink = useCallback((url: string) => {
    try {
      const parsed = Linking2.parse(url);
      const path = parsed.path || "/";

      if (__DEV__) {
        console.log("[DeepLink] Handling:", url, "→", path);
      }

      // Navigate WebView to the path
      const targetUrl = `${WEB_APP_URL}${path.startsWith("/") ? path : "/" + path}`;
      setCurrentUrl(targetUrl);

      // Also notify web of deep link
      bridgeRef.current?.sendToWeb({
        type: "DEEP_LINK",
        payload: { url, path },
      });
    } catch (err) {
      console.error("[DeepLink] Failed to parse:", err);
    }
  }, []);

  useEffect(() => {
    // Handle deep links when app is already open
    const subscription = Linking2.addEventListener("url", ({ url }) => {
      handleDeepLink(url);
    });

    // Handle deep link on initial launch
    Linking2.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    });

    return () => subscription.remove();
  }, [handleDeepLink]);

  // ============================================================================
  // PUSH NOTIFICATIONS
  // ============================================================================

  useEffect(() => {
    // Handle notification received while app is open
    const receivedListener = addNotificationReceivedListener((notification) => {
      if (__DEV__) {
        console.log("[Notification] Received:", notification.request.content);
      }
    });

    // Handle notification tap
    const responseListener = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.route && typeof data.route === "string") {
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

  const handleNavigationStateChange = useCallback(
    (navState: WebViewNavigation) => {
      setCanGoBack(navState.canGoBack);
    },
    [],
  );

  const handleShouldStartLoadWithRequest = useCallback(
    (request: WebViewNavigation) => {
      const { url } = request;

      // Allow navigation within our domain
      if (url.startsWith(WEB_APP_URL) || url.startsWith("about:")) {
        return true;
      }

      // Handle tel: and mailto: links
      if (
        url.startsWith("tel:") ||
        url.startsWith("mailto:") ||
        url.startsWith("sms:")
      ) {
        Linking.openURL(url);
        return false;
      }

      // Open external links in browser
      if (url.startsWith("http://") || url.startsWith("https://")) {
        Linking.openURL(url);
        return false;
      }

      return true;
    },
    [],
  );

  const handleLoadStart = useCallback(() => {
    console.log("[WebView] Load started");

    // Only show loading overlay on initial load, not on SPA navigation
    if (!hasInitiallyLoaded) {
      setIsLoading(true);
      setError(null);
    } else {
      console.log(
        "[WebView] SPA navigation detected - not showing loading overlay",
      );
    }
  }, [hasInitiallyLoaded]);

  const handleLoadEnd = useCallback(() => {
    console.log("[WebView] HTML loaded. Dismissing loading screen shortly...");

    // Dismiss loading screen directly after a short delay.
    // This is the GUARANTEED path — doesn't depend on any bridge message.
    // The delay gives React a moment to render something visible.
    // If PAGE_LOADED arrives first (via bridge), it dismisses even faster.
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }

    loadingTimeoutRef.current = setTimeout(() => {
      console.log(
        "[WebView] Dismissing loading screen (handleLoadEnd fallback)",
      );
      setIsLoading(false);
      if (!hasInitiallyLoaded) {
        setHasInitiallyLoaded(true);
      }
      loadingTimeoutRef.current = null;
    }, 1500); // 1.5 seconds — enough for React to render at least a loading spinner
  }, [hasInitiallyLoaded]);

  const handleError = useCallback((syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    setError(nativeEvent.description || "Failed to load the application");
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
  if (Platform.OS === "web") {
    return (
      <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
        {/* @ts-ignore: web-only iframe */}
        <iframe
          src={currentUrl}
          style={{ width: "100%", height: "100%", border: "none" }}
          onLoad={() => setIsLoading(false)}
        />
        {showOverlay && (
          <Animated.View
            style={[styles.loadingOverlay, { opacity: overlayOpacity }]}
          >
            <LoadingScreen message="Loading..." />
          </Animated.View>
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, isDark && styles.containerDark]}
      edges={["top", "left", "right"]} // Don't add bottom padding for web's bottom nav
    >
      <WebView
        ref={webViewRef}
        source={{ uri: currentUrl }}
        style={styles.webView}
        // JavaScript & Injection
        javaScriptEnabled={true}
        injectedJavaScriptBeforeContentLoaded={BRIDGE_INJECTION_SCRIPT}
        // Improved loading reliability
        startInLoadingState={false} // renderLoading handled manually via isLoading overlay
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
        // Security: restrict WebView to trusted origins only
        originWhitelist={TRUSTED_ORIGINS}
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
        allowsBackForwardNavigationGestures={Platform.OS === "ios"}
        decelerationRate={Platform.OS === "ios" ? "normal" : undefined}
        contentInsetAdjustmentBehavior={
          Platform.OS === "ios" ? "automatic" : undefined
        }
        // Pull to refresh (Android)
        pullToRefreshEnabled={true}
        // Render process handling
        onRenderProcessGone={(syntheticEvent) => {
          const { didCrash } = syntheticEvent.nativeEvent;
          console.error("[WebView] Render process gone, crashed:", didCrash);
          setError("The app encountered an issue. Please reload.");
        }}
        // Content process termination (iOS)
        onContentProcessDidTerminate={() => {
          console.error("[WebView] Content process terminated");
          webViewRef.current?.reload();
        }}
      />

      {/* Loading overlay — animated fade-out for smooth transition */}
      {showOverlay && (
        <Animated.View
          style={[styles.loadingOverlay, { opacity: overlayOpacity }]}
        >
          <LoadingScreen message="Loading your dashboard..." />
        </Animated.View>
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
    backgroundColor: "#F8FAFC",
  },
  containerDark: {
    backgroundColor: "#0F172A",
  },
  webView: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
});
