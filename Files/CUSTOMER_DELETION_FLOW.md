# Customer Deletion Flow - Documentation

## Overview
When a customer is deleted from the `customers` table, the system automatically deletes the associated Supabase auth user from the `auth.users` table in the background.

## Deletion Process

### 1. Frontend Deletion Trigger (CustomerListPage.tsx)
- User clicks the delete button next to a customer
- `handleDeleteCustomer()` is called with the customer object
- Confirmation dialog appears
- On confirmation, `deleteCustomer()` from DataContext is invoked

### 2. DataContext.tsx - deleteCustomer() Function
**Location**: `context/DataContext.tsx` lines 932-1000

**Step-by-step process**:

```
Step 1: Security Check
├─ Check if user is scopedCustomer
└─ If yes, throw error (read-only access)

Step 2: Fetch customer's user_id
├─ Query: supabase.from('customers').select('user_id').eq('id', customerId)
├─ Extract user_id from customer record
└─ This user_id links the customer to their Supabase auth account

Step 3: Optimistic UI Update
├─ Remove customer from state
├─ Remove associated loans
├─ Remove associated subscriptions
├─ Remove associated installments
└─ Remove associated data entries

Step 4: Call Netlify Function (if user_id exists)
├─ Function: /.netlify/functions/delete-user-from-customer
├─ Method: POST
├─ Payload: { customer_id: customerId, user_id: customerUserId }
└─ This triggers the auth user deletion in background

Step 5: Delete Related Data from Database
├─ Delete all data_entries for customer
├─ Delete all installments for customer's loans
├─ Delete all loans for customer
├─ Delete all subscriptions for customer
└─ Delete customer from customers table

Step 6: Refresh Data
└─ Call fetchData() to sync frontend state
```

### 3. Netlify Function - delete-user-from-customer.js
**Location**: `netlify/functions/delete-user-from-customer.js`

**Purpose**: Delete the Supabase auth user using Service Role Key (backend operation)

**Implementation**:

```javascript
1. Validate Request
   ├─ Check method is POST
   └─ Validate environment variables

2. Extract Parameters
   ├─ customer_id: string
   └─ user_id: string (from customer record)

3. Initialize Supabase Client
   ├─ Use Service Role Key (server-side admin access)
   ├─ Disable auto-refresh and session persistence
   └─ This allows deleting any user account

4. Delete Auth User
   ├─ Call: supabase.auth.admin.deleteUser(user_id)
   └─ This removes user from auth.users table

5. Return Response
   ├─ Success: { success: true, user_id }
   └─ Failure: { error: "message" }
```

## Data Flow Diagram

```
Frontend (CustomerListPage)
    ↓ Delete button clicked
    ↓
React State
    ↓ confirmDeleteCustomer()
    ↓
DataContext.deleteCustomer()
    ├─→ [1] Fetch customer.user_id
    ├─→ [2] Optimistic UI update (local state)
    ├─→ [3] Call Netlify Function
    │         ↓
    │   Netlify Function (Serverless)
    │         ├─→ Validate request
    │         ├─→ Initialize Supabase admin client
    │         ├─→ Call supabase.auth.admin.deleteUser(user_id)
    │         │   └─→ Deletes from auth.users table
    │         └─→ Return response
    │         ↑
    ├─→ [4] Delete from databases in sequence:
    │         ├─ data_entries
    │         ├─ installments
    │         ├─ loans
    │         ├─ subscriptions
    │         └─ customers
    │
    └─→ [5] Refresh data (fetchData())

Supabase
    ├─ auth.users table (deleted)
    ├─ customers table (deleted)
    ├─ loans table (deleted)
    ├─ subscriptions table (deleted)
    ├─ installments table (deleted)
    └─ data_entries table (deleted)
```

## Key Components

### Dependency Chain
1. **Customer** → user_id (links to auth.users)
2. **Customer** → Loans → Installments
3. **Customer** → Subscriptions
4. **Customer** → Data Entries

### Deletion Order (Database)
1. data_entries (references customer_id)
2. installments (references loan_id → references customer_id)
3. loans (references customer_id)
4. subscriptions (references customer_id)
5. customers (main record)

### Auth User Deletion
- Called **immediately** via Netlify function after optimistic UI update
- Uses **Service Role Key** (server-side admin privileges)
- Deletes from **auth.users** table in Supabase
- **Non-blocking**: Error in auth deletion doesn't prevent database deletion

## Error Handling

### If Auth User Deletion Fails
```
├─ Warning logged to console
├─ Customer data still deleted from database
└─ User can manually delete auth account from Supabase dashboard
```

### If Database Deletion Fails
```
├─ Error thrown
├─ Optimistic UI update is reverted (fetchData() is called)
└─ Error message displayed to user
```

## Security Measures

1. **Scoped Customer Check**
   - Scoped customers cannot delete any customers
   - Error: "Read-only access: scoped customers cannot delete customers"

2. **Service Role Key Protection**
   - Only used in backend (Netlify function)
   - Never exposed to frontend
   - Uses environment variables

3. **Cascading Deletes**
   - All related data automatically cleaned up
   - No orphaned records left in database

## Environment Variables Required

For Netlify Function (`delete-user-from-customer.js`):
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Admin API key for auth operations

## Testing Checklist

- [ ] Delete customer with associated auth user
- [ ] Verify auth user deleted from Supabase auth.users table
- [ ] Verify all related records deleted (loans, subscriptions, etc.)
- [ ] Verify UI updates correctly
- [ ] Test error scenario: invalid user_id
- [ ] Test error scenario: missing environment variables
- [ ] Verify scoped customers cannot delete customers
- [ ] Check console logs for deletion confirmation

## Related Files

- `components/pages/CustomerListPage.tsx` - Delete button UI
- `context/DataContext.tsx` - deleteCustomer() function (lines 932-1000)
- `netlify/functions/delete-user-from-customer.js` - Auth deletion function
- `types.ts` - Customer, Loan, Subscription types

## Notes

- Auth user deletion is **asynchronous** but doesn't block database operations
- If Netlify function fails, warning is logged but deletion continues
- Optimistic UI update happens before database operations for better UX
- All deletions are permanent and cannot be undone
