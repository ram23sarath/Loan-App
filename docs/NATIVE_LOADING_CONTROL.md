# Native Loading Screen Control

## Problem

When clicking buttons (edit, delete, WhatsApp, etc.) in the Expo mobile app, users experience a brief ~1 second loading flash screen. This happens because:

1. The WebView's `onLoadStart` event fires even for in-page actions
2. The native app shows a skeleton loading overlay by default
3. The overlay stays visible for 500ms (fallback timeout) + 350ms (fade-out animation)

## Solution

We've implemented a conditional loading screen system that allows the web app to suppress the loading overlay for in-page actions while still showing it for actual page navigations.

## How It Works

### 1. New Bridge Messages

Two new message types have been added to the native bridge:

- **`SUPPRESS_LOADING_SCREEN`**: Tells the native app to skip the loading overlay for the next navigation
- **`SHOW_LOADING_SCREEN`**: Explicitly shows the loading overlay

### 2. Native Implementation

The native app (`loan-app-mobile/app/index.tsx`) now:
- Tracks a `suppressLoadingRef` flag
- Checks this flag in `handleLoadStart` before showing the loading overlay
- Automatically resets the flag after consuming it

### 3. Web App Hook

A new hook `useNativeLoadingControl` provides an easy API for web developers:

```typescript
import { useNativeLoadingControl } from '@/hooks/useNativeLoadingControl';

function MyComponent() {
  const { suppressNextLoading } = useNativeLoadingControl();
  
  const handleEditClick = () => {
    suppressNextLoading(); // Prevent loading flash
    setShowEditModal(true);
  };
  
  return <button onClick={handleEditClick}>Edit</button>;
}
```

## Usage Examples

### Example 1: Modal Actions

```typescript
import { useNativeLoadingControl } from '@/hooks/useNativeLoadingControl';

function LoanTableView() {
  const { suppressNextLoading } = useNativeLoadingControl();
  const [showEditModal, setShowEditModal] = useState(false);
  
  const handleEdit = (loan: Loan) => {
    suppressNextLoading(); // No loading flash
    setSelectedLoan(loan);
    setShowEditModal(true);
  };
  
  return (
    <button onClick={() => handleEdit(loan)}>
      Edit
    </button>
  );
}
```

### Example 2: Delete Confirmation

```typescript
const handleDelete = (id: string) => {
  suppressNextLoading(); // No loading flash for confirmation dialog
  if (confirm('Are you sure?')) {
    // Actual delete operation
    deleteLoan(id);
  }
};
```

### Example 3: WhatsApp Share

```typescript
const handleWhatsAppShare = (message: string) => {
  suppressNextLoading(); // No loading flash
  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`);
};
```

### Example 4: Using the HOF Wrapper

```typescript
import { withSuppressedLoading } from '@/hooks/useNativeLoadingControl';

<button onClick={withSuppressedLoading(() => setShowModal(true))}>
  Edit
</button>
```

## When to Use

### ✅ Suppress Loading For:
- Opening/closing modals
- Showing/hiding dropdowns
- Button clicks that don't navigate
- In-page state changes
- Confirmation dialogs
- Share actions
- Copy to clipboard

### ❌ Don't Suppress Loading For:
- Actual page navigations (React Router navigation)
- Full page reloads
- Deep link handling
- Initial app load
- Login/logout flows

## Implementation Checklist

To fix the loading flash in your components:

1. **Import the hook**:
   ```typescript
   import { useNativeLoadingControl } from '@/hooks/useNativeLoadingControl';
   ```

2. **Use the hook**:
   ```typescript
   const { suppressNextLoading } = useNativeLoadingControl();
   ```

3. **Call before the action**:
   ```typescript
   const handleAction = () => {
     suppressNextLoading();
     // Your action here
   };
   ```

## Files Modified

### Native App
- `loan-app-mobile/native/bridge.ts`: Added new message types
- `loan-app-mobile/app/index.tsx`: Implemented conditional loading logic

### Web App
- `src/hooks/useNativeLoadingControl.ts`: New hook for easy usage

## Testing

To verify the fix works:

1. Build and run the Expo app
2. Navigate to a page with edit/delete/WhatsApp buttons
3. Click the buttons - you should NOT see the loading flash
4. Navigate to a different page - you SHOULD see the loading screen

## Technical Details

### Message Flow

```
Web App                          Native App
   |                                 |
   | suppressNextLoading()           |
   |-------------------------------->|
   |   SUPPRESS_LOADING_SCREEN       |
   |                                 |
   |                                 | suppressLoadingRef = true
   |                                 |
   | User clicks button              |
   |                                 |
   | (WebView triggers onLoadStart)  |
   |                                 |
   |                                 | Check suppressLoadingRef
   |                                 | -> true, skip loading
   |                                 | Reset flag
   |                                 |
```

### Timing

- **Before**: 500ms timeout + 350ms fade = ~850ms - 1000ms loading flash
- **After**: 0ms - no loading flash for suppressed actions

## Troubleshooting

### Loading still shows
- Make sure you're calling `suppressNextLoading()` BEFORE the action
- Verify the action is happening in the native app (check `isNativeApp`)
- Check browser console for bridge messages

### Loading doesn't show when it should
- Don't call `suppressNextLoading()` for actual navigations
- The flag auto-resets after one use

### TypeScript errors
- Make sure to import from the correct path
- The hook returns `{ suppressNextLoading, showLoading, isNativeApp }`
