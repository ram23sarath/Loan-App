# Quick Fix Guide - Suppress Loading Flash

## 🎯 Quick Reference

Add this ONE line before any button action to prevent loading flash:

```typescript
suppressNextLoading();
```

## 📋 Step-by-Step

### 1. Import the Hook
```typescript
import { useNativeLoadingControl } from '@/hooks/useNativeLoadingControl';
```

### 2. Use in Component
```typescript
const { suppressNextLoading } = useNativeLoadingControl();
```

### 3. Call Before Action
```typescript
const handleClick = () => {
  suppressNextLoading(); // ← Add this line
  // Your existing code
};
```

## 🔧 Common Scenarios

### Modal Open/Close
```typescript
const handleEdit = () => {
  suppressNextLoading();
  setShowModal(true);
};

const handleClose = () => {
  suppressNextLoading();
  setShowModal(false);
};
```

### Delete Confirmation
```typescript
const handleDelete = (id: string) => {
  suppressNextLoading();
  if (confirm('Delete?')) {
    deleteItem(id);
  }
};
```

### WhatsApp Share
```typescript
const handleWhatsApp = (message: string) => {
  suppressNextLoading();
  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`);
};
```

### Dropdown Toggle
```typescript
const handleToggle = () => {
  suppressNextLoading();
  setIsOpen(!isOpen);
};
```

### Tab Switch
```typescript
const handleTabChange = (tab: string) => {
  suppressNextLoading();
  setActiveTab(tab);
};
```

## ⚠️ When NOT to Use

Don't suppress loading for:
- ❌ Page navigation (React Router)
- ❌ Login/logout
- ❌ Full page reload
- ❌ Deep links

## 🐛 Troubleshooting

**Still seeing loading?**
- ✅ Call `suppressNextLoading()` BEFORE the action
- ✅ Make sure you're in the native app
- ✅ Check console for bridge messages

**Not seeing loading when you should?**
- ✅ Don't call it for actual navigations
- ✅ Flag auto-resets after one use

## 📝 Example: Complete Component

```typescript
import React, { useState } from 'react';
import { useNativeLoadingControl } from '@/hooks/useNativeLoadingControl';

function MyComponent() {
  const { suppressNextLoading } = useNativeLoadingControl();
  const [showModal, setShowModal] = useState(false);
  
  const handleEdit = () => {
    suppressNextLoading(); // Prevent flash
    setShowModal(true);
  };
  
  const handleDelete = () => {
    suppressNextLoading(); // Prevent flash
    if (confirm('Are you sure?')) {
      // Delete logic
    }
  };
  
  return (
    <>
      <button onClick={handleEdit}>Edit</button>
      <button onClick={handleDelete}>Delete</button>
    </>
  );
}
```

## 🎨 Alternative: Inline Wrapper

For one-off cases:

```typescript
import { withSuppressedLoading } from '@/hooks/useNativeLoadingControl';

<button onClick={withSuppressedLoading(() => setShowModal(true))}>
  Edit
</button>
```

## 📚 More Info

See `docs/NATIVE_LOADING_CONTROL.md` for complete documentation.
