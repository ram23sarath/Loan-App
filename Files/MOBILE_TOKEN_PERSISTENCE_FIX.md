# Mobile Token Persistence Fix

## Problem

The mobile WebView was experiencing `refresh_token_not_found` errors when accessing the app via Expo because:

1. Auth tokens weren't persisted in native storage
2. The web app didn't handle missing/invalid refresh tokens gracefully
3. The native wrapper had no mechanism to supply tokens on app restart

## Solution Implemented

### Part A: Native Token Persistence (Expo SecureStore)

**Files Modified:**

- `loan-app-mobile/package.json` - Added `expo-secure-store` dependency
- `loan-app-mobile/native/storage.ts` - Created secure storage module with:
  - `saveAuthSession()` - Persist tokens to encrypted storage
  - `loadAuthSession()` - Load tokens on app launch (with expiry check)
  - `clearAuthSession()` - Remove tokens on logout
  - `hasAuthSession()` - Check if session exists

**Files Modified:**

- `loan-app-mobile/app/index.tsx` - Updated WebView screen to:
  - Load persisted session on mount
  - Save tokens when web sends `AUTH_SESSION_UPDATE`
  - Provide tokens when web requests `AUTH_REQUEST`
  - Clear storage on `AUTH_LOGOUT`

### Part B: Web Error Handling

**Files Modified:**

- `src/context/DataContext.tsx` - Added error handling in two places:
  1. **Session initialization** - Catches `refresh_token_not_found` during `getSession()`, clears invalid session, notifies native to clear storage
  2. **Native bridge AUTH_TOKEN handler** - Catches `refresh_token_not_found` during `setSession()`, notifies native to clear stale tokens

- `src/lib/supabase.ts` - Re-enabled `autoRefreshToken: true` (now safe with proper error handling)

- `src/global.d.ts` - Added complete TypeScript definitions for `window.NativeBridge` methods

## How It Works

### First Launch (No Stored Session)

1. Native loads, finds no session in SecureStore
2. WebView loads, requests auth from native via `AUTH_REQUEST`
3. Native has no session, timeout triggers fallback
4. Web shows login page
5. User logs in → web sends `AUTH_SESSION_UPDATE` → native saves to SecureStore

### Subsequent Launches (Valid Session)

1. Native loads session from SecureStore
2. WebView requests auth via `AUTH_REQUEST`
3. Native sends tokens via `AUTH_TOKEN`
4. Web sets session and loads dashboard

### Token Expiry Handling

1. Supabase auto-refresh attempts to renew token
2. If refresh token is invalid → `refresh_token_not_found` error
3. Web catches error, clears session, notifies native via `logout()`
4. Native clears SecureStore
5. Web redirects to login

## Testing Checklist

- [ ] Fresh install - login should persist across app restarts
- [ ] Token expiry - app should handle gracefully and redirect to login
- [ ] Manual logout - should clear both web and native storage
- [ ] Network errors - should not corrupt stored session
- [ ] Invalid/expired stored token - should clear and show login

## Dependencies Added

```json
{
  "expo-secure-store": "^14.0.0"
}
```

## Security Notes

- Tokens stored in SecureStore (encrypted at rest on device)
- Expiry checks prevent usage of expired tokens
- Error handling prevents infinite retry loops
- Native-web communication limited to essential auth data
