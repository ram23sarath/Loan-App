import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
} from "react";
import {
  initVisualStability,
  isVisuallyStable,
} from "../utils/visualStability";

/**
 * Context for route readiness signaling.
 * Pages call signalRouteReady() when their content is mounted and ready,
 * not when the route changes. This ensures Suspense boundaries have resolved
 * before the native overlay dismisses.
 */
const RouteReadinessContext = createContext<{
  signalReady: () => void;
}>({
  signalReady: () => {},
});

/**
 * Hook for pages to signal when their content is ready.
 * Call this from individual page components after mount/data load.
 */
export const useRouteReady = () => {
  const { signalReady } = useContext(RouteReadinessContext);
  return signalReady;
};

/**
 * Provider wrapper that handles readiness signaling to native wrapper.
 * Wraps Routes to capture readiness signals from child pages.
 */
export const RouteReadySignal: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const signalReady = useCallback(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const doSignal = async () => {
      if (cancelled) return;
      // Check if running in native app wrapper
      if (
        typeof window !== "undefined" &&
        window.isNativeApp?.() &&
        window.sendToNative
      ) {
        // Wait for visual stability (layout shifts, paint, fonts)
        await isVisuallyStable();

        if (cancelled) return;

        // Additional frame wait to ensure render
        requestAnimationFrame(() => {
          if (cancelled) return;
          window.sendToNative?.("PAGE_LOADED", {
            route: window.location.pathname,
            title: document.title,
          });
          window.sendToNative?.("APP_READY");
        });
      }
    };

    // Initialize checking immediately if not already done
    initVisualStability();

    // Execute signal logic
    doSignal().catch((err) => {
      console.error("Route ready signal failed:", err);
    });
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  return (
    <RouteReadinessContext.Provider value={{ signalReady }}>
      {children}
    </RouteReadinessContext.Provider>
  );
};
