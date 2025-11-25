# Bug Fix: Scoped Customer Data Access Not Working on Sign In

## Problem
Users with a `user_id` (customers) were able to see **all data** from all customers instead of just their own data when they signed in.

## Root Cause
In `context/DataContext.tsx`, the `onAuthStateChange` listener had a race condition:

```typescript
// BEFORE (Broken)
const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
  if (_event === 'SIGNED_IN') {
    setSession(session);
    fetchData();  // ❌ Called BEFORE isScopedCustomer is set!
    fetchSeniorityList();
  }
  // ...
});
```

**The Issue:**
1. User signs in
2. `SIGNED_IN` event fires
3. `setSession(session)` is called
4. `fetchData()` is called immediately
5. At this point, `isScopedCustomer` and `scopedCustomerId` are still `false`/`null` (from their initial state)
6. `fetchData()` checks: `if (isScopedCustomer && scopedCustomerId)` → condition is false
7. So it fetches **all data** instead of scoped data
8. The state update to set `isScopedCustomer=true` and `scopedCustomerId=<id>` happens after, but too late

## Solution
Check if the user is a scoped customer **before** calling `fetchData()`:

```typescript
// AFTER (Fixed)
const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
  if (_event === 'SIGNED_IN') {
    setSession(session);
    // Check if this user is a scoped customer FIRST
    if (session && session.user && session.user.id) {
      try {
        const { data: matchedCustomers, error } = await supabase.from('customers')
          .select('id')
          .eq('user_id', session.user.id)
          .limit(1);
        if (!error && matchedCustomers && matchedCustomers.length > 0) {
          setIsScopedCustomer(true);
          setScopedCustomerId(matchedCustomers[0].id);
        } else {
          setIsScopedCustomer(false);
          setScopedCustomerId(null);
        }
      } catch (err) {
        console.error('Error checking scoped customer on signin', err);
        setIsScopedCustomer(false);
        setScopedCustomerId(null);
      }
      // NOW call fetchData with correct scoped status
      await fetchData();
      await fetchSeniorityList();
    }
  }
  // ...
});
```

**Why It Works:**
1. User signs in
2. `SIGNED_IN` event fires
3. Before calling `fetchData()`, we check the database for a customer record with this `user_id`
4. If found, set `isScopedCustomer=true` and `scopedCustomerId=<id>`
5. Now when `fetchData()` runs, the condition `if (isScopedCustomer && scopedCustomerId)` is **true**
6. It fetches only the scoped customer's data ✅

## Changes Made
**File:** `context/DataContext.tsx` (lines 430-457)

- Changed callback from synchronous to `async`
- Added query to check if user is a scoped customer before calling `fetchData()`
- Properly handles errors with try/catch
- Only calls `fetchData()` and `fetchSeniorityList()` after scoped status is determined

## Testing
After this fix, when a customer signs in:
- ✅ Dashboard shows **only their own data**
- ✅ Loans page shows **only their loans**
- ✅ Subscriptions page shows **only their subscriptions**
- ✅ Misc entries shows **only their entries**
- ✅ Navigation filters correctly (3 admin items hidden)

When an admin signs in:
- ✅ All data is visible (no scoped customer record exists)
- ✅ All navigation items visible
- ✅ Can manage all customers

## Build Status
✅ Build passed: 5.28 seconds
✅ No TypeScript errors
✅ No runtime errors

## How to Test
1. Log in as a customer (user with a customer record): `{phone}@gmail.com` / `{phone}`
2. Verify you see only your own data
3. Log in as an admin: see all data
