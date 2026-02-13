# Code-Rabbit Prompt: Expo Android App — Audit, Fixes, and Implementation Plan

## Context

This repository contains a hybrid app: a WebView-focused Expo app under `loan-app-mobile/` and a React web frontend under `src/`. The mobile app wraps the web app but contains native glue (auth persistence, push tokens, downloads, bridging, offline handling, skeleton UI). The goal: improve UX and performance for Android (Expo) by adding robust skeleton loading screens, caching/persistence for data and sessions, and other performance hardening.

This prompt is for an engineer or an AI code agent to implement concrete changes. It is explicit: file-level tasks, recommended libraries, code snippets, configuration edits, and tests to verify improvements.

---

## High-level objectives (priority order)

- Add consistent skeleton loading UI for app entry and key native screens.
- Add resilient client-side caching for sessions and any native data requests (use persistent query caching for data fetches, persistent auth session is already present but improve and generalize).
- Reduce JS load and runtime overhead on Android (enable Hermes, inline requires, bundle optimizations where applicable).
- Improve list rendering + image loading performance (virtualize lists, use cached image component).
- Audit and reduce blocking or repeated network calls in native code (push token, bridge messages, file operations).

---

## Files and hotspots to inspect first

- loan-app-mobile/app/index.tsx — main WebView entry (already imports `SkeletonLoading`, `OfflineScreen`, `ErrorScreen`) — add skeleton lifecycle improvements and caching hooks.
- loan-app-mobile/app/components/SkeletonLoading.\* — unify and extend for list placeholders and shimmer effect.
- src/context/DataContext.tsx — main data layer (single source of truth). Add client-side caching or integrate with TanStack Query.
- src/lib/supabase.ts — central Supabase client and fetch patterns; consider batching and caching.
- src/components/ProfileHeader/hooks/useNotifications.ts — large read scans and upserts of notification_reads (server-side scan + client batching improvements recommended).
- Any files in `loan-app-mobile/app/components/` that render lists, images, or heavy UIs.

### Repo-audit corrections (important)

The current repository layout differs from a few paths above:

- `SkeletonLoading` lives at `loan-app-mobile/components/SkeletonLoading.tsx` (not `loan-app-mobile/app/components/...`).
- Native modules live at `loan-app-mobile/native/*` (not `loan-app-mobile/app/native/*`).
- The mobile app has no `loan-app-mobile/app/components/` directory in the current branch.
- `metro.config.js` already exists in `loan-app-mobile/` and should be edited in place.
- Auth persistence is already using `expo-secure-store` in `loan-app-mobile/native/storage.ts`; focus on startup/read-frequency optimization before storage migration.

Use these corrected paths when generating implementation tasks or PR diffs to avoid invalid-file failures.

If a file uses plain `fetch`/Supabase calls directly in components, replace with cached query layer.

---

## Recommended libraries and infra

- TanStack Query (react-query) + react-query-persist-client for caching and background refresh.
  - Mobile persistence: use `@react-native-async-storage/async-storage` or `react-native-mmkv` via `persistQueryClient`.
  - For skeleton shimmer: `expo-linear-gradient` + simple Skeleton component, or `@rneui/themed` skeleton components.
- For fast/cached images: `expo-image` (if on managed workflow) or `react-native-fast-image` (bare/EAS) for Android caching and memory-friendly loading.
- For improved JS performance: Hermes engine (enable in `app.json`: `expo.android.jsEngine: "hermes"`), and enable Metro `inlineRequires`.- Optional monitoring: Sentry or Bugsnag for tracing slow screens or heavy renders.

---

## Concrete tasks (step-by-step)

Each task includes file paths and a short code sketch or config where applicable.

1. Implement persistent query layer

- Files: `src/context/DataContext.tsx` (primary target), `src/lib/supabase.ts` (to adapt fetch functions).
- Action:
  - Add TanStack Query (`@tanstack/react-query`) to the project and create a `QueryClient` instance in `src/context/DataContext.tsx` or a new `src/context/QueryProvider.tsx` that wraps the app (web and mobile entry points should mount it where appropriate).
  - Configure `persistQueryClient` with `AsyncStorage` (mobile) or `localStorage` (web) so query cache survives app restarts.
- Why:
  - Centralizes caching, dedupes requests, enables background refresh and optimistic updates.
- Snippet (conceptual):

  ```ts
  // src/context/QueryProvider.tsx
  import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
  import {
    persistQueryClient,
    createAsyncStoragePersister,
  } from "@tanstack/react-query-persist-client";
  import AsyncStorage from "@react-native-async-storage/async-storage";

  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 1000 * 60 * 2 } },
  });

  const persistor = createAsyncStoragePersister({ storage: AsyncStorage });

  persistQueryClient(queryClient, { persistor });
  ```

2. Add skeleton loading patterns systematically

- Files: `loan-app-mobile/app/index.tsx`, `loan-app-mobile/app/components/SkeletonLoading.*`, `src/components/pages/*` (pages that fetch data)
- Action:
  - Build a small, reusable `Skeleton` component that supports: block, line, avatar placeholders, and list placeholders with shimmer (linear gradient). Place it under `loan-app-mobile/app/components/SkeletonLoading.tsx` and also create a shared version under `src/components/ui/Skeleton.tsx` for web parity.
  - For any screen that fetches remote data (or for any component using TanStack Query), show the skeleton if `isLoading === true` and `data` is null/empty. For lists, render N skeleton rows matching expected row height.
- Why:
  - Reduces perceived load time and prevents layout jumps.
- Implementation notes:
  - Use `expo-linear-gradient` for shimmer. Memoize skeleton rows to avoid re-renders.

3. Optimize WebView startup and first paint

- File: `loan-app-mobile/app/index.tsx`
- Action:
  - The file already sets `isLoading` and uses `SkeletonLoading`. Ensure timeouts/fallbacks are conservative and that the app preserves the skeleton until `PAGE_LOADED`/`APP_READY` arrives. Avoid premature unmount which can show a white flash.
  - Preload fonts and critical assets via `expo-asset` during `AppLoading` or before mounting WebView if possible.
- Quick tweak: keep a `minVisible` time for skeleton (300–500ms) so the transition looks smooth.

4. Cache auth session and token usage (harden existing storage)

- Files: `loan-app-mobile/app/index.tsx`, `loan-app-mobile/app/native/storage.*` (functions `loadAuthSession`, `saveAuthSession`, `clearAuthSession`)
- Action:
  - Verify `loadAuthSession()` uses `AsyncStorage`/secure store; if not, migrate to `expo-secure-store` for tokens.
  - Wrap auth session access in a small cache layer used by the QueryClient to attach tokens to outgoing requests.

5. Audit list rendering and replace ScrollView with FlatList where needed

- Files: search for `ScrollView` and `map(` in UI components under `loan-app-mobile/app/components/` and `src/components/`.
- Action:
  - Replace long-scrolling `ScrollView` with `FlatList` or `SectionList`. Provide `keyExtractor`, `getItemLayout` where possible, and `initialNumToRender` + `windowSize` tuned for Android.
  - Memoize `renderItem` with `useCallback` and memoize row components with `React.memo`.

6. Image handling improvements

- Files: any component rendering `<Image>` or using `<img>` in the web bundle; search for `.source={require(` or uri images`.
- Action:
  - For Expo: use `expo-image` with `cachePolicy` and priority props. For bare: use `react-native-fast-image` replacing `Image` usage.
  - Ensure images load with placeholder and don't block screen rendering.

7. Notification and bulk-read operations optimization

- File: `src/components/ProfileHeader/hooks/useNotifications.ts` (example: large paginated fetch of `notification_reads`)
- Action:
  - Replace client-side full-range scans with server-side filtered endpoints if possible (e.g., `select count(*)` or use Supabase RPC to fetch unread ids for user with limits).
  - Use upsert batching but rate-limit UI triggers. Use background queue for marking reads (debounce and batch upserts).
- Why:
  - Prevents thousands-of-rows range scans on low-memory devices.

8. Enable Hermes and Metro optimizations for Android

- Files: `app.json`, `metro.config.js` (or create one)
- Action:
  - In `app.json` (expo managed), set:
    ```json
    "expo": {
      "android": {
        "jsEngine": "hermes"
      }
    }
    ```
  - Add `metro.config.js` with `transformer: { getTransformOptions: async () => ({ transform: { experimentalImportSupport: false, inlineRequires: true }})}` to enable `inlineRequires`.
  - Rebuild via EAS for hermes-enabled binary.
- Why:
  - Hermes improves Android JS performance and reduces memory.

Implementation note for this repo: update `loan-app-mobile/app.json` and `loan-app-mobile/metro.config.js`.

9. Reduce bundle size & lazy-load heavy modules

- Action:
  - Use dynamic `import()` for rarely-used modules (heavy polyfills, charts, XLSX libs). Only load them when user navigates to pages that require them.
  - Ensure tree-shaking-friendly imports (avoid default imports for large utility bundles).

10. Add instrumentation and quick benchmarks

- Files: create `tools/perf/` helpers or small dev-only routes.
- Action:
  - Add lightweight timers that log mount time, first contentful paint (FCP) for native screens, and WebView page load times (time between WebView load start and `PAGE_LOADED` bridge event). Use `console.time()` and optionally send to Sentry.

---

## Example actionable micro-tasks (ready for PRs)

1. Create `src/context/QueryProvider.tsx` implementing `QueryClient` + `persistQueryClient` with `AsyncStorage` persistor.
2. Wrap app roots: web `src/index.tsx` and mobile `loan-app-mobile/app/index.tsx` with `QueryClientProvider`.
3. Implement `src/components/ui/Skeleton.tsx` (shared) and `loan-app-mobile/app/components/SkeletonLoading.tsx` (mobile-specific) with `expo-linear-gradient` shimmer.
4. Replace direct Supabase `select` calls in pages with `useQuery(['customers', customerId], () => fetchCustomer(customerId))` patterns.
5. Update `app.json` to enable Hermes and add `metro.config.js` for `inlineRequires`.
6. Replace `<ScrollView>` in any long-list screen with `<FlatList>` and tune `initialNumToRender`.
7. Replace `Image` usages with `expo-image` and add `placeholder`/`priority` props.
8. Optimize `useNotifications` bulk-read behavior: change scanning logic to either one RPC that returns unread ids for the user or page the `notification_reads` table by `created_at` using server-side filter.

Optimization hint for the current implementation: avoid scanning all user read-ids up front; fetch a page of notifications first, then query `notification_reads` with `.in('notification_id', pageIds)` for only those IDs.

---

## Minimal verification checklist

- [ ] Cold-start time (app launch → WebView main content) improved or visually smoother thanks to skeleton (compare before/after by video or logs).
- [ ] When offline, app shows `OfflineScreen` and any cached data is displayed from persisted query cache.
- [ ] Lists scroll smoothly, memory usage reduced on Android (basic smoke test on a mid-range device/emulator).
- [ ] Images are cached and display placeholders; repeated navigations do not re-download images unnecessarily.
- [ ] Notification marking no longer scans thousands of rows on client startup.
- [ ] Release build runs with Hermes enabled and shows no runtime errors.

---

## Implementation hints and code snippets

- Persisting TanStack Query on React Native (concept):

```ts
// src/context/queryPersist.ts
import {
  persistQueryClient,
  createAsyncStoragePersister,
} from "@tanstack/react-query-persist-client";
import AsyncStorage from "@react-native-async-storage/async-storage";

const persistor = createAsyncStoragePersister({ storage: AsyncStorage });
// then call persistQueryClient(queryClient, { persistor });
```

- Skeleton shimmer (mobile):

```tsx
// loan-app-mobile/app/components/SkeletonLoading.tsx
import { LinearGradient } from "expo-linear-gradient";
import { View, StyleSheet } from "react-native";
export default function SkeletonRow({ style }) {
  return (
    <View style={[styles.row, style]}>
      <LinearGradient
        colors={["#f0f0f0", "#e0e0e0", "#f0f0f0"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.shimmer}
      />
    </View>
  );
}
```

- Hermes + inlineRequires (metro):

```js
// metro.config.js
module.exports = {
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
};
```

---

## Acceptance criteria for the PR(s)

- New `QueryProvider` with persistence integrated and used by at least two non-trivial data screens.
- Reusable skeleton component used in `loan-app-mobile/app/index.tsx` plus at least one list screen demonstrating skeleton rows.
- Hermes enabled in `app.json` and `metro.config.js` added. Document EAS build steps in `README.md` (how to create hermes-enabled build).
- Notification scanning logic updated to avoid full table scanning and tested locally with synthetic large datasets.

---

## Notes & constraints

- The WebView houses the main web app — many heavy UI/UX improvements may belong in the web repo. This prompt focuses on the native wrapper and native-side performance.
- When enabling Hermes, a full rebuild is required. Use EAS or an appropriate CI pipeline to produce hermes-enabled binaries.
- Choose `react-native-mmkv` if you need very high-performance local persistence; it requires native setup (EAS/build changes).

---

## Next steps (if you want I can implement these)

- I can scaffold `QueryProvider` and wire it into mobile and web roots, add a persisted cache example, and implement a reusable `Skeleton` component and replace a single list with `FlatList` + skeletons as a proof-of-concept.
- Or I can generate focused PR patches for: `loan-app-mobile/app/components/SkeletonLoading.tsx`, `src/context/QueryProvider.tsx`, and `app.json` + `metro.config.js` to enable Hermes.

---

End of prompt. Implementers should follow this as a checklist and open small, focused PRs per micro-task above.
