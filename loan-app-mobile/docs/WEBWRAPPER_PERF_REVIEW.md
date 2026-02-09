# Web Wrapper Performance Triage (Loan App Mobile)

## Scope

This review focuses on the WebView wrapper in the mobile app, the injected bridge, and loading/overlay behavior that can introduce perceived delays or jank.

Primary files reviewed:
- [loan-app-mobile/app/index.tsx](loan-app-mobile/app/index.tsx)
- [loan-app-mobile/native/bridge.ts](loan-app-mobile/native/bridge.ts)
- [loan-app-mobile/components/LoadingScreen.tsx](loan-app-mobile/components/LoadingScreen.tsx)
- [loan-app-mobile/components/OfflineScreen.tsx](loan-app-mobile/components/OfflineScreen.tsx)
- [loan-app-mobile/components/ErrorScreen.tsx](loan-app-mobile/components/ErrorScreen.tsx)
- [loan-app-mobile/docs/MESSAGE_PROTOCOL.md](loan-app-mobile/docs/MESSAGE_PROTOCOL.md)

Runtime dependencies involved:
- react-native-webview
- expo
- react-native
- expo-linking
- expo-notifications
- expo-device
- @react-native-community/netinfo


## Findings and Recommendations

### 1) Loading overlay fallback forces a fixed 1.5s delay on full WebView loads

**Evidence**
- [loan-app-mobile/app/index.tsx](loan-app-mobile/app/index.tsx#L594-L609) uses a 1500ms timeout in `handleLoadEnd` before dismissing the overlay.
- [loan-app-mobile/app/index.tsx](loan-app-mobile/app/index.tsx#L342-L366) relies on `PAGE_LOADED` to clear the timeout and dismiss the overlay when the web app signals readiness.

**Why it matters**
- When the web app performs a full document navigation (or a deep link triggers a reload), the UI will always wait at least 1.5s before the overlay disappears. This matches the user-reported 1s delay and creates the perception that navigation is slow even when the page is already interactive.

**Recommendation**
- Reduce the fallback to a much smaller value (100-300ms), and prefer a deterministic web-to-native readiness signal. The fallback should only prevent a blank screen, not define the perceived speed.
- Ensure the web app sends `PAGE_LOADED` once the critical content is painted (or add a new `APP_READY` signal if needed).

**Agent Prompt (CodeRabbit style)**
```
Goal
- Remove or minimize the fixed 1.5s delay after WebView load so navigation feels immediate.

Files to edit
- loan-app-mobile/app/index.tsx
- loan-app-mobile/native/bridge.ts (if you adjust the readiness signal logic)
- loan-app-mobile/docs/MESSAGE_PROTOCOL.md (if you add a new message type such as APP_READY)

Dependencies
- react-native-webview
- expo
- react-native

Requirements
- Reduce the fallback delay in handleLoadEnd to 100-300ms (or make it conditional).
- Keep the overlay only for initial load or for true full reloads.
- Prefer dismissing the overlay when the web app explicitly signals readiness (PAGE_LOADED or new APP_READY).
- Do not remove error handling (onError/onHttpError) or offline handling.

Implementation notes
- In app/index.tsx, update the handleLoadEnd timeout and make sure it does not reintroduce flicker.
- If you add a new readiness signal, update native/bridge.ts types and MESSAGE_PROTOCOL.md.
- Add clear console logs in dev only for load timing (avoid extra logs in prod).

Validation
- Cold start: overlay disappears quickly once the first paint is visible.
- Deep link: no extra 1-1.5s delay after the target screen becomes visible.
- No regressions to offline or error screens.
```


### 2) Deep link handling forces full WebView reloads even when SPA routing is possible

**Evidence**
- [loan-app-mobile/app/index.tsx](loan-app-mobile/app/index.tsx#L470-L507) uses `setCurrentUrl(targetUrl)` in `handleDeepLink`, which reloads the document.

**Why it matters**
- For SPA navigation, a full reload is unnecessary and expensive. It also re-triggers the loading overlay path, contributing to perceived lag.

**Recommendation**
- Use the bridge to request a client-side route change (SPA navigation) when possible, and only fall back to a full reload if the web app does not respond.
- Example strategy: send `DEEP_LINK` to the web app, wait for a short ack, and only then update `currentUrl` as a fallback.

**Agent Prompt (CodeRabbit style)**
```
Goal
- Avoid full WebView reloads on deep link navigation when the web app can route client-side.

Files to edit
- loan-app-mobile/app/index.tsx
- loan-app-mobile/native/bridge.ts (if adding an ACK message or a new command)
- loan-app-mobile/docs/MESSAGE_PROTOCOL.md (if adding a new message type)

Dependencies
- react-native-webview
- expo-linking

Requirements
- In handleDeepLink, send a bridge message (DEEP_LINK) to the web app first.
- If the web app acks within a short timeout (e.g., 200-400ms), do NOT reload.
- If no ack arrives, fall back to setCurrentUrl(targetUrl) to ensure navigation still works.
- Maintain current behavior for initial URLs and system deep link handling.

Implementation notes
- Add an optional ACK message type if needed (e.g., DEEP_LINK_ACK) and document it.
- Keep the native fallback to avoid breaking navigation if the web app is not updated yet.

Validation
- Deep link to a known route: should navigate without a full reload (no overlay delay).
- Deep link when web app is cold: should still load via full reload fallback.
```


### 3) Web readiness signal is tied to generic timing and history hooks, not to visual stability

**Evidence**
- [loan-app-mobile/native/bridge.ts](loan-app-mobile/native/bridge.ts#L245-L303) sends `PAGE_LOADED` on History API changes and `window.load`, using fixed 50ms/100ms delays.

**Why it matters**
- The page might still be settling (fonts, layout shifts, hero animations) when `PAGE_LOADED` fires. If the overlay disappears too early, users see jank while the hero text and animations stabilize.

**Recommendation**
- Shift readiness signaling to the web app itself, and fire only after the main UI is stable. Examples include waiting on `document.fonts.ready`, a single `requestAnimationFrame` after route render, or a route-level hook in the web app.
- Keep the native injection as a fallback only.

**Agent Prompt (CodeRabbit style)**
```
Goal
- Make readiness signals align with actual visual stability to reduce hero text/animation jitter.

Files to edit
- loan-app-mobile/native/bridge.ts
- loan-app-mobile/docs/MESSAGE_PROTOCOL.md
- loan-app-mobile/docs/WEB_INTEGRATION_SAMPLE.ts (update example to show the new ready signal)
- Web app integration points (e.g., in the web app's root component where route changes are handled)

Dependencies
- react-native-webview
- Web app routing library (whatever is used in the main web app)

Requirements
- Add a new explicit readiness message (e.g., APP_READY or ROUTE_READY) sent by the web app after the main route is rendered and stable.
- Gate the overlay dismissal in native on this signal instead of the fixed 50ms/100ms timeouts.
- Keep the existing injected History API fallback only as a safety net.

Implementation notes
- In native/bridge.ts, add the new message type to WebToNativeCommand and include documentation.
- In the web app, send the signal after fonts are ready and after route render. Avoid using fixed delays.
- Update the integration sample to demonstrate the new signal.

Validation
- Verify that overlay dismissal aligns with the hero content being fully rendered (no font swap jitter).
- Ensure that initial load and subsequent route changes both signal readiness correctly.
```


### 4) Bridge error-reporting runs in production for every console error and can add overhead

**Evidence**
- [loan-app-mobile/native/bridge.ts](loan-app-mobile/native/bridge.ts#L186-L234) wraps `console.error` and always serializes and posts messages to native.

**Why it matters**
- If the web app logs frequently (or logs during animations), the bridge will serialize and post messages across the JS bridge, which can stutter animations and increase jank in WebView.

**Recommendation**
- Add throttling and/or gate error reporting to non-production builds, or make it opt-in via a flag injected by native. Keep critical error reporting but avoid high-frequency logging in release builds.

**Agent Prompt (CodeRabbit style)**
```
Goal
- Reduce bridge overhead by limiting error-reporting traffic in production builds.

Files to edit
- loan-app-mobile/native/bridge.ts
- loan-app-mobile/docs/MESSAGE_PROTOCOL.md (if you add a debug toggle message)

Dependencies
- react-native-webview

Requirements
- Add a simple throttle or sampling for error reporting (e.g., max 1 error per second).
- Optionally disable console.* interception in production unless a debug flag is set.
- Preserve the ability to report critical errors when needed.

Implementation notes
- Use a timestamp-based throttle in the injected script.
- If you need a toggle, inject `window.__NATIVE_DEBUG__ = true` from native before content loads.

Validation
- In production builds, repeated errors should not spam native logs.
- In dev builds, full logging remains available.
```


## Native vs WebView

- No new native modules are strictly required to address the reported issues. The biggest wins come from improving WebView readiness signaling, minimizing reloads, and coordinating UI stability with the web app.
- Optional native enhancement (if desired): render a lightweight native landing skeleton (or a simple Lottie) that transitions into the WebView only after the web app signals readiness. This can further mask jank on low-end devices but is not mandatory.


## Quick Win Summary

- Shrink or remove the 1.5s fallback delay on load end.
- Use a web-driven readiness signal tied to actual route render stability.
- Avoid full reloads for deep links by routing inside the SPA first.
- Throttle or gate error-reporting bridge traffic in production.
