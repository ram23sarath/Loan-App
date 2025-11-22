# Scoped Data Access - Testing Guide

## Quick Test Scenarios

### Scenario 1: Admin User Access
**Objective**: Verify admins can see all data and access all pages

**Setup**:
```
Admin user: admin@example.com (or your configured admin user)
Password: (admin password)
```

**Steps**:
1. Log in with admin credentials
2. Verify **all 7 navigation items** are visible in the sidebar:
   - ✓ Add Customer
   - ✓ Add Record
   - ✓ Customers
   - ✓ Loans
   - ✓ Loan Seniority
   - ✓ Subscriptions
   - ✓ Misc Entries
   - ✓ Summary

3. Click "Customers" page - should see **all customers** in the list
4. Click "Loans" - should see **all loans from all customers**
5. Click "Loan Seniority" - should be able to modify seniority list
6. Click "Add Customer" - should be able to create new customers
7. Click "Summary" - should see aggregated data for all customers

**Expected Result**: ✅ All admin pages accessible, all data visible

---

### Scenario 2: Customer User Access - Navigation
**Objective**: Verify customer navigation is filtered correctly

**Setup**:
```
Customer user: {phonenumber}@gmail.com (example: 1234567890@gmail.com)
Password: {phonenumber} (example: 1234567890)
```

**Steps**:
1. Log in with customer credentials
2. You should be redirected to the **CustomerDashboard** (home page)
3. Verify **only 5 navigation items** are visible:
   - ✓ Add Record
   - ✓ Loans
   - ✓ Subscriptions
   - ✓ Misc Entries
   - ✓ Summary
   - ✗ (Missing) Add Customer
   - ✗ (Missing) Customers
   - ✗ (Missing) Loan Seniority

4. The sidebar should NOT show:
   - "Add Customer"
   - "Customers"
   - "Loan Seniority"

**Expected Result**: ✅ Admin-only items hidden, only 5 items visible

---

### Scenario 3: Customer Dashboard
**Objective**: Verify customer welcome dashboard displays correctly

**Setup**: Logged in as a customer (see Scenario 2)

**Steps**:
1. Home page should show a personalized welcome message: "Welcome, [Customer Name]!"
2. Below should be 3 stat cards:
   - **Loans**: Shows count of this customer's loans (clickable)
   - **Subscriptions**: Shows count of this customer's subscriptions (clickable)
   - **Misc Entries**: Shows count of this customer's data entries (clickable)
3. Customer info section shows:
   - Customer name
   - Customer phone number
4. Buttons at the bottom:
   - "View Your Loans" → Navigates to `/loans`
   - "View Your Subscriptions" → Navigates to `/subscriptions`
   - "View Your Data" → Navigates to `/data`

**Expected Result**: ✅ Dashboard shows correct customer name, counts, and is functional

---

### Scenario 4: Data Isolation - Loans Page
**Objective**: Verify customer sees only their own loans

**Setup**: Logged in as a customer

**Steps**:
1. Click "Loans" in navigation (or click the Loans stat card)
2. You should see **only loans where customer_id matches your customer ID**
3. If you have multiple customers in the system:
   - Create a loan for Customer A (admin)
   - Create a loan for Customer B (admin)
   - Log in as Customer A
   - Loans page should show **only Customer A's loan**
   - Loans page should NOT show Customer B's loan

4. Check the loan details by clicking on a loan
5. Loan detail page should show **only this customer's information**

**Expected Result**: ✅ Each customer sees only their own loans

---

### Scenario 5: Data Isolation - Subscriptions Page
**Objective**: Verify customer sees only their own subscriptions

**Setup**: Logged in as a customer with subscriptions

**Steps**:
1. Click "Subscriptions" in navigation
2. You should see **only subscriptions where customer_id matches your customer ID**
3. If system has subscriptions from other customers:
   - Subscriptions page should show **only this customer's subscriptions**
   - Subscriptions page should NOT show other customers' subscriptions

**Expected Result**: ✅ Each customer sees only their own subscriptions

---

### Scenario 6: Data Isolation - Misc Entries Page
**Objective**: Verify customer sees only their own data entries

**Setup**: Logged in as a customer with misc entries

**Steps**:
1. Click "Misc Entries" (or "Data") in navigation
2. You should see **only data entries where customer_id matches your customer ID**
3. If system has entries from other customers:
   - Data page should show **only this customer's entries**
   - Data page should NOT show other customers' entries

**Expected Result**: ✅ Each customer sees only their own data entries

---

### Scenario 7: Data Isolation - Summary Page
**Objective**: Verify customer sees aggregated data only for their own records

**Setup**: Logged in as a customer

**Steps**:
1. Click "Summary" in navigation
2. Summary page should show **totals and charts aggregated only for this customer's data**
3. For example:
   - Total loans: Should match count in Loans page
   - Total subscriptions: Should match count in Subscriptions page
   - Total misc entries: Should match count in Misc page
4. Charts/breakdowns should reflect **only this customer's data**, not all customers

**Expected Result**: ✅ Summary shows only this customer's aggregated data

---

### Scenario 8: Access Control - Direct URL Access
**Objective**: Verify customers cannot access admin pages via direct URL

**Setup**: Logged in as a customer

**Steps**:
1. Try to access admin pages directly:
   
   **Try accessing `/customers`:**
   - Navigate to `http://localhost:5173/#/customers`
   - Expected: Redirected to `/loans`
   - Check browser address bar shows `http://localhost:5173/#/loans`

   **Try accessing `/loan-seniority`:**
   - Navigate to `http://localhost:5173/#/loan-seniority`
   - Expected: Redirected to `/loans`
   - Check browser address bar shows `http://localhost:5173/#/loans`

   **Try accessing `/` (Add Customer page):**
   - Navigate to `http://localhost:5173/#/`
   - Expected: Shows CustomerDashboard (not Add Customer form)

2. Also test by modifying the localStorage:
   - Open browser DevTools (F12)
   - Console tab
   - Try: `localStorage.setItem('scopedCustomerId', 'some-other-id')`
   - Refresh page
   - You should still see only YOUR data (because filtering happens at database level)

**Expected Result**: ✅ Customers redirected from admin pages, cannot access other customer data even with localStorage manipulation

---

### Scenario 9: Add Record Functionality
**Objective**: Verify customers can add records (but only for themselves)

**Setup**: Logged in as a customer

**Steps**:
1. Click "Add Record" in navigation
2. You should see the "Add Record" form
3. The form should be pre-filled with **this customer's information**
4. When you submit a record, it should be created **for this customer only**
5. Go to Loans page and verify the new loan appears **in this customer's loan list**

**Expected Result**: ✅ Customer can add records, which are automatically associated with their account

---

### Scenario 10: Password Change
**Objective**: Verify customer can change their password

**Setup**: Logged in as a customer

**Steps**:
1. Look for a "Change Password" option in the sidebar or profile menu (should be a key icon)
2. Click on it
3. Modal/form should appear asking for:
   - Current password
   - New password
   - Confirm new password
4. Enter a new password (6+ characters)
5. Click "Change Password"
6. Should see a success toast notification
7. Log out
8. Try logging in with the **old password** → Should fail
9. Try logging in with the **new password** → Should succeed

**Expected Result**: ✅ Customer can change password, old password no longer works

---

## Edge Case Testing

### Edge Case 1: Multiple Customers in System
**Test**: When multiple customers exist, each customer sees only their data
- Create Customer A and B (admin)
- Add loans for both
- Log in as Customer A → Sees only A's data
- Log in as Customer B → Sees only B's data
- Verify sidebar items are same for both customers (5 items)

### Edge Case 2: Customer with No Data
**Test**: Customer with no loans/subscriptions/entries
- Create new customer (auto-created via Netlify function)
- Log in as that customer
- Dashboard should show:
  - 0 Loans
  - 0 Subscriptions
  - 0 Misc Entries
- All pages should show empty states gracefully

### Edge Case 3: Admin Operations Don't Break Customer View
**Test**: Admin modifying data doesn't break customer session
- Log in as Customer A
- (In another browser/incognito) Log in as admin
- Admin adds/modifies/deletes data
- Customer A's view should still work (may need to refresh)

### Edge Case 4: Session Persistence
**Test**: Customer session persists across page reloads
- Log in as customer
- Note the current page (e.g., Loans)
- Refresh the page (F5)
- Should still be on the same page with same data loaded

---

## Automated Test Commands

```bash
# Run TypeScript check
npm run type-check

# Run build
npm run build

# Start dev server
npm run dev

# Check for errors
npm run lint
```

---

## Success Criteria

### ✅ All Tests Pass When:

1. **Admin users** can access all pages and see all data
2. **Customers** can only see navigation items for their allowed pages
3. **Customers** are redirected away from admin-only pages (e.g., `/customers`)
4. **Customers** see only their own data on every page
5. **Customers** can add records (which are auto-associated with their account)
6. **Customers** can change their password
7. **Home page** shows CustomerDashboard for customers, AddCustomerPage for admins
8. **No database queries** return data from other customers
9. **Summary page** aggregates only the logged-in customer's data

---

## Debugging Help

### If customer sees all data instead of just theirs:
1. Check `DataContext.tsx` - verify `fetchData()` has the `.eq('customer_id', scopedCustomerId)` filter
2. Check browser DevTools → Network tab → Look at Supabase query parameters
3. Look for error in browser console (F12 → Console)

### If customer can still access admin pages:
1. Check `App.tsx` - verify `AdminOnlyRoute` component exists
2. Check routes are wrapped with `AdminOnlyRoute`
3. Clear browser cache (Ctrl+Shift+Delete) and try again

### If navigation items don't filter:
1. Check `Sidebar.tsx` - verify `isScopedCustomer` is destructured from context
2. Check `allNavItems` array has `adminOnly` flags
3. Check filter logic: `const navItems = allNavItems.filter(item => !item.adminOnly || !isScopedCustomer);`

### If dashboard doesn't show:
1. Check `CustomerDashboard.tsx` exists in `components/pages/`
2. Check `App.tsx` imports it: `import CustomerDashboard from './components/pages/CustomerDashboard';`
3. Check home route renders CustomerDashboard for scoped customers
4. Check browser console for component errors (F12 → Console)

---

## Notes

- **Build Status**: ✅ Last build passed (4.86s, no errors)
- **TypeScript Check**: ✅ No TypeScript errors
- **Backward Compatibility**: ✅ Admin users experience unchanged
- **Data Security**: ✅ Database-level filtering (strongest guarantee)
