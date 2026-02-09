/**
 * Visual Stability Utility
 *
 * Tracks layout shifts and paint timings to determine when the page is visually stable.
 * This is used to delay the dismissal of the native loading overlay until the
 * web content has settled, preventing CLS and flickering.
 */

let lastLayoutShiftTime = 0;
let hasObservedPaint = false;
let observer: PerformanceObserver | null = null;
let isInitialized = false;

/**
 * Initialize visual stability tracking.
 * Should be called as early as possible in the app lifecycle.
 */
export function initVisualStability() {
    if (isInitialized || typeof window === 'undefined') return;
    isInitialized = true;

    try {
        if (typeof PerformanceObserver === 'function') {
            observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.entryType === 'layout-shift' && !(entry as any).hadRecentInput) {
                        lastLayoutShiftTime = performance.now();
                    } else if (entry.entryType === 'paint' || entry.entryType === 'largest-contentful-paint') {
                        hasObservedPaint = true;
                    }
                }
            });

            // Some browsers throw if you observe an unsupported entry type. Guard with supportedEntryTypes.
            const supported: string[] = (PerformanceObserver as any).supportedEntryTypes || [];
            const tryObserve = (type: string) => {
                if (supported.includes(type)) {
                    try {
                        observer!.observe({ type, buffered: true });
                    } catch (e) {
                        // Best-effort: ignore observe failures for specific types
                    }
                }
            };

            tryObserve('layout-shift');
            tryObserve('paint');
            // LCP is also a good indicator of main content being visible
            tryObserve('largest-contentful-paint');
        }
    } catch (e) {
        console.warn('[VisualStability] PerformanceObserver not supported or failed:', e);
    }
}

/**
 * Disconnects observers and resets internal state. Useful for tests or when disabling visual stability.
 */
export function shutdownVisualStability() {
    try {
        observer?.disconnect();
    } catch (e) {
        // ignore
    }
    observer = null;
    isInitialized = false;
    lastLayoutShiftTime = 0;
    hasObservedPaint = false;
}

/**
 * Checks if the page is currently visually stable.
 * Returns a promise that resolves when:
 * 1. No layout shifts have occurred for 200ms
 * 2. AND at least one paint has occurred (or timeout)
 * 3. AND fonts are ready
 *
 * Resolves immediately if already stable, or waits up to maxWaitMs (default 500ms).
 */
export function isVisuallyStable(maxWaitMs = 500): Promise<boolean> {
    if (typeof window === 'undefined') return Promise.resolve(true);

    return new Promise((resolve) => {
        const startTime = performance.now();
        let checkInterval: ReturnType<typeof setInterval>;
        let fallbackTimeout: ReturnType<typeof setTimeout>;
        const cleanup = () => {
            clearInterval(checkInterval);
            clearTimeout(fallbackTimeout);
        };

        // Fallback safety timeout
        fallbackTimeout = setTimeout(() => {
            cleanup();
            // Resolve true anyway to prevent hanging
            resolve(true);
        }, maxWaitMs);

        const check = () => {
            const now = performance.now();
            const timeSinceLastShift = now - lastLayoutShiftTime;
            const fontsReady = document.fonts ? document.fonts.status === 'loaded' : true;

            // Paint check is soft requirement - if we've waited long enough without paint, proceed
            // But we prefer to wait for at least one paint
            const paintCondition = hasObservedPaint || (now - startTime > 100);

            if (timeSinceLastShift >= 200 && fontsReady && paintCondition) {
                cleanup();
                resolve(true);
            }
        };

        // Check frequently
        checkInterval = setInterval(check, 50);

        // Perform initial check
        check();
    });
}
