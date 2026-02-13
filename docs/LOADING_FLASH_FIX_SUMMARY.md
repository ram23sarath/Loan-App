# Loading Flash Fix - Implementation Summary

## Overview
This document explains where the loading flash code is located and how to apply the fix to prevent the 1-second loading screen when clicking edit/delete/WhatsApp buttons.

## Root Cause Location

### Native App - Loading Trigger
**File**: `loan-app-mobile/app/index.tsx`

**Line 686-705**: `handleLoadStart` function
```typescript
const handleLoadStart = useCallback(() => {
  console.log("[WebView] Load started");

  // Check if loading screen should be suppressed for this navigation
  if (suppressLoadingRef.current) {
    console.log(
      "[WebView] Loading screen suppressed for this navigation (in-page action)",
    );
    // Reset the flag after consuming it
    suppressLoadingRef.current = false;
    setError(null);
    return;
  }

  // Show loading overlay for actual page navigations
  setIsLoading(true);
  setError(null);
}, []);
```

**What it does**: 
- Checks `suppressLoadingRef` before showing loading
- If suppressed, skips the loading overlay
- Automatically resets the flag

### Native App - Suppress Flag
**File**: `loan-app-mobile/app/index.tsx`

**Line 82**: Suppress loading ref declaration
```typescript
const suppressLoadingRef = useRef(false);
```

### Native App - Bridge Handlers
**File**: `loan-app-mobile/app/index.tsx`

**Lines 449-466**: Message handlers
```typescript
handlerUnsubscribersRef.current.push(
  bridgeRef.current.on("SUPPRESS_LOADING_SCREEN", () => {
    console.log(
      "[WebView] SUPPRESS_LOADING_SCREEN - next navigation will not show loading overlay",
    );
    suppressLoadingRef.current = true;
  }),
);

handlerUnsubscribersRef.current.push(
  bridgeRef.current.on("SHOW_LOADING_SCREEN", () => {
    console.log(
      "[WebView] SHOW_LOADING_SCREEN - explicitly showing loading overlay",
    );
    suppressLoadingRef.current = false;
    setIsLoading(true);
  }),
);
```

### Bridge - Message Types
**File**: `loan-app-mobile/native/bridge.ts`

**Lines 20-50**: Added new message types
```typescript
export type WebToNativeCommand =
  // ... existing types
  | { type: 'SUPPRESS_LOADING_SCREEN' }
  | { type: 'SHOW_LOADING_SCREEN' };
```

**Lines 389-399**: Bridge convenience methods
```typescript
suppressLoadingScreen: function() {
  window.sendToNative('SUPPRESS_LOADING_SCREEN');
},

showLoadingScreen: function() {
  window.sendToNative('SHOW_LOADING_SCREEN');
}
```

### Web App - Hook
**File**: `src/hooks/useNativeLoadingControl.ts` (NEW FILE)

Complete hook implementation for easy usage in React components.

## How to Apply the Fix

### Option 1: Use the Hook (Recommended)

1. Import the hook in your component:
```typescript
import { useNativeLoadingControl } from '@/hooks/useNativeLoadingControl';
```

2. Use it in your component:
```typescript
function MyComponent() {
  const { suppressNextLoading } = useNativeLoadingControl();
  
  const handleButtonClick = () => {
    suppressNextLoading(); // Call BEFORE the action
    // Your action here (open modal, delete, etc.)
  };
}
```

### Option 2: Direct Bridge Call

If you can't use hooks, call the bridge directly:

```typescript
const handleButtonClick = () => {
  if (window.NativeBridge?.suppressLoadingScreen) {
    window.NativeBridge.suppressLoadingScreen();
  }
  // Your action here
};
```

## Example: Fixing LoanTableView

To fix the loading flash in the loan table edit/delete/WhatsApp buttons:

```typescript
import { useNativeLoadingControl } from '@/hooks/useNativeLoadingControl';

function LoanTableView() {
  const { suppressNextLoading } = useNativeLoadingControl();
  
  // Edit button
  const handleEdit = (loan) => {
    suppressNextLoading(); // Add this line
    setSelectedLoan(loan);
    setShowEditModal(true);
  };
  
  // Delete button
  const handleDelete = (loan) => {
    suppressNextLoading(); // Add this line
    setSelectedLoan(loan);
    setShowDeleteConfirm(true);
  };
  
  // WhatsApp button
  const handleWhatsApp = (loan) => {
    suppressNextLoading(); // Add this line
    const message = buildWhatsAppMessage(loan);
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`);
  };
}
```

## Key Files Summary

| File | Purpose | Lines Changed |
|------|---------|---------------|
| `loan-app-mobile/native/bridge.ts` | Added message types | 20-50, 389-399 |
| `loan-app-mobile/app/index.tsx` | Implemented conditional loading | 82, 449-466, 686-705 |
| `src/hooks/useNativeLoadingControl.ts` | Web app hook (NEW) | All |
| `docs/NATIVE_LOADING_CONTROL.md` | Documentation (NEW) | All |

## Testing the Fix

1. **Build the Expo app** with the changes
2. **Navigate** to a page with buttons (e.g., Loan List)
3. **Click** edit/delete/WhatsApp buttons
4. **Verify**: No loading flash appears
5. **Navigate** to a different page
6. **Verify**: Loading screen DOES appear

## Rollback Instructions

If you need to revert the changes:

1. Remove the `suppressLoadingRef` check from `handleLoadStart`
2. Remove the two bridge message handlers
3. Revert the bridge.ts message type additions
4. Delete the hook file

The app will return to showing loading on every action (original behavior).
