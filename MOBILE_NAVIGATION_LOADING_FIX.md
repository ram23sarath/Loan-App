# Mobile Navigation Loading Issue - Root Cause and Fix

## Problem Summary

After implementing the initial loading fix, the mobile app now loads successfully on first launch. However, **navigation between pages is broken** - the loading screen appears on every navigation and never dismisses properly, making the app unusable after the first page load.

## Log Analysis

```
LOG  [Bridge] Received: PAGE_LOADED
LOG  [WebView] Web app ready - dismissing loading screen. Route: /summary
LOG  [WebView] Load started
LOG  [WebView] Load started
LOG  [Bridge] Received: PAGE_LOADED
LOG  [WebView] Web app ready - dismissing loading screen. Route: /
```

**Key observations:**

1. ✅ Initial login works - `AUTH_SESSION_UPDATE` received and saved
2. ✅ First page load works - `PAGE_LOADED` for `/login` and `/`
3. ❌ Navigation triggers multiple `Load started` events
4. ❌ Loading overlay shows on every navigation
5. ❌ Duplicate `PAGE_LOADED` signals are being sent

## Root Cause Analysis

### Issue 1: WebView Fires `onLoadStart` on SPA Navigation

**Problem:** React Native WebView's `onLoadStart` event fires on **every navigation**, including client-side Single Page Application (SPA) navigation. This is expected behavior for WebView, but our app treats every `onLoadStart` as a full page reload.

**Current behavior in [loan-app-mobile/app/index.tsx](loan-app-mobile/app/index.tsx) (line 496):**

```typescript
const handleLoadStart = useCallback(() => {
  console.log("[WebView] Load started");
  setIsLoading(true); // Shows loading overlay
  setError(null);
}, []);
```

**Impact:** Every time user navigates (e.g., `/summary` → `/add-record`), the loading overlay appears because `isLoading` is set to `true`.

### Issue 2: Duplicate `PAGE_LOADED` Signals

**Two sources sending `PAGE_LOADED`:**

1. **DataProvider mount** ([src/context/DataContext.tsx](src/context/DataContext.tsx), lines 1385-1402):
   - Sends `PAGE_LOADED` immediately when component mounts
   - This was added to fix the infinite loading issue

2. **Bridge History API interception** ([loan-app-mobile/native/bridge.ts](loan-app-mobile/native/bridge.ts), lines 243-283):
   - Intercepts `history.pushState` and `history.replaceState`
   - Sends `PAGE_LOADED` on every URL change
   - Includes initial load via `window.addEventListener('load')`

**Impact:**

- On initial load: DataProvider sends signal + Bridge sends signal = 2x `PAGE_LOADED`
- On navigation: Bridge sends `PAGE_LOADED` for URL change
- Race conditions between loading state updates

### Issue 3: Loading State Management Race Condition

**Sequence of events on navigation:**

1. User clicks navigation link
2. React Router changes URL (client-side)
3. **WebView `onLoadStart` fires** → `setIsLoading(true)`
4. Bridge detects URL change → sends `PAGE_LOADED`
5. Mobile receives `PAGE_LOADED` → `setIsLoading(false)`

**Problem:** Steps 3 and 5 happen nearly simultaneously, causing:

- Loading overlay flashes on screen
- Sometimes overlay gets stuck if race condition goes wrong
- Multiple `Load started` events cause multiple overlapping state updates

## Solution

### Strategy

**Distinguish between initial page load and SPA navigation:**

1. Only show loading overlay on **initial app load**
2. Let the web app handle loading indicators on navigation
3. Remove duplicate `PAGE_LOADED` signals
4. Track app initialization state

### Implementation

#### Fix 1: Track Initial Load State (Mobile Side)

**File:** [loan-app-mobile/app/index.tsx](loan-app-mobile/app/index.tsx)

Add state to track if app has completed initial load:

```typescript
// Add near other state declarations (around line 74)
const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);
```

Modify `handleLoadStart` to only show loading on initial load:

```typescript
// Replace existing handleLoadStart (line 496)
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
```

Update `PAGE_LOADED` handler to mark initial load complete:

```typescript
// Find the PAGE_LOADED handler (around line 263) and modify it:
handlerUnsubscribersRef.current.push(
  bridgeRef.current.on("PAGE_LOADED", (payload) => {
    const { route } = payload as { route: string; title?: string };

    // Clear fallback timeout - page confirmed ready
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

    // Mark that initial load is complete
    if (!hasInitiallyLoaded) {
      setHasInitiallyLoaded(true);
      console.log(
        "[WebView] Initial load complete - subsequent navigations will not show loading overlay",
      );
    }
  }),
);
```

#### Fix 2: Remove Duplicate PAGE_LOADED from DataProvider (Web Side)

**File:** [src/context/DataContext.tsx](src/context/DataContext.tsx)

**REMOVE** the useEffect added in the previous fix (lines 1385-1402):

```typescript
// DELETE THIS ENTIRE useEffect BLOCK (lines 1385-1402):
// Report initial page render to native wrapper immediately
// This allows native to dismiss its loading screen and show the web app's loading indicators
// FIX: Previously, PAGE_LOADED was only sent after all data loaded (5-60s delay)
// Now we send it immediately on mount so native loading dismisses in <1 second
useEffect(() => {
  const isNative = typeof window !== "undefined" && window.isNativeApp?.();
  if (!isNative) return;

  // Send PAGE_LOADED immediately when DataProvider mounts
  // Don't wait for data to load - web app has its own loading indicators
  console.log(
    "[NativeBridge] Reporting initial page render to native (DataProvider mounted)",
  );
  window.NativeBridge?.reportPageLoad(
    window.location.pathname || "/",
    "I J Reddy Loan App",
  );
}, []); // Empty dependency array - run once on mount only
```

**Reasoning:** The bridge.ts script already handles sending `PAGE_LOADED`:

- On initial page load via `window.addEventListener('load')`
- On navigation via History API interception
- Having DataProvider also send it creates duplicates

#### Fix 3: Improve Bridge PAGE_LOADED Timing (Optional Enhancement)

**File:** [loan-app-mobile/native/bridge.ts](loan-app-mobile/native/bridge.ts)

The current bridge sends `PAGE_LOADED` on every URL change. This is correct, but we can add a small delay to ensure React has finished rendering:

```typescript
// Modify notifyUrlChange function (around line 247)
var notifyUrlChange = function () {
  var newUrl = window.location.href;
  if (newUrl !== lastUrl) {
    lastUrl = newUrl;
    console.log("[NativeBridge] URL changed to:", lastUrl);

    // Give React a moment to complete render before signaling
    // This ensures components are mounted and visible when native dismisses loading
    setTimeout(function () {
      if (window.sendToNative) {
        window.sendToNative("PAGE_LOADED", { route: window.location.pathname });
      }
    }, 50); // 50ms delay - imperceptible to users but ensures render completes
  }
};
```

## Files to Modify

### Required Changes:

1. **[loan-app-mobile/app/index.tsx](loan-app-mobile/app/index.tsx)**
   - Add `hasInitiallyLoaded` state
   - Modify `handleLoadStart` to check `hasInitiallyLoaded`
   - Update `PAGE_LOADED` handler to set `hasInitiallyLoaded`

2. **[src/context/DataContext.tsx](src/context/DataContext.tsx)**
   - Remove the duplicate `PAGE_LOADED` useEffect (lines 1385-1402)

### Optional Enhancement:

3. **[loan-app-mobile/native/bridge.ts](loan-app-mobile/native/bridge.ts)**
   - Add 50ms delay in `notifyUrlChange` before sending `PAGE_LOADED`

## Expected Behavior After Fix

### Initial Load:

1. User opens mobile app
2. Native loading screen shows
3. WebView loads HTML → `handleLoadStart` called → `isLoading = true`
4. React renders → Bridge detects page load → sends `PAGE_LOADED`
5. Mobile receives signal → `setIsLoading(false)` + `setHasInitiallyLoaded(true)`
6. **Loading overlay dismisses** (total: <1 second)

### Navigation (e.g., /summary → /add-record):

1. User clicks navigation link
2. React Router changes URL (client-side)
3. WebView `onLoadStart` fires
4. **`handleLoadStart` checks `hasInitiallyLoaded === true` → does NOT show loading**
5. Bridge detects URL change → sends `PAGE_LOADED`
6. Mobile receives signal (no-op since already not loading)
7. **Web app shows its own navigation transition** (no native loading overlay)

### Key Improvements:

✅ Initial load shows loading screen (good UX)  
✅ Navigation does NOT show loading screen (smooth transitions)  
✅ No duplicate `PAGE_LOADED` signals  
✅ No race conditions in loading state  
✅ Web app's own loading indicators visible during data fetches

## Testing Checklist

### Mobile App Testing:

- [ ] Initial app launch shows loading screen briefly (<1 second)
- [ ] First page load after login works correctly
- [ ] Navigate to different pages (Summary, Add Record, Loans, etc.)
- [ ] **Navigation should be instant with no loading overlay**
- [ ] Check console logs - no duplicate `PAGE_LOADED` signals
- [ ] Check for "SPA navigation detected - not showing loading overlay" log

### Edge Cases:

- [ ] App state changes (background/foreground) don't break navigation
- [ ] Deep links work correctly
- [ ] Back button navigation works
- [ ] Logout and login again - initial loading works
- [ ] Slow network - web app's loading indicators should show

### Regression Testing:

- [ ] Web app in browser still works normally (no native impacts)
- [ ] Login/logout flow works
- [ ] Data loading works
- [ ] Pull-to-refresh works (if implemented)

## Detailed Code Changes

### Change 1: Mobile App State Management

**Location:** [loan-app-mobile/app/index.tsx](loan-app-mobile/app/index.tsx)

**Add state (after line 74):**

```typescript
const [isLoading, setIsLoading] = useState(true);
const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false); // ADD THIS
const [isOffline, setIsOffline] = useState(false);
```

**Replace handleLoadStart (lines 496-500):**

```typescript
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
```

**Update PAGE_LOADED handler (find around line 263, inside bridgeRef.current.on("PAGE_LOADED")):**

```typescript
handlerUnsubscribersRef.current.push(
  bridgeRef.current.on("PAGE_LOADED", (payload) => {
    const { route } = payload as { route: string; title?: string };

    // Clear fallback timeout - page confirmed ready
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
```

### Change 2: Remove Duplicate Signal

**Location:** [src/context/DataContext.tsx](src/context/DataContext.tsx)

**Remove lines 1385-1402** (the entire useEffect block added in previous fix)

The comment block that says "REMOVED: Old useEffect..." on line 1903 can stay as documentation.

## Alternative Solution (If Issues Persist)

If the above fix doesn't fully resolve the issue, consider this alternative approach:

### Debounce Loading State Updates

Add debouncing to prevent rapid state changes:

```typescript
// In loan-app-mobile/app/index.tsx
const loadingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

const setIsLoadingDebounced = useCallback(
  (loading: boolean) => {
    if (loadingDebounceRef.current) {
      clearTimeout(loadingDebounceRef.current);
    }

    // Immediate hide, but debounce show
    if (!loading) {
      setIsLoading(false);
    } else if (!hasInitiallyLoaded) {
      loadingDebounceRef.current = setTimeout(() => {
        setIsLoading(true);
      }, 100); // 100ms debounce
    }
  },
  [hasInitiallyLoaded],
);
```

## Summary

The navigation loading issue is caused by:

1. ❌ WebView's `onLoadStart` firing on every navigation (expected behavior)
2. ❌ Mobile app showing loading overlay on every `onLoadStart` (wrong)
3. ❌ Duplicate `PAGE_LOADED` signals from DataProvider and Bridge (conflicts)

The fix:

1. ✅ Track if initial load is complete via `hasInitiallyLoaded` state
2. ✅ Only show loading overlay on initial load, not on SPA navigation
3. ✅ Remove duplicate `PAGE_LOADED` from DataProvider
4. ✅ Let Bridge handle all `PAGE_LOADED` signals via History API

**Result:** Smooth, instant navigation with no loading overlays after initial load, while still showing proper loading on first launch.
