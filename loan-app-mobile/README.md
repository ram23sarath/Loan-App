# I J Reddy Loan App - Mobile

A production-ready Expo app that wraps the Loan-App web application in a WebView with native bridge support for auth, push notifications, and future native screens.

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [Project Structure](#-project-structure)
- [Build & Run](#-build--run)
- [Web Deployments Auto-Update](#-web-deployments-auto-update)
- [Adding Native Features](#-adding-native-features)
- [Bridge Protocol](#-bridge-protocol)
- [Push Notifications](#-push-notifications)
- [App Store Submission](#-app-store-submission)
- [Production Checklist](#-production-checklist)

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Expo CLI: `npm install -g expo-cli`
- EAS CLI: `npm install -g eas-cli`
- Xcode (for iOS builds)
- Android Studio (for Android builds)

### Install Dependencies

```bash
cd loan-app-mobile
npm install
```

### Run Locally

```bash
# Start development server
npm start

# Run on Android
npm run android

# Run on iOS
npm run ios
```

### Configure Environments

Edit `config/env.ts` to set your web app URLs:

```typescript
const ENV_CONFIG = {
  production: {
    webUrl: 'https://your-production-app.netlify.app',
    // ...
  },
  staging: {
    webUrl: 'https://your-staging-app.netlify.app',
    // ...
  },
  development: {
    webUrl: 'http://localhost:5173',
    // ...
  },
};
```

---

## 📁 Project Structure

```
loan-app-mobile/
├── app/
│   ├── _layout.tsx          # Root layout with providers
│   └── index.tsx             # Main WebView screen
├── native/
│   ├── bridge.ts             # Web ↔ Native message protocol
│   ├── permissions.ts        # Permission utilities
│   └── notifications.ts      # Push notification handling
├── config/
│   └── env.ts                # Environment configuration
├── components/
│   ├── LandingScreen.tsx     # Android startup landing screen
│   ├── LoadingScreen.tsx     # Loading state
│   ├── OfflineScreen.tsx     # Offline detection
│   └── ErrorScreen.tsx       # Error display
├── assets/                   # App icons and splash
├── app.json                  # Expo configuration
├── eas.json                  # EAS Build configuration
└── package.json
```

---

## 🔧 Build & Run

### Local Development

```bash
# Start Expo dev server
npx expo start

# Clear cache and start
npx expo start -c
```

### EAS Build (Cloud)

```bash
# Login to Expo
eas login

# Configure project (first time only)
eas build:configure

# Build for Android (APK for testing)
eas build --platform android --profile preview

# Build for iOS (simulator)
eas build --platform ios --profile development

# Build for production
eas build --platform all --profile production
```

### Local Native Builds

```bash
# Generate native projects
npx expo prebuild

# Build Android locally
npx expo run:android

# Build iOS locally
npx expo run:ios
```

---

## ▶️ Startup Flow by Platform

- **Android**: Starts on a native `LandingScreen`. WebView mounts only after the user taps **Continue**. The native landing stays visible until the web app sends `APP_READY` (or a fallback timeout triggers), then handoff completes.
- **iOS/Web**: Existing behavior is unchanged; WebView loads immediately with the current loading overlay flow.

---

## 🔄 Web Deployments Auto-Update

**The mobile app automatically loads the latest web deployment.** When you deploy updates to your web app (Netlify), users get the new version immediately without app store updates.

### How it works:
1. WebView loads `WEB_APP_URL` from `config/env.ts`
2. The URL points to your live web deployment
3. Any web deployment automatically reflects in the mobile app

### When you DO need an app update:
- Adding new native features
- Updating Expo SDK version
- Changing the bridge protocol
- Updating splash/icons
- Adding new permissions

---

## ➕ Adding Native Features

### 1. Create a New Native Screen

```bash
# Create a new screen file
touch app/native-screen.tsx
```

```tsx
// app/native-screen.tsx
import { View, Text } from 'react-native';

export default function NativeScreen() {
  return (
    <View>
      <Text>Native Screen Content</Text>
    </View>
  );
}
```

### 2. Navigate from WebView to Native

Web app calls:
```javascript
window.sendToNative('NAVIGATE_NATIVE_SCREEN', { screen: 'native-screen' });
```

Add handler in `app/index.tsx`:
```typescript
bridgeRef.current.on('NAVIGATE_NATIVE_SCREEN', (payload) => {
  router.push(`/${payload.screen}`);
});
```

### 3. Adding Native Permissions

1. Add to `app.json` under `ios.infoPlist` or `android.permissions`
2. Request permission in code using `native/permissions.ts`
3. Never request permissions without user context

---

## 🌉 Bridge Protocol

### Web → Native Commands

| Command | Payload | Description |
|---------|---------|-------------|
| `AUTH_REQUEST` | - | Request current auth session |
| `AUTH_LOGOUT` | - | Clear native auth state |
| `AUTH_SESSION_UPDATE` | `AuthSession` | Store session from web |
| `OPEN_EXTERNAL_LINK` | `{ url: string }` | Open URL in browser |
| `HAPTIC_FEEDBACK` | `{ style: 'light'|'medium'|'heavy' }` | Trigger haptic |
| `SHARE_CONTENT` | `{ title?, text, url? }` | Native share sheet |
| `COPY_TO_CLIPBOARD` | `{ text: string }` | Copy text |
| `REQUEST_PUSH_PERMISSION` | - | Request push notifications |
| `PAGE_LOADED` | `{ route, title? }` | Report page navigation |
| `APP_READY` | - | Web app is visually ready for native handoff |
| `ERROR_REPORT` | `{ message, stack? }` | Report error to native |

### Native → Web Responses

| Response | Payload | Description |
|----------|---------|-------------|
| `AUTH_TOKEN` | `AuthSession` | Send auth session to web |
| `AUTH_CLEARED` | - | Confirm logout |
| `PUSH_TOKEN` | `{ token, platform }` | Expo push token |
| `NETWORK_STATUS` | `{ isConnected, type }` | Network state change |
| `APP_STATE` | `{ state: 'active'|'background' }` | App lifecycle |
| `DEEP_LINK` | `{ url, path }` | Incoming deep link |
| `NATIVE_READY` | - | Native bridge initialized |

### Web Integration Example

Add to your web app's `DataContext.tsx`:

```typescript
useEffect(() => {
  if (!window.isNativeApp?.()) return;
  
  window.registerNativeHandler?.((message) => {
    switch (message.type) {
      case 'PUSH_TOKEN':
        // Store push token via Supabase RPC
        supabase.rpc('update_push_token', { 
          token: message.payload.token 
        });
        break;
      case 'NETWORK_STATUS':
        setIsOffline(!message.payload.isConnected);
        break;
    }
  });
  
  // Sync session changes to native
  supabase.auth.onAuthStateChange((event, session) => {
    if (session) {
      window.NativeBridge?.updateSession({
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        expiresAt: session.expires_at,
        user: { id: session.user.id, email: session.user.email }
      });
    }
  });
}, []);
```

---

## 📲 Push Notifications

### Setup

1. **Create Supabase table and RPC** (run in Supabase SQL editor):

```sql
-- See native/notifications.ts for full SQL
CREATE TABLE user_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) UNIQUE,
  token TEXT NOT NULL,
  platform TEXT DEFAULT 'unknown',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE user_push_tokens ENABLE ROW LEVEL SECURITY;
```

2. **Configure for iOS**: Add to `app.json`:
```json
{
  "ios": {
    "infoPlist": {
      "UIBackgroundModes": ["remote-notification"]
    }
  }
}
```

3. **Configure for Android**: Add `google-services.json` from Firebase Console

### Sending Notifications

Use Expo's push notification service:

```bash
curl -X POST https://exp.host/--/api/v2/push/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "ExponentPushToken[xxxx]",
    "title": "Loan Update",
    "body": "Your installment is due tomorrow"
  }'
```

---

## 📱 App Store Submission

### iOS (App Store)

1. **Apple Developer Account**: Enroll at developer.apple.com

2. **Configure EAS Submit**:
```bash
# Update eas.json with your Apple credentials
eas submit --platform ios --profile production
```

3. **Required Assets**:
   - App Icon (1024x1024 PNG, no alpha)
   - Screenshots for all device sizes
   - Privacy Policy URL

### Android (Play Store)

1. **Google Play Console**: Create app at play.google.com/console

2. **Create Service Account**: Download JSON key

3. **Configure EAS Submit**:
```bash
eas submit --platform android --profile production
```

4. **Required**:
   - App screenshots
   - Feature graphic (1024x500)
   - Privacy policy URL
   - Content rating questionnaire

---

## ✅ Production Checklist

### Before Submission

- [ ] **Push Tokens**: Verify RPC `update_push_token` works, test notifications
- [ ] **RLS Checks**: Confirm all Supabase queries respect RLS policies
- [ ] **Privacy Policy**: Create and host privacy policy, add URL to stores
- [ ] **Permissions**: Request only needed permissions with clear purpose
- [ ] **Crash Reporting**: (Optional) Add Sentry: `npx expo install @sentry/react-native`
- [ ] **Analytics**: (Optional) Add analytics: `npx expo install expo-firebase-analytics`

### Security

- [ ] **No Service-Role Keys**: Verify NEVER in mobile code
- [ ] **No Secrets in Code**: All sensitive data via environment/server
- [ ] **Token Storage**: Sessions only in memory/secure storage
- [ ] **Certificate Pinning**: (Optional) Consider for high-security needs

### Environment

- [ ] **Production URLs**: Update `config/env.ts` with production URLs
- [ ] **EAS Project**: Configure `app.json` with real EAS project ID
- [ ] **Bundle IDs**: Verify unique bundle/package IDs
- [ ] **Version Numbers**: Set appropriate version in `app.json`

### Assets

- [ ] **App Icon**: Design and add to `assets/icon.png`
- [ ] **Splash Screen**: Design and add to `assets/splash.png`
- [ ] **Adaptive Icon**: Add `assets/adaptive-icon.png` for Android

### Testing

- [ ] **Physical Devices**: Test on real iOS and Android devices
- [ ] **Offline Mode**: Verify offline screen appears correctly
- [ ] **Deep Links**: Test `loanapp://` URL scheme
- [ ] **Background/Foreground**: Verify notification handling
- [ ] **Login/Logout**: Full auth flow works correctly

---

## 🔧 Troubleshooting

### WebView not loading

1. Check `config/env.ts` URLs are correct
2. Verify web app is deployed and accessible
3. Check for CORS issues on web server

### Push notifications not working

1. Must test on physical device (not simulator)
2. Check EAS project ID in `app.json`
3. Verify `google-services.json` for Android
4. Request permission before getting token

### Build failures

```bash
# Clear all caches
npx expo start -c
rm -rf node_modules
npm install
npx expo prebuild --clean
```

---

## 📄 License

This project is private and confidential.
