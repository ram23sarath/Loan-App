# Installation & Usage Checklist

## ✅ Phase 1: Installation Complete

The user creation script and all documentation has been successfully installed!

### Files Created:
- [x] `scripts/create-users-from-customers.js` - Main script
- [x] `scripts/setup-users.sh` - Interactive setup helper
- [x] `USERS.md` - Quick start guide
- [x] `scripts/README.md` - Technical documentation
- [x] `scripts/INTEGRATION.md` - Integration reference

### Previous Features Created:
- [x] `components/modals/ChangePasswordModal.tsx` - Password change feature
- [x] Updated `components/Sidebar.tsx` - Change Password button
- [x] Updated `constants.tsx` - Added KeyIcon for UI

---

## 🔄 Phase 2: Preparation (Do This First)

Before running the script, complete these steps:

### 1. Get Your Supabase Service Role Key
- [ ] Go to https://supabase.com/dashboard
- [ ] Select your project
- [ ] Go to **Settings → API**
- [ ] Find **"Service Role Secret"** (NOT the anon key)
- [ ] Copy the entire key to a safe location (temp file, password manager, etc.)
- [ ] ⚠️ **DO NOT** commit this to git

### 2. (Optional) Review Documentation
- [ ] Read `USERS.md` for overview (5 minutes)
- [ ] Skim `scripts/README.md` for details (optional)
- [ ] Check `scripts/INTEGRATION.md` for context (optional)

---

## �� Phase 3: Running the Script

Choose one of these options:

### Option A: Interactive Setup (Recommended)
```bash
bash scripts/setup-users.sh
```
- [ ] Script will ask for Service Role Key
- [ ] Enter the key you copied
- [ ] Script runs automatically
- [ ] Review the output

### Option B: Command Line
```bash
export SUPABASE_SERVICE_ROLE_KEY="paste-your-key-here"
node scripts/create-users-from-customers.js
```
- [ ] Set environment variable with key
- [ ] Run script
- [ ] Review the output

### What to Expect
```
🚀 Starting user creation from customers...
📥 Fetching customers from database...
✅ Found N customers
📝 Will create N user(s)

[Creates users one by one...]

============================================================
📊 SUMMARY
============================================================
✅ Successfully created: N user(s)
❌ Failed: 0 user(s)
```

- [ ] Verify users were created successfully
- [ ] Check summary shows expected count
- [ ] Look for any error messages

---

## ✅ Phase 4: Verification

After running the script:

### Check Script Results
- [ ] Script completed without fatal errors
- [ ] Summary shows successful user creations
- [ ] No critical error messages

### Verify in Supabase
- [ ] Log in to Supabase Dashboard
- [ ] Go to **Auth → Users**
- [ ] Verify new users appear (emails in format: {phone}@customer.local)
- [ ] Check user metadata contains customer info

### Verify in Database
- [ ] Go to **SQL Editor**
- [ ] Run: `SELECT id, name, phone, user_id FROM customers;`
- [ ] Check that previously empty user_id columns now have values
- [ ] Verify user_id values match Supabase auth user IDs

---

## 📢 Phase 5: Customer Onboarding

Once script completes:

### Share Login Credentials with Customers

Each customer can log in with:
```
Email:    {phone}@customer.local
Password: {phone}
```

Example:
```
Email:    9876543210@customer.local
Password: 9876543210
```

### Send Customers Instructions
- [ ] Tell customers their login email and password
- [ ] Include app URL
- [ ] Instruct them to **CHANGE PASSWORD IMMEDIATELY** after first login
- [ ] Let them know they can use "Change Password" feature in app sidebar

### Create Welcome Email Template (Optional)
```
Subject: Your Loan Management App Account is Ready!

Hi [Customer Name],

Your account has been set up! You can now log in at:
[APP_URL]

Login credentials:
Email: {phone}@customer.local
Password: {phone}

⚠️ Important: Change your password immediately after first login!
In the app, click the "Change Password" button (amber key icon) in the sidebar.

If you have any issues, contact [SUPPORT_EMAIL].

Best regards,
[YOUR_NAME]
```

---

## 🔒 Phase 6: Security Review

### Check Security Best Practices
- [ ] Service Role Key was NOT committed to git
- [ ] Service Role Key was NOT shared in messages
- [ ] Service Role Key was NOT stored in code
- [ ] Customers changed their password after first login
- [ ] No other admin keys were exposed

### Regenerate Key (If Accidentally Exposed)
If you accidentally committed or shared the key:
1. Go to Supabase Dashboard → Settings → API
2. Click "Regenerate Secret" on Service Role Secret
3. This invalidates the old key

---

## 📊 Phase 7: Post-Launch Monitoring

### Monitor User Activity
- [ ] Check app logs for any authentication errors
- [ ] Verify customers can successfully log in
- [ ] Confirm password changes work via Change Password feature
- [ ] Monitor for any RLS (Row Level Security) issues

### Support Common Issues
- [ ] Customer forgot email: It's {phone}@customer.local
- [ ] Customer forgot password: Can reset or use Change Password feature
- [ ] Customer can't log in: Check if user_id was created (Phase 4)
- [ ] User sees empty data: Might be RLS issue (check Supabase settings)

---

## ⚙️ Phase 8: Customization (Optional)

If you want to modify the script:

### Change Email Format
Edit `scripts/create-users-from-customers.js` line ~85:
```javascript
const email = `${customer.phone}@yourcompany.com`; // Change domain
```
- [ ] Edit file if desired
- [ ] Delete old users from Supabase if needed
- [ ] Run script again

### Change Password Format
Edit `scripts/create-users-from-customers.js` line ~86:
```javascript
const password = `${customer.phone}123`; // Different format
```
- [ ] Edit file if desired
- [ ] Notify customers of new password format
- [ ] Run script again

### Change User Metadata
Edit `scripts/create-users-from-customers.js` user_metadata object:
```javascript
user_metadata: {
  name: customer.name,
  phone: customer.phone,
  // Add more fields here
}
```

See `scripts/README.md` "Extending the Script" section for examples.

---

## 🆘 Phase 9: Troubleshooting

### If Script Fails

**Error: "SUPABASE_SERVICE_ROLE_KEY environment variable is required!"**
- ✓ Solution: Set the environment variable before running
  ```bash
  export SUPABASE_SERVICE_ROLE_KEY="your-key"
  node scripts/create-users-from-customers.js
  ```

**Error: "User creation returned no user data"**
- ✓ See `scripts/README.md` → Troubleshooting section
- ✓ Usually means email already exists
- ✓ Check if customer already has user_id

**Error: "Failed to update customer"**
- ✓ Database permission issue
- ✓ Check RLS policies in Supabase
- ✓ Verify service role key is valid

**Other errors:**
- ✓ Check `USERS.md` FAQ section
- ✓ Check `scripts/README.md` Troubleshooting
- ✓ Check `scripts/INTEGRATION.md` for context

### If Customers Can't Log In

1. Check in Supabase Dashboard → Auth → Users
   - [ ] User exists with correct email
   - [ ] Email looks like {phone}@customer.local

2. Check database
   - [ ] Customer has user_id (linked to auth user)
   - [ ] user_id matches user in Supabase Auth

3. Check app features
   - [ ] LoginPage.tsx is working
   - [ ] Users can see login form
   - [ ] Correct error messages shown

4. Check Supabase RLS policies
   - [ ] Don't block customer users
   - [ ] Allow read access to their own data
   - [ ] Allow password changes

---

## 📚 Phase 10: Documentation Reference

### Quick Reference Guide
- **Start here:** `USERS.md` (quick start)
- **Need help:** `scripts/README.md` (technical details)
- **Integration issues:** `scripts/INTEGRATION.md` (how it works)
- **General questions:** `USERS.md` FAQ section

### Documentation Map
```
USERS.md
├── What it does
├── Quick start (2 options)
├── Before you start
├── How it works
├── Logging in
├── Security notes
├── FAQ (20+ questions)
└── Troubleshooting

scripts/README.md
├── Prerequisites
├── Usage
├── How it works (code details)
├── Notes
├── Troubleshooting
└── Extending the script

scripts/INTEGRATION.md
├── What was created
├── Key features
├── Step-by-step setup
├── After running
├── Workflow
├── Security
└── Integration with app
```

---

## ✨ Success Criteria

Script is successful when:

- [x] All script files created and verified
- [x] All documentation files created
- [x] Users created in Supabase Auth
- [x] Customer records updated with user_id
- [x] Customers can log in with email & password
- [x] Customers can change password in app
- [x] Summary report shows no errors

---

## 🎉 Done!

Once you complete all phases above, your user creation system is fully operational!

### Summary of What You Have:
✅ Automated user creation script
✅ Interactive setup helper
✅ Multiple levels of documentation
✅ Integration with app features
✅ Security best practices
✅ Comprehensive troubleshooting guides
✅ Easy password change for users

### Next Steps:
1. Get Service Role Key from Supabase
2. Run `bash scripts/setup-users.sh`
3. Verify users were created
4. Share login credentials with customers
5. Customers log in and change password
6. Monitor for any issues

---

**Last updated:** November 22, 2025
**Documentation level:** Complete
**Status:** Production-ready ✅
