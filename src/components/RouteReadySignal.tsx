import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
} from "react";

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

    const doSignal = () => {
      if (cancelled) return;
      // Check if running in native app wrapper
      if (
        typeof window !== "undefined" &&
        window.isNativeApp?.() &&
        window.sendToNative
      ) {
        // Wait for multiple animation frames to ensure browser has painted
        requestAnimationFrame(() => {
          if (cancelled) return;
          requestAnimationFrame(() => {
            if (cancelled) return;
            window.sendToNative?.("APP_READY");
          });
        });
      }
    };

    // Wait for fonts to be ready before signaling
    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready
        .then(() => {
          if (!cancelled) {
            timeoutId = setTimeout(doSignal, 50);
          }
        })
        .catch(() => {
          if (!cancelled) {
            timeoutId = setTimeout(doSignal, 50);
          }
        });
    } else {
      timeoutId = setTimeout(doSignal, 100);
    }

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
