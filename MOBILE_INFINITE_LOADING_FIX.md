# Mobile App Infinite Loading - Root Cause and Fix

## Problem Summary

The Expo mobile app (`loan-app-mobile`) displays a loading screen indefinitely when loading the web application in its WebView. The loading screen only dismisses after a 60-second fallback timeout.

## Root Cause Analysis

### Current Flow

1. **Mobile app initialized** ([loan-app-mobile/app/index.tsx](loan-app-mobile/app/index.tsx))
   - Sets `isLoading = true` on mount (line 74)
   - Displays `<LoadingScreen>` component overlay (line 656)
   - Waits for `PAGE_LOADED` message from web app to dismiss loading

2. **WebView loads web application**
   - Bridge injection script runs ([loan-app-mobile/native/bridge.ts](loan-app-mobile/native/bridge.ts), line 152-438)
   - Sets up `window.sendToNative()` and `window.NativeBridge` API
   - Does NOT automatically send `PAGE_LOADED` signal

3. **Web app initializes** ([src/context/DataContext.tsx](src/context/DataContext.tsx))
   - `DataProvider` mounts with `loading = true` (line 267)
   - `initializeSession()` executes (lines 1572-1862):
     - Checks for native auth token (waits up to 3 seconds for `AUTH_TOKEN` message)
     - Establishes Supabase session
     - Fetches ALL data from 5 tables (customers, loans, subscriptions, installments, data_entries)
     - Fetches seniority list
     - Only AFTER all fetches complete: `setLoading(false)` (line 1839)

4. **PAGE_LOADED finally sent** ([src/context/DataContext.tsx](src/context/DataContext.tsx), lines 1901-1910)
   - `useEffect` depends on `loading` state
   - Calls `window.NativeBridge?.reportPageLoad()` when `loading` becomes false
   - This happens ONLY after all data is loaded

5. **Mobile receives PAGE_LOADED**
   - Handler on line 263 of [loan-app-mobile/app/index.tsx](loan-app-mobile/app/index.tsx) sets `isLoading = false`
   - Loading screen overlay dismissed

### Why This Causes Infinite Loading

- **Data fetching can be slow**: Multiple paginated queries (1000 rows per batch)
- **Network latency**: Each fetch adds seconds to total load time
- **Large datasets**: Customers with many records experience longer delays
- **Auth delays**: Native auth token exchange can take 2-3 seconds
- **Fallback timeout**: If `PAGE_LOADED` never arrives, mobile waits 60 seconds before forcing dismissal

**Result**: User sees loading screen for 5-60+ seconds instead of <1 second.

## Solution

### Strategy

**Send `PAGE_LOADED` signal immediately after React DOM renders, NOT after data loads.**

This allows:

- Mobile app dismisses its native loading screen quickly (<500ms)
- Web app displays its own loading indicators (spinners, skeletons)
- Data loads in background while UI is interactive
- Better user experience with visible progress

### Implementation

#### Option 1: Send on DataProvider Mount (Recommended)

**File**: [src/context/DataContext.tsx](src/context/DataContext.tsx)

Add a new `useEffect` that runs once on mount, independent of data loading:

```typescript
// Add this AFTER the Native Bridge Integration useEffect (around line 1380)
// and BEFORE the existing "Report page load completion" useEffect (line 1901)

// Report initial page render to native wrapper immediately
// This allows native to dismiss its loading screen and show the web app's loading indicators
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

**Then REMOVE or MODIFY the existing effect** (lines 1901-1910) to prevent duplicate signals:

```typescript
// OPTION A: Remove this entire useEffect block (lines 1901-1910)
// Page load is now reported on mount instead of after data loads

// OPTION B: Or keep it but add a flag to prevent duplicate signals
const hasReportedPageLoad = useRef(false);

useEffect(() => {
  if (
    !loading &&
    typeof window !== "undefined" &&
    window.isNativeApp?.() &&
    !hasReportedPageLoad.current
  ) {
    console.log("[NativeBridge] Data loaded, confirming page ready to native");
    window.NativeBridge?.reportPageLoad(
      window.location.pathname || "/",
      document.title || "I J Reddy Loan App",
    );
    hasReportedPageLoad.current = true;
  }
}, [loading]);
```

#### Option 2: Send from App.tsx (Alternative)

**File**: [src/App.tsx](src/App.tsx)

Add a `useEffect` in the main `App` component that sends `PAGE_LOADED` after React hydration:

```typescript
// Add inside the App component (around line 363, after profileRef declaration)

React.useEffect(() => {
  const isNative =
    typeof window !== "undefined" &&
    (typeof (window as any).ReactNativeWebView !== "undefined" ||
      navigator.userAgent.includes("LoanAppMobile"));

  if (isNative) {
    // Give React a brief moment to paint the DOM (prevents flash)
    const timer = setTimeout(() => {
      console.log("[NativeBridge] App rendered, reporting page load to native");
      (window as any).NativeBridge?.reportPageLoad(
        window.location.pathname || "/",
        "I J Reddy Loan App",
      );
    }, 100); // 100ms delay allows initial render to complete

    return () => clearTimeout(timer);
  }
}, []);
```

### Which Option to Choose?

**Recommendation: Option 1 (DataProvider mount)**

**Pros**:

- Data context is already set up for native bridge communication
- Consistent with existing bridge integration pattern
- Easy to maintain alongside other native handlers

**Cons**:

- DataProvider is nested inside ThemeProvider, so very slight delay

**Option 2 pros/cons**:

- ✅ Sends signal earlier (App mounts before providers)
- ❌ Duplicates native detection logic
- ❌ Breaks the pattern of DataContext owning all native bridge logic

## Testing Checklist

After implementing the fix:

### Mobile Testing

- [ ] Open mobile app on Android device/emulator
- [ ] Verify loading screen dismisses in <1 second
- [ ] Web app's loading indicators should be visible immediately
- [ ] Check console logs for `"[NativeBridge] Reporting initial page render to native"`
- [ ] Test on iOS device/simulator
- [ ] Verify no duplicate `PAGE_LOADED` signals (check mobile logs)

### Fallback Testing

- [ ] Disconnect network, verify offline screen shows (not infinite loading)
- [ ] Restore network, verify app recovers
- [ ] Test with slow 3G network simulation

### Regression Testing

- [ ] Web app in browser (non-mobile) should work normally
- [ ] Login/logout flow should work
- [ ] Data loading spinners should appear while data fetches
- [ ] Navigation between routes should work
- [ ] Deep links should work

## Files to Modify

1. **[src/context/DataContext.tsx](src/context/DataContext.tsx)**
   - Add new `useEffect` to send `PAGE_LOADED` on mount (around line 1380)
   - Remove or modify existing `useEffect` at lines 1901-1910

2. **Optional: [src/App.tsx](src/App.tsx)** (if using Option 2)
   - Add `useEffect` in App component to send early signal

## Expected Behavior After Fix

### Before Fix

1. User opens mobile app
2. Native loading screen shows "Loading your dashboard..."
3. WebView loads HTML
4. React hydrates
5. DataContext initializes
6. Auth token exchanged (2-3s)
7. All data fetched (3-10s depending on data size)
8. `loading` becomes false
9. `PAGE_LOADED` sent
10. **Native loading screen dismisses** (total: 5-60 seconds)

### After Fix

1. User opens mobile app
2. Native loading screen shows "Loading your dashboard..."
3. WebView loads HTML
4. React hydrates
5. DataContext mounts
6. **`PAGE_LOADED` sent immediately**
7. **Native loading screen dismisses** (total: <1 second)
8. Web app shows its own loading indicators
9. Data loads in background (auth, fetches)
10. Web loading indicators hide when data ready

## Additional Improvements (Optional)

### 1. Add Loading Progress Indicator

Show progress during data initialization:

```typescript
const [loadingProgress, setLoadingProgress] = useState(0);

// In initializeSession, update progress:
setLoadingProgress(20); // Auth started
// ... auth code ...
setLoadingProgress(50); // Auth complete, fetching data
// ... fetch code ...
setLoadingProgress(100); // Done
```

### 2. Retry Logic for Failed Fetches

Add retry buttons to error states instead of relying on fallback timeout.

### 3. Reduce Initial Data Load

Consider lazy-loading some data (e.g., seniority list, deleted items) on-demand instead of on startup.

### 4. Native Splash Screen Duration

After web sends `PAGE_LOADED` quickly, you could extend the native splash for visual polish:

**File**: [loan-app-mobile/app/\_layout.tsx](loan-app-mobile/app/_layout.tsx)

Change line 28:

```typescript
await new Promise((resolve) => setTimeout(resolve, 50)); // Currently 50ms
```

To:

```typescript
await new Promise((resolve) => setTimeout(resolve, 800)); // 800ms for smooth transition
```

## Related Files Reference

- **Mobile app entry**: [loan-app-mobile/app/index.tsx](loan-app-mobile/app/index.tsx)
- **Bridge definition**: [loan-app-mobile/native/bridge.ts](loan-app-mobile/native/bridge.ts)
- **Web data context**: [src/context/DataContext.tsx](src/context/DataContext.tsx)
- **Web app entry**: [src/App.tsx](src/App.tsx)
- **Integration guide**: [loan-app-mobile/docs/WEB_INTEGRATION_SAMPLE.ts](loan-app-mobile/docs/WEB_INTEGRATION_SAMPLE.ts)

## Summary

The infinite loading is caused by the mobile app waiting for a `PAGE_LOADED` signal that the web app only sends AFTER all data is loaded. The fix is to send this signal immediately when the React app mounts, allowing the mobile loading screen to dismiss quickly while the web app displays its own loading indicators.

**Implement Option 1 (DataProvider mount) for the quickest and most maintainable solution.**
