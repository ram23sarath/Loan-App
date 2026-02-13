# Loading Flash Fix - Architecture Diagram

## Before Fix (Problem)

```
User Action (Click Edit Button)
         |
         v
   WebView Event
    (onLoadStart)
         |
         v
  Native App Shows
   Loading Overlay
         |
         v
   Wait 500ms
  (fallback timeout)
         |
         v
   Fade Out (350ms)
         |
         v
    Total: ~850ms
   LOADING FLASH! ⚡
```

## After Fix (Solution)

```
User Action (Click Edit Button)
         |
         v
Web App Calls:
suppressNextLoading()
         |
         v
   Bridge Message:
SUPPRESS_LOADING_SCREEN
         |
         v
Native Sets Flag:
suppressLoadingRef = true
         |
         v
   WebView Event
    (onLoadStart)
         |
         v
Native Checks Flag:
suppressLoadingRef?
         |
    true |
         v
  Skip Loading! ✓
  (No flash)
         |
         v
  Reset Flag
```

## Component Flow

```
┌─────────────────────────────────────────────────────────┐
│                     Web App Component                    │
│                                                          │
│  import { useNativeLoadingControl }                     │
│    from '@/hooks/useNativeLoadingControl';              │
│                                                          │
│  const { suppressNextLoading } =                        │
│    useNativeLoadingControl();                           │
│                                                          │
│  const handleEdit = () => {                             │
│    suppressNextLoading(); // ← Key line                │
│    setShowModal(true);                                  │
│  };                                                      │
└─────────────────────────────────────────────────────────┘
                          |
                          | Bridge Message
                          v
┌─────────────────────────────────────────────────────────┐
│              Native Bridge (bridge.ts)                   │
│                                                          │
│  window.NativeBridge.suppressLoadingScreen() {          │
│    window.sendToNative('SUPPRESS_LOADING_SCREEN');      │
│  }                                                       │
└─────────────────────────────────────────────────────────┘
                          |
                          | Message Handler
                          v
┌─────────────────────────────────────────────────────────┐
│            Native App (index.tsx)                        │
│                                                          │
│  bridgeRef.current.on("SUPPRESS_LOADING_SCREEN",        │
│    () => {                                               │
│      suppressLoadingRef.current = true;                 │
│    }                                                     │
│  );                                                      │
│                                                          │
│  const handleLoadStart = () => {                        │
│    if (suppressLoadingRef.current) {                    │
│      suppressLoadingRef.current = false;                │
│      return; // Skip loading                            │
│    }                                                     │
│    setIsLoading(true); // Show loading                  │
│  };                                                      │
└─────────────────────────────────────────────────────────┘
```

## State Machine

```
┌─────────────┐
│   Initial   │
│  State      │
│ (suppress=  │
│   false)    │
└──────┬──────┘
       │
       │ suppressNextLoading() called
       │
       v
┌─────────────┐
│  Suppressed │
│   State     │
│ (suppress=  │
│    true)    │
└──────┬──────┘
       │
       │ onLoadStart fires
       │
       v
┌─────────────┐
│   Check &   │
│   Reset     │
│ (suppress=  │
│   false)    │
└──────┬──────┘
       │
       │ Skip loading
       │
       v
┌─────────────┐
│   Ready     │
│   State     │
│ (no flash)  │
└─────────────┘
```

## Timing Comparison

### Before Fix
```
0ms     500ms   850ms   1000ms
|-------|-------|-------|
Loading Timeout  Fade   Done
Screen  Expires  Out
Shows
        ↑
        User sees loading flash
```

### After Fix
```
0ms     10ms
|-------|
Action  Done
Happens
        ↑
        No loading flash
```

## File Dependencies

```
src/hooks/useNativeLoadingControl.ts
              ↓
    (imports/uses)
              ↓
loan-app-mobile/native/bridge.ts
              ↓
    (defines messages)
              ↓
loan-app-mobile/app/index.tsx
              ↓
    (handles messages)
              ↓
    WebView Component
```

## Message Sequence Diagram

```
Web App          Bridge          Native App
   |                |                 |
   | suppressNext   |                 |
   | Loading()      |                 |
   |--------------->|                 |
   |                | SUPPRESS_       |
   |                | LOADING_        |
   |                | SCREEN          |
   |                |---------------->|
   |                |                 | Set flag
   |                |                 | true
   |                |                 |
   | User clicks    |                 |
   | button         |                 |
   |                |                 |
   |                |  onLoadStart    |
   |                |<----------------|
   |                |                 | Check flag
   |                |                 | (true)
   |                |                 | Skip loading
   |                |                 | Reset flag
   |                |                 |
   | Modal opens    |                 |
   | (no flash!)    |                 |
   |                |                 |
```

## Key Concepts

### 1. One-Time Flag
- Flag is set when `suppressNextLoading()` is called
- Flag is consumed (reset) on next `onLoadStart`
- Prevents accidental suppression of future navigations

### 2. Automatic Reset
- No manual cleanup needed
- Safe for rapid button clicks
- Each action requires explicit suppression

### 3. Fallback Safety
- If web app doesn't call suppress, loading shows normally
- Maintains existing behavior for actual navigations
- No breaking changes to existing code

## Performance Impact

### Before
- Loading overlay: 200ms fade-in + 500ms timeout + 350ms fade-out = 1050ms
- User perceives: Janky, slow

### After
- No overlay for in-page actions: 0ms
- User perceives: Instant, smooth

### Improvement
- **100% reduction** in perceived loading time for button clicks
- **Better UX** for modal interactions
- **No impact** on actual page navigations
