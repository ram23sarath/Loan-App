# Typed Message Protocol Specification

This document defines the complete typed JSON protocol for communication between the React Native wrapper and the WebView-hosted web application.

---

## Protocol Overview

Communication is bidirectional:
- **Web → Native**: Commands sent from web app via `window.sendToNative(type, payload)`
- **Native → Web**: Responses sent via injected JavaScript calling `window.onNativeMessage(response)`

All messages are JSON-serialized with the following structure:

```typescript
interface Message {
  type: string;       // Command/response identifier  
  payload?: unknown;  // Optional data
}
```

---

## Web → Native Commands

### Authentication

```typescript
// Request current auth session from native storage
{ type: 'AUTH_REQUEST' }

// Notify native of logout (clear stored session)
{ type: 'AUTH_LOGOUT' }

// Update native with new session from web auth
{ 
  type: 'AUTH_SESSION_UPDATE',
  payload: {
    accessToken: string,
    refreshToken: string,
    expiresAt: number,  // Unix timestamp (seconds)
    user: {
      id: string,
      email?: string,
      isScopedCustomer?: boolean,
      scopedCustomerId?: string | null
    }
  }
}
```

### Navigation & Links

```typescript
// Open URL in external browser
{ 
  type: 'OPEN_EXTERNAL_LINK',
  payload: { url: string }
}

// Report page navigation for analytics/debugging
{ 
  type: 'PAGE_LOADED',
  payload: { 
    route: string,
    title?: string
  }
}

// Web app is ready to receive messages
{ type: 'NAVIGATION_READY' }
```

### UI Feedback

```typescript
// Trigger haptic feedback
{ 
  type: 'HAPTIC_FEEDBACK',
  payload: { style: 'light' | 'medium' | 'heavy' }
}

// Open native share sheet
{ 
  type: 'SHARE_CONTENT',
  payload: {
    title?: string,
    text: string,
    url?: string
  }
}

// Copy text to clipboard
{ 
  type: 'COPY_TO_CLIPBOARD',
  payload: { text: string }
}
```

### Push Notifications

```typescript
// Request push notification permission and token
{ type: 'REQUEST_PUSH_PERMISSION' }
```

### Error Reporting

```typescript
// Report error from web for native logging
{ 
  type: 'ERROR_REPORT',
  payload: {
    message: string,
    stack?: string,
    componentStack?: string
  }
}
```

### Theme

```typescript
// Report detected theme to native
{ 
  type: 'THEME_DETECTED',
  payload: { mode: 'light' | 'dark' }
}
```

---

## Native → Web Responses

### Authentication

```typescript
// Provide stored auth session to web
{ 
  type: 'AUTH_TOKEN',
  payload: {
    accessToken: string,
    refreshToken: string,
    expiresAt: number,
    user: {
      id: string,
      email?: string,
      isScopedCustomer?: boolean,
      scopedCustomerId?: string | null
    }
  }
}

// Confirm auth state cleared
{ type: 'AUTH_CLEARED' }
```

### Push Notifications

```typescript
// Provide Expo push token for registration
{ 
  type: 'PUSH_TOKEN',
  payload: {
    token: string,         // ExponentPushToken[...]
    platform: 'ios' | 'android'
  }
}

// Report permission request result
{ 
  type: 'PUSH_PERMISSION_RESULT',
  payload: {
    granted: boolean,
    canAskAgain: boolean
  }
}
```

### App State

```typescript
// Network connectivity changed
{ 
  type: 'NETWORK_STATUS',
  payload: {
    isConnected: boolean,
    type: 'wifi' | 'cellular' | 'unknown' | null
  }
}

// App moved to/from background
{ 
  type: 'APP_STATE',
  payload: { 
    state: 'active' | 'background' | 'inactive' 
  }
}
```

### Deep Links

```typescript
// Incoming deep link
{ 
  type: 'DEEP_LINK',
  payload: {
    url: string,   // Full URL: loanapp://loans/123
    path: string   // Path only: /loans/123
  }
}
```

### System

```typescript
// Native bridge is initialized and ready
{ type: 'NATIVE_READY' }

// Theme preference from native (if different from web)
{ 
  type: 'THEME_CHANGE',
  payload: { mode: 'light' | 'dark' | 'system' }
}
```

---

## TypeScript Definitions

Full TypeScript types are available in `native/bridge.ts`:

```typescript
import type { 
  WebToNativeCommand,
  NativeToWebResponse,
  AuthSession,
} from './native/bridge';
```

---

## Web App Integration

### Checking if Running in Native App

```typescript
const isNative = typeof window !== 'undefined' && window.isNativeApp?.();
```

### Sending Commands to Native

```typescript
// Using the convenience API
window.NativeBridge?.hapticFeedback('medium');
window.NativeBridge?.share({ text: 'Check this out!', url: '...' });

// Or directly
window.sendToNative?.('OPEN_EXTERNAL_LINK', { url: 'https://...' });
```

### Receiving Messages from Native

```typescript
useEffect(() => {
  if (!window.isNativeApp?.()) return;

  window.registerNativeHandler?.((message) => {
    switch (message.type) {
      case 'PUSH_TOKEN':
        console.log('Got push token:', message.payload.token);
        break;
      case 'NETWORK_STATUS':
        console.log('Network:', message.payload.isConnected);
        break;
      case 'DEEP_LINK':
        navigate(message.payload.path);
        break;
    }
  });
}, []);
```

---

## Security Considerations

1. **Never transmit service-role keys** through the bridge
2. **Short-lived tokens only**: Access tokens expire, refresh tokens are rotated
3. **Validate on server**: All sensitive operations go through authenticated Supabase RPC
4. **No secrets in messages**: Bridge messages may be logged in development
