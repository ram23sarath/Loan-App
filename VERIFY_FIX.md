# Verification Instructions

## 1. Reproduce the Bug (Optional)
If you want to see the bug in action (revert the fix first or use a non-fixed version):
1. Open Chrome DevTools -> **Application** -> **Local Storage**.
2. Find the key `loan_app_last_activity`.
3. Manually set it to a timestamp 31 minutes ago by running this in the **Console**:
   ```javascript
   localStorage.setItem('loan_app_last_activity', String(Date.now() - (31 * 60 * 1000)));
   ```
4. Login. You should be immediately redirected back to login.

## 2. Verify the Fix
1. Ensure the fix is applied (the change in `src/context/DataContext.tsx`).
2. Log in to the app.
3. **Log out**.
4. Check **Application** -> **Local Storage**.
   - Verify that `loan_app_last_activity` is **GONE**.
5. Manually inject a stale timestamp again in the **Console**:
   ```javascript
   localStorage.setItem('loan_app_last_activity', String(Date.now() - (31 * 60 * 1000)));
   ```
6. Log in again.
7. **Success**: You should stay logged in and NOT be redirected.

## 3. Automated Test (Optional)
If you have a testing framework like Playwright:
```javascript
test('should not logout user immediately after login with stale activity timestamp', async ({ page }) => {
  await page.goto('/login');
  await page.evaluateHandle(() => {
    localStorage.setItem('loan_app_last_activity', String(Date.now() - (31 * 60 * 1000)));
  });
  // Perform login...
  await page.waitForURL('/', { timeout: 5000 });
  await expect(page).not.toHaveURL('/login');
});
```
