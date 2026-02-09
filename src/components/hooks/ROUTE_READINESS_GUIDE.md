# Route Readiness Integration Guide

## Overview

The `useRouteReady()` hook signals to the native mobile wrapper when a page component is ready to display. This ensures the native loading overlay dismisses only after:

1. Fonts are loaded
2. Suspense boundaries have resolved
3. Component is mounted and rendered

## Why This Matters

Without proper signaling, the native overlay can dismiss too early, exposing:

- Loading spinners
- Blank screens
- Layout jank/flashing

## How to Integrate

### Step 1: Import the hook

```tsx
import { useRouteReady } from "../RouteReadySignal";
```

### Step 2: Call the hook in your page component

```tsx
const signalRouteReady = useRouteReady();
```

### Step 3: Signal readiness in a useEffect

Call the `signalRouteReady()` function after the component's main content is mounted:

```tsx
useEffect(() => {
  // ... component initialization code ...

  // Signal when this page is ready to display
  signalRouteReady();

  return () => {
    // cleanup code
  };
}, [signalRouteReady]); // Include signalRouteReady in dependency array
```

## Example

```tsx
import { useRouteReady } from "../RouteReadySignal";

const MyPage = () => {
  const signalRouteReady = useRouteReady();

  useEffect(() => {
    // Load data, etc.
    fetchMyData();

    // Signal ready when mounted
    signalRouteReady();
  }, [signalRouteReady]);

  return <div>{/* content */}</div>;
};
```

## Notes

- Call `signalRouteReady()` once per page mount
- Place it in a useEffect that runs on mount (include in dependency array)
- If a page doesn't call it, readiness won't signal for that route
- The hook handles font loading and animation frame delays automatically
