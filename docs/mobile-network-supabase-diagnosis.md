
# Diagnosis: Supabase auth & realtime failures on mobile networks

This document explains a recurring class of issues where web apps using Supabase
fail to authenticate or keep realtime (WebSocket) connections alive when the
client is on mobile carrier networks (cellular data). It's written to be
consumable by humans and by AI agents that need to scan other codebases and
determine whether they are vulnerable to the same problem.

Overview
--------
- Symptom: Sign-in requests hang or time out on mobile data, and browser Network
  panel shows Preflight (OPTIONS) or fetch requests stuck as `pending` or
  showing `net::ERR_FAILED` / `ERR_CONNECTION_CLOSED`.
- Symptom: Realtime WebSocket connections to `wss://*.supabase.co/realtime/...`
  repeatedly `failed`, `TIMED_OUT`, or `CHANNEL_ERROR` and the client falls back
  to polling.
- Root cause: Many mobile carriers and transparent proxies interfere with
  cross-origin HTTP preflights and wss connections (NAT timeouts, proxy
  caching, TLS interception, blocked ports). This can stall `OPTIONS` requests
  and WebSocket handshakes and cause client-side timeouts.

Why typical apps break
----------------------
- Apps call Supabase endpoints (`https://<project>.supabase.co/auth/*` and
  `https://<project>.supabase.co/rest/v1/*`) directly from the browser. On many
  mobile networks the preflight `OPTIONS` or the `wss://` handshake does not
  complete reliably.
- Service workers or aggressive caching that touch `supabase.co` URLs can serve
  opaque/cached responses and mask network errors.
- Apps that rely only on realtime WebSocket connections and do not implement
  a robust fallback will appear to 'lose connection' and stop updating.

Detection heuristics (how an AI agent should scan a codebase)
-----------------------------------------------------------
Search for these patterns and score each as evidence.

- Network target checks
  - Regex: `supabase\.co` anywhere in source → high signal.
  - Files: `src/lib/supabase.ts`, `lib/supabase.*`, `supabaseClient`, `createClient`.

- Service worker / PWA caching of Supabase
  - Search regex: `supabase` inside `vite.config.ts`, `workbox` configs, or any
    `runtimeCaching` entries.
  - Bad sign: auth endpoints included in cache rules. (Look for `/auth/` in urlPattern)

- Auth flow timeouts and missing error handling
  - Search regex: `signInWithPassword|signUp|onAuthStateChange|getSession|signOut`.
  - Look for wrappers that use `Promise.race`/timeouts without `.catch()` on
    the underlying network call.

- Realtime/WebSocket config
  - Search for `realtime`, `heartbeatIntervalMs`, `timeout`, `channel` or
    `channel(...)`/`supabase.channel` usage.
  - Look for aggressive heartbeat/timeouts (e.g. `heartbeatIntervalMs: 15000`, `timeout: 5000`) which can cause frequent disconnects on flaky networks.

- Fallbacks / polling
  - Search for polling intervals, `setInterval`, or comments mentioning
    'polling'/'fallback' to check whether a polling fallback exists.

- Proxying/Server-side routing
  - Search for internal proxy paths like `/supabase-auth` or `/supabase-rest` in
    `netlify.toml`, `vercel.json`, server code, or platform functions.

Automated checklist (agent should attempt these programmatic checks)
-----------------------------------------------------------------
1. Find any code referencing `supabase.co`. If none, low probability.
2. If `supabase` is used, check whether global fetch is overridden for the
   supabase client (`createClient(..., { global: { fetch: ... } })`). If so,
   inspect the fetch wrapper: does it proxy auth and REST requests to same-origin?
3. Parse PWA/workbox config for urlPatterns matching `supabase.co`. If auth URLs are cached, mark as risky.
4. Detect realtime config: if `heartbeatIntervalMs` is small (<20000) or `timeout` small (<8000) mark as aggressive.
5. Check for polling fallback. If none, mark as missing fallback.
6. Look for serverless functions or redirects mapping `/supabase-auth/*` or `/supabase-rest/*` to a backend; presence indicates an existing mitigation.

Examples of search regexes
-------------------------
- \bsupabase\b
- supabase\.co
- createClient\(|signInWithPassword\(|onAuthStateChange\(|heartbeatIntervalMs|timeout:\s*\d+
- urlPattern:\s*/supabase|/auth/|/rest/

Mitigations and fixes
---------------------
The following are ordered from easiest to most robust. You can implement a
subset depending on your constraints.

1) Short-term: Add robust polling fallback (client-side)
   - Detect realtime failure and automatically switch to polling for updates.
   - Make polling adaptive: more frequent while user is active/visible,
     back off when idle.
   - Code pointers (from this repo): `src/hooks/useItems.ts` shows polling
     fallback, visibility and activity-driven adaptive polling.

2) Medium-term: Increase WebSocket tolerance
   - Increase `heartbeatIntervalMs` (e.g., 30000) and `timeout` (e.g., 15000)
     to reduce noisy disconnects on flaky networks.
   - This trades faster detection of dead connections for fewer false
     disconnects.
   - Update in `createClient(..., { realtime: { heartbeatIntervalMs, timeout } })`.

3) Best practical fix: Route Supabase traffic through same-origin proxy
   - Rationale: carrier proxies are less likely to intercept same-origin
     traffic. Also prevents CORS preflight being blocked by carrier.
   - Architecture: Add serverless function(s) or edge route that forwards:
     - `/supabase-auth/*` -> `https://<project>.supabase.co/auth/v1/*`
     - `/supabase-rest/*` -> `https://<project>.supabase.co/rest/v1/*`
   - The client config overrides global fetch for Supabase client so auth and
     REST calls use those local paths while other calls remain unchanged.
   - Example: Netlify functions `netlify/functions/supabase-auth.js` and
     `netlify/functions/supabase-rest.js` and redirects in `netlify.toml`.

4) Long-term / production-grade: WebSocket proxy on same-origin
   - Netlify Functions cannot proxy long-lived WebSocket connections. For
     production realtime over mobile, run a reverse-proxy or WS-capable edge
     service on your domain (Fly, Cloud Run with a TCP/WS proxy, or a small
     VPS) which tunnels `wss` to Supabase's realtime endpoint. That preserves
     same-origin wss and avoids carrier blocking of cross-origin wss.
   - Alternatively, use a managed edge provider that supports WebSockets and
     TLS passthrough.

5) Service Worker and caching rules
   - Ensure Workbox/pwa caching rules NEVER cache auth endpoints. Use
     `NetworkOnly` for `/auth/` to avoid opaque responses (
     `urlPattern: /^https:\/\/.*\.supabase\.co\/auth\/.*/i, handler: 'NetworkOnly'`).
   - For data (`/rest/v1/`) use `NetworkFirst` with a reasonable network timeout
     (e.g., 10s) and conservative caching to allow offline reads.

Logging & Diagnostics (what to add to app)
-----------------------------------------
- Log at startup: network connection details (`navigator.connection`), whether
  app is in PROD or DEV, and whether proxying is enabled.
- Log every Supabase fetch: method, path (auth/rest), proxy vs direct, start
  and end timestamps, and error details.
- Log realtime lifecycle events: `onAuthStateChange`, `channel` statuses
  (`SUBSCRIBED`, `TIMED_OUT`, `CHANNEL_ERROR`), and reconnect attempts.
- Provide a UI indicator (small dot) showing `realtime` vs `polling` mode.

Automated remediation script (AI agent checklist)
-----------------------------------------------
For an AI agent to automatically check and optionally patch another codebase,
follow these steps:

1. Scan repo for `supabase.co` references. If none, stop.
2. Check `vite.config.*`, `workbox` or any service worker for caching rules
   matching `supabase.co`. If auth endpoints are cached, flag and suggest
   `NetworkOnly` for auth.
3. Locate Supabase client creation (`createClient`). If `global.fetch` is not
   overridden, suggest adding a fetch wrapper that proxies auth/rest calls to
   same-origin endpoints.
4. Add serverless function templates for the target platform (`netlify`,
   `vercel`, or a small express app) that forward `/supabase-auth/*` and
   `/supabase-rest/*` to the Supabase project URL using `fetch()` and copy
   response headers (excluding hop-by-hop headers).
5. Update app code to enable the proxy only in production builds (or behind a
   feature flag) and add robust logging.

Files changed in this repository (reference)
-------------------------------------------
- `src/lib/supabase.ts` — added `global.fetch` wrapper and made realtime
  heartbeat/timeout more tolerant.
- `src/hooks/useAuth.tsx` — added extensive auth logging and timeouts.
- `src/hooks/useItems.ts` — added adaptive polling, visibility/activity-driven
  reconnection attempts, and logs.
- `netlify/functions/supabase-auth.js` — serverless proxy for auth endpoints.
- `netlify/functions/supabase-rest.js` — serverless proxy for REST API calls.
- `netlify.toml` — redirects and `Cache-Control` headers for proxy endpoints.

Example quick-run tests for another repo (what an agent should execute)
--------------------------------------------------------------------
1. Grep for risky patterns:

```bash
rg "supabase\.co|createClient\(|onAuthStateChange|signInWithPassword|heartbeatIntervalMs|workbox|urlPattern" || true
```

2. If `supabase.co` references exist, try a runtime smoke test (development):

 - Start the app locally and simulate a mobile network with throttling in
   Chrome DevTools (Network > Throttling > 3G) and observe whether
   sign-in/realtime attempts hang or fall back to HTTP polling.

3. Inspect devtools Network tab to identify preflight `OPTIONS` requests that
   hang or `wss://` handshakes that fail. Check console logs for `TIMED_OUT` or
   `ERR_CONNECTION_CLOSED`.

Patch snippets (copyable)
-------------------------

1) Example global fetch override (client):

```ts
// Insert when creating supabase client
const supabase = createClient(url, key, {
  global: { fetch: mySupabaseFetch },
  realtime: { heartbeatIntervalMs: 30000, timeout: 15000 }
});
```

2) Example Netlify function HEADERS handling (summary):

```js
// Remove hop-by-hop headers and forward the rest; set cache-control: no-store
// Use this for /supabase-auth and /supabase-rest handlers
```

Concluding notes
----------------
This issue is common and not a bug in Supabase itself — it is a network
interference problem combined with cross-origin and long-lived socket
reliability. The pragmatic approach is to ensure the app gracefully degrades
to polling and, where possible, route sensitive/critical Supabase calls
through a same-origin proxy to avoid carrier-level blocking.

This document should provide a comprehensive checklist for an AI agent or
developer to detect the vulnerability in other repositories and to apply the
mitigations described above.
