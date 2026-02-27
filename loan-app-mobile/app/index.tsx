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
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  PanResponder,
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
import { Ionicons } from "@expo/vector-icons";

import { WEB_APP_URL, TRUSTED_ORIGINS } from "@/config/env";
import {
  BridgeHandler,
  BRIDGE_INJECTION_SCRIPT,
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
  hasSeenLandingScreen,
  saveLandingScreenSeen,
} from "@/native/storage";

import LandingScreen from "@/components/LandingScreen";
import SkeletonLoading from "@/components/SkeletonLoading";
import OfflineScreen from "@/components/OfflineScreen";
import ErrorScreen from "@/components/ErrorScreen";

// ============================================================================
// CONSTANTS
// ============================================================================

/** Height of the native Android menu bar in pixels (React Native numeric value) */
const MENU_BAR_HEIGHT = 72;

// ============================================================================
// TYPES
// ============================================================================

type NativeMenuItem = {
  path: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  iconFilled?: React.ComponentProps<typeof Ionicons>["name"];
};

const NATIVE_MENU_ITEMS: NativeMenuItem[] = [
  { path: "/home", label: "Home", icon: "home-outline", iconFilled: "home" },
  {
    path: "/",
    label: "Add Customer",
    icon: "person-add-outline",
    iconFilled: "person-add",
  },
  {
    path: "/add-record",
    label: "Add Record",
    icon: "document-text-outline",
    iconFilled: "document-text",
  },
  {
    path: "/customers",
    label: "Customers",
    icon: "people-outline",
    iconFilled: "people",
  },
  {
    path: "/loans",
    label: "Loans",
    icon: "business-outline",
    iconFilled: "business",
  },
  {
    path: "/loan-seniority",
    label: "Loan Seniority",
    icon: "star-outline",
    iconFilled: "star",
  },
  {
    path: "/subscriptions",
    label: "Subscriptions",
    icon: "time-outline",
    iconFilled: "time",
  },
  {
    path: "/data",
    label: "Expenditure",
    icon: "server-outline",
    iconFilled: "server",
  },
  {
    path: "/summary",
    label: "Summary",
    icon: "book-outline",
    iconFilled: "book",
  },
];

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
  const deepLinkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDeepLinkPathRef = useRef<string | null>(null);
  const pendingDeepLinkIdRef = useRef<string | null>(null);
  const authSessionRef = useRef<AuthSession | null>(null);
  const handlerUnsubscribersRef = useRef<(() => void)[]>([]);
  const previousIsOfflineRef = useRef<boolean>(false);
  const hasInitiallyLoadedRef = useRef(false);
  const overlayOpacity = useRef(new Animated.Value(1)).current;

  // State
  const [showLanding, setShowLanding] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showOverlay, setShowOverlay] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(WEB_APP_URL);
  const [currentPath, setCurrentPath] = useState("/");
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [showNativeMenu, setShowNativeMenu] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  // Animated value for swipe-to-dismiss on native menu sheet
  const menuTranslateY = useRef(new Animated.Value(0)).current;
  const menuPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) =>
        gs.dy > 8 && Math.abs(gs.dy) > Math.abs(gs.dx),
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) menuTranslateY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 80 || gs.vy > 0.5) {
          Animated.timing(menuTranslateY, {
            toValue: 500,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            setShowNativeMenu(false);
            menuTranslateY.setValue(0);
          });
        } else {
          Animated.spring(menuTranslateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const nativePrimaryMenuItems = React.useMemo(
    () => NATIVE_MENU_ITEMS.slice(0, 3),
    [],
  );

  const getPathFromUrl = useCallback((url: string) => {
    try {
      const parsed = new URL(url);
      return parsed.pathname || "/";
    } catch {
      return "/";
    }
  }, []);

  const isPathActive = useCallback(
    (path: string) => {
      if (path === "/") return currentPath === "/";
      return currentPath === path || currentPath.startsWith(`${path}/`);
    },
    [currentPath],
  );

  const isLoginPath = useCallback((path: string) => {
    return path === "/login" || path.startsWith("/login/");
  }, []);

  const navigateToPath = useCallback((path: string) => {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    setCurrentPath(normalizedPath);
    setShowNativeMenu(false);

    if (hasInitiallyLoadedRef.current && webViewRef.current) {
      // SPA client-side navigation — React Router responds to pushState + popstate.
      // Keeps the WebView session alive (no reload), so DataContext in-memory data
      // is preserved. Screen never goes blank and no re-fetch is triggered.
      const safePathJSON = JSON.stringify(normalizedPath);
      webViewRef.current.injectJavaScript(
        `(function(){` +
          `window.history.pushState(null,'',${safePathJSON});` +
          `window.dispatchEvent(new PopStateEvent('popstate',{state:{}}));` +
        `})();true;`
      );
    } else {
      // App not yet loaded — fall back to full URL navigation
      setCurrentUrl(`${WEB_APP_URL}${normalizedPath}`);
    }
  }, []);

  const markInitiallyLoaded = useCallback(() => {
    if (!hasInitiallyLoadedRef.current) {
      hasInitiallyLoadedRef.current = true;
    }
  }, []);

  const completeStartupTransition = useCallback(
    (source: string) => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }

      console.log(`[WebView] ${source} - dismissing loading state`);
      setIsLoading(false);
      markInitiallyLoaded();
    },
    [markInitiallyLoaded],
  );

  // ============================================================================
  // CLEANUP PENDING TIMEOUTS ON UNMOUNT
  // ============================================================================

  useEffect(() => {
    return () => {
      // Clear any pending loading timeouts
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      // Clear any pending deep link timeouts
      if (deepLinkTimeoutRef.current) {
        clearTimeout(deepLinkTimeoutRef.current);
        deepLinkTimeoutRef.current = null;
      }
    };
  }, []);

  // Keep ref in sync with state for use in closures without re-running effect
  useEffect(() => {
    authSessionRef.current = authSession;
  }, [authSession]);

  // Toggle web CSS --menu-bar-height based on auth state (Android only)
  useEffect(() => {
    if (Platform.OS !== "android" || !webViewRef.current) return;
    const height = authSession ? "72px" : "0px";
    webViewRef.current.injectJavaScript(
      `(function(){ document.documentElement.style.setProperty('--menu-bar-height', '${height}'); })(); true;`
    );
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
  // LOAD LANDING SCREEN STATE ON MOUNT
  // ============================================================================

  useEffect(() => {
    hasSeenLandingScreen()
      .then((hasSeen) => {
        // If user has seen it before, skip landing screen. Otherwise show it.
        setShowLanding(!hasSeen);
      })
      .catch((error) => {
        console.error("[Storage] Failed to check landing screen state:", error);
        // On error, default to showing landing screen
        setShowLanding(true);
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
          } catch {
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
          console.log("[WebView] PAGE_LOADED signal received. Route:", route);
          if (typeof route === "string" && route.length > 0) {
            const normalizedPath = route.startsWith("http")
              ? getPathFromUrl(route)
              : route.startsWith("/")
                ? route
                : `/${route}`;
            setCurrentPath(normalizedPath);
          }
          completeStartupTransition("PAGE_LOADED signal received");
        }),
      );

      handlerUnsubscribersRef.current.push(
        bridgeRef.current.on("APP_READY", () => {
          completeStartupTransition("APP_READY signal received");
        }),
      );

      handlerUnsubscribersRef.current.push(
        bridgeRef.current.on("PROFILE_DROPDOWN_OPEN", (payload) => {
          const { isOpen } = payload as { isOpen: boolean };
          setIsProfileMenuOpen(isOpen);
          // Adjust the CSS menu-bar-height variable so the web layout
          // removes bottom padding while the profile dropdown is visible
          const height = isOpen ? "0px" : authSessionRef.current ? "72px" : "0px";
          webViewRef.current?.injectJavaScript(
            `(function(){ document.documentElement.style.setProperty('--menu-bar-height', '${height}'); })(); true;`
          );
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

      handlerUnsubscribersRef.current.push(
        bridgeRef.current.on("DEEP_LINK_ACK", (payload) => {
          const { path, requestId } = payload as {
            path: string;
            requestId?: string;
          };
          console.log("[DeepLink] Web acknowledged deep link for:", path);

          // Only clear timeout if this ACK is for the currently pending deep link
          // (Prevents late ACKs from clearing timeouts for newer deep links)
          if (
            requestId === pendingDeepLinkIdRef.current &&
            deepLinkTimeoutRef.current
          ) {
            clearTimeout(deepLinkTimeoutRef.current);
            deepLinkTimeoutRef.current = null;
            pendingDeepLinkPathRef.current = null;
            pendingDeepLinkIdRef.current = null;
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
  }, [completeStartupTransition, getPathFromUrl]);

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
        if (showNativeMenu) {
          setShowNativeMenu(false);
          return true;
        }
        if (canGoBack && webViewRef.current) {
          webViewRef.current.goBack();
          return true; // Prevent default behavior
        }
        return false; // Allow default back behavior (exit app)
      },
    );

    return () => backHandler.remove();
  }, [canGoBack, showNativeMenu]);

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

      // If bridge is not ready (cold start), navigate via reload immediately
      if (!bridgeRef.current) {
        const targetUrl = `${WEB_APP_URL}${path.startsWith("/") ? path : "/" + path}`;
        setCurrentUrl(targetUrl);
        pendingDeepLinkPathRef.current = null;
        pendingDeepLinkIdRef.current = null;
        return;
      }

      // Generate a unique ID for this deep link request to prevent race conditions
      const requestId = `${Date.now()}-${Math.random()}`;
      pendingDeepLinkPathRef.current = path;
      pendingDeepLinkIdRef.current = requestId;

      // If bridge is ready, try to send to web first
      bridgeRef.current.sendToWeb({
        type: "DEEP_LINK",
        payload: { url, path, requestId },
      });

      // Set a timeout to force reload if web doesn't ACK
      // Use shorter timeout for warm loads (app already open) since bridge is responsive
      // Use longer timeout for cold starts when app is still initializing
      const ackTimeoutMs = hasInitiallyLoadedRef.current ? 350 : 1200;

      if (deepLinkTimeoutRef.current) clearTimeout(deepLinkTimeoutRef.current);

      deepLinkTimeoutRef.current = setTimeout(() => {
        console.log(
          `[DeepLink] Web did not ACK in ${ackTimeoutMs}ms, forcing reload`,
        );
        const targetUrl = `${WEB_APP_URL}${path.startsWith("/") ? path : "/" + path}`;
        setCurrentUrl(targetUrl);
        deepLinkTimeoutRef.current = null;
        pendingDeepLinkPathRef.current = null;
        pendingDeepLinkIdRef.current = null;
      }, ackTimeoutMs);
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
      if (navState.url) {
        setCurrentPath(getPathFromUrl(navState.url));
      }
    },
    [getPathFromUrl],
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
    // After the initial load, never show skeleton again.
    // SPA navigations use History API (pushState/replaceState) which don't fire
    // onLoadStart anyway. This callback only fires for full page loads (cold start,
    // pull-to-refresh, error recovery). After initial load, those reloads use the
    // native pull-to-refresh spinner instead of the skeleton overlay.
    if (hasInitiallyLoadedRef.current) {
      console.log("[WebView] Load started (post-initial — skipping skeleton)");
      setError(null);
      return;
    }

    console.log("[WebView] Load started (initial load — showing skeleton)");
    setIsLoading(true);
    setError(null);
  }, []);

  const handleLoadEnd = useCallback(() => {
    console.log(
      "[WebView] HTML loaded. Waiting for readiness signal or timeout...",
    );

    // Dismiss loading screen fallback
    // We prefer the 'APP_READY' or 'PAGE_LOADED' signal from the web app,
    // but this ensures the overlay doesn't stay forever if the signals are missed.
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }

    // Prefer APP_READY signal, but use aggressive timeouts as safety net
    // Shorter timeout for subsequent loads since resources might be cached
    const isFirstLoad = !hasInitiallyLoadedRef.current;
    // extended timeout to allow for visual stability check (min 200ms + render time)
    // APP_READY signal will normally dismiss this much earlier
    const timeoutDuration = isFirstLoad ? 2000 : 500;

    loadingTimeoutRef.current = setTimeout(() => {
      console.log(
        `[WebView] Dismissing loading screen (handleLoadEnd fallback: ${timeoutDuration}ms)`,
      );
      completeStartupTransition(
        `handleLoadEnd fallback reached (${timeoutDuration}ms)`,
      );
    }, timeoutDuration);
  }, [completeStartupTransition]);

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

  // While loading landing screen state, render nothing (brief invisible load)
  if (showLanding === null) {
    return null;
  }

  // Show native landing screen on first launch
  if (showLanding) {
    return (
      <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
        <LandingScreen
          onContinue={async () => {
            // Mark landing as seen and dismiss
            await saveLandingScreenSeen();
            setShowLanding(false);
          }}
        />
      </SafeAreaView>
    );
  }

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
            <SkeletonLoading />
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
        style={[styles.webView, Platform.OS === "android" && authSession ? { paddingBottom: MENU_BAR_HEIGHT } : undefined]}
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
          <SkeletonLoading />
        </Animated.View>
      )}

      {Platform.OS === "android" && authSession && !isLoginPath(currentPath) && !showOverlay && (
        <>
          {!isProfileMenuOpen && (
          <View
            style={[styles.nativeMenuBar, isDark && styles.nativeMenuBarDark]}
          >
            {nativePrimaryMenuItems.map((item) => {
              const active = isPathActive(item.path);
              return (
                <Pressable
                  key={item.path}
                  style={styles.nativeMenuButton}
                  onPress={() => navigateToPath(item.path)}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                >
                  <Ionicons
                    name={active ? (item.iconFilled ?? item.icon) : item.icon}
                    size={22}
                    color={active ? "#4F46E5" : isDark ? "#94A3B8" : "#64748B"}
                  />
                  <Text
                    style={[
                      styles.nativeMenuLabel,
                      {
                        color: active
                          ? "#4F46E5"
                          : isDark
                            ? "#94A3B8"
                            : "#64748B",
                      },
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}

            <Pressable
              style={styles.nativeMenuButton}
              onPress={() => setShowNativeMenu(true)}
            >
              <Ionicons
                name="chevron-up"
                size={22}
                color={
                  showNativeMenu ? "#4F46E5" : isDark ? "#94A3B8" : "#64748B"
                }
              />
              <Text
                style={[
                  styles.nativeMenuLabel,
                  {
                    color: showNativeMenu
                      ? "#4F46E5"
                      : isDark
                        ? "#94A3B8"
                        : "#64748B",
                  },
                ]}
              >
                More
              </Text>
            </Pressable>
          </View>
          )}
          <Modal
            visible={showNativeMenu}
            transparent
            animationType="fade"
            onRequestClose={() => setShowNativeMenu(false)}
            onShow={() => menuTranslateY.setValue(0)}
          >
            <View style={styles.nativeMenuBackdrop}>
              <Pressable
                style={StyleSheet.absoluteFillObject}
                onPress={() => setShowNativeMenu(false)}
              />
              <Animated.View
                style={[
                  styles.nativeMenuSheet,
                  isDark && styles.nativeMenuSheetDark,
                  { transform: [{ translateY: menuTranslateY }] },
                ]}
              >
                <View style={styles.nativeSheetHeader}>
                  <View style={styles.nativeSheetHandleArea} {...menuPanResponder.panHandlers}>
                    <View style={styles.nativeSheetHandle} />
                  </View>
                  <Pressable
                    style={styles.nativeSheetCloseButton}
                    onPress={() => setShowNativeMenu(false)}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel="Close menu"
                    accessibilityHint="Closes the modal menu"
                    accessibilityState={{ disabled: false }}
                  >
                    <Ionicons
                      name="close"
                      size={24}
                      color={isDark ? "#E2E8F0" : "#1E293B"}
                    />
                  </Pressable>
                </View>
                <ScrollView
                  contentContainerStyle={styles.nativeSheetScroll}
                  showsVerticalScrollIndicator={true}
                >
                  {NATIVE_MENU_ITEMS.map((item) => {
                    const active = isPathActive(item.path);
                    return (
                      <Pressable
                        key={item.path}
                        style={[
                          styles.nativeSheetItem,
                          active && styles.nativeSheetItemActive,
                        ]}
                        onPress={() => navigateToPath(item.path)}
                      >
                        <Ionicons
                          name={
                            active ? (item.iconFilled ?? item.icon) : item.icon
                          }
                          size={20}
                          color={
                            active ? "#4F46E5" : isDark ? "#CBD5E1" : "#334155"
                          }
                        />{" "}
                        <Text
                          style={[
                            styles.nativeSheetItemText,
                            {
                              color: active
                                ? "#4F46E5"
                                : isDark
                                  ? "#E2E8F0"
                                  : "#0F172A",
                            },
                          ]}
                        >
                          {item.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                  <View style={{ height: 1, backgroundColor: isDark ? "#334155" : "#E2E8F0", marginVertical: 6, marginHorizontal: 12 }} />
                  <Pressable
                    style={styles.nativeSheetItem}
                    onPress={() => {
                      setShowNativeMenu(false);
                      webViewRef.current?.injectJavaScript(
                        `window.dispatchEvent(new CustomEvent('native:open-profile')); true;`
                      );
                    }}
                  >
                    <View style={styles.profileInitialCircle}>
                      <Text style={styles.profileInitialText}>
                        {(authSession?.user?.email?.charAt(0) || "U").toUpperCase()}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.nativeSheetItemText,
                        { color: isDark ? "#E2E8F0" : "#0F172A" },
                      ]}
                    >
                      Profile
                    </Text>
                  </Pressable>
                </ScrollView>
              </Animated.View>
            </View>
          </Modal>
        </>
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
  nativeMenuBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: MENU_BAR_HEIGHT,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 8,
    zIndex: 60,
  },
  nativeMenuBarDark: {
    backgroundColor: "#111827",
    borderTopColor: "#334155",
  },
  nativeMenuButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  nativeMenuLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
  nativeMenuBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.35)",
  },
  nativeMenuSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    maxHeight: "82%",
  },
  nativeMenuSheetDark: {
    backgroundColor: "#111827",
    borderTopColor: "#334155",
  },
  nativeSheetHandleArea: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
  },
  nativeSheetHandle: {
    width: 56,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#94A3B8",
    alignSelf: "center",
  },
  nativeSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 0,
    marginBottom: 12,
  },
  nativeSheetCloseButton: {
    padding: 8,
    marginRight: -8,
  },
  nativeSheetItem: {
    minHeight: 46,
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  nativeSheetItemActive: {
    backgroundColor: "rgba(79, 70, 229, 0.12)",
  },
  nativeSheetItemText: {
    fontSize: 14,
    fontWeight: "600",
  },
  nativeSheetScroll: {
    paddingVertical: 4,
    // Allow the scroll area to expand/contract based on content
    // while respecting the maxHeight on the parent container
  },
  profileInitialCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#4F46E5",
    alignItems: "center",
    justifyContent: "center",
  },
  profileInitialText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
});
