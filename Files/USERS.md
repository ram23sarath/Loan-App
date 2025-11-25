# User Creation - Quick Start Guide

## 🎯 What This Does

Creates Supabase authentication users from your existing customers in the database, using their phone numbers as initial passwords.

This is useful when you have customer records in the database but haven't created corresponding user accounts yet. It enables customers to:
- Log in to the application
- View their own data (if scoped as a customer user)
- Change their password after first login

## ⚡ Quick Start (2 minutes)

### Option 1: Interactive Setup (Recommended for first-time users)

```bash
bash scripts/setup-users.sh
```

This will:
1. Ask you to enter your Supabase Service Role Key
2. Validate the key format
3. Run the user creation script
4. Show you a summary of created users

### Option 2: Command Line (For automation/CI-CD)

```bash
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
node scripts/create-users-from-customers.js
```

## 📋 Before You Start

1. **Get your Service Role Key:**
   - Log in to [Supabase Dashboard](https://supabase.com/dashboard)
   - Select your project
   - Go to **Settings → API**
   - Copy the **Service Role Secret** (⚠️ NOT the anon key)

2. **Important:** Never share or commit this key to version control!

## 🔄 How It Works

For each customer in the database **without a user_id**:

1. **Creates a Supabase auth user** with:
   - Email: `{customer_phone}@customer.local`
   - Password: Customer's phone number
   - Metadata: Customer name, phone, and customer_id

2. **Updates the customer record** in the database with the new user_id

3. **Reports results** with a summary of successes and failures

## 📊 Example Output

```
🚀 Starting user creation from customers...

📥 Fetching customers from database...
✅ Found 5 customers

📝 Will create 3 user(s)

Creating user for: Rajesh Kumar (Phone: 9876543210)...
  ✅ User created with ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890

Creating user for: Priya Sharma (Phone: 9123456789)...
  ✅ User created with ID: b2c3d4e5-f6a7-8901-bcde-f12345678901

Creating user for: Amit Patel (Phone: 9556789012)...
  ✅ User created with ID: c3d4e5f6-a7b8-9012-cdef-123456789012

============================================================
📊 SUMMARY
============================================================
✅ Successfully created: 3 user(s)
❌ Failed: 0 user(s)

Successfully created users:
  • Rajesh Kumar (9876543210) → 9876543210@customer.local
  • Priya Sharma (9123456789) → 9123456789@customer.local
  • Amit Patel (9556789012) → 9556789012@customer.local
```

## 🔑 Logging In

After users are created, customers can log in with:

- **Email:** `{phone}@customer.local`
  - Example: `9876543210@customer.local`
- **Password:** Their phone number
  - Example: `9876543210`

## 🔒 Security Notes

1. **Initial password is the phone number** - This is convenient for new users to remember, but they should change it immediately after first login

2. **Change Password feature** - Users can change their password anytime using the "Change Password" button in the app sidebar (amber button with key icon)

3. **Service Role Key** - This powerful key should:
   - Only be used in secure environments
   - Never be committed to version control
   - Be regenerated if accidentally exposed
   - Be stored securely in CI/CD secrets if used in automation

## ❓ FAQ

### Q: What if a customer already has a user_id?
**A:** The script automatically skips them. It's safe to run the script multiple times.

### Q: What if the user creation fails?
**A:** The script will:
- Show the error for that customer
- Continue creating users for the remaining customers
- Report all failures in the summary
- Exit with an error code (use in scripts/CI-CD)

### Q: Can I change the email domain?
**A:** Yes! Edit `scripts/create-users-from-customers.js` and change this line:
```javascript
const email = `${customer.phone}@customer.local`; // Change 'customer.local'
```

### Q: Can I use a different password?
**A:** Yes! Edit the same file and change:
```javascript
const password = customer.phone; // Change this line
```

For example:
```javascript
const password = `Password${customer.phone}@123`; // Custom format
```

### Q: Can I automate this in CI/CD?
**A:** Yes! Store your Service Role Key as a secret and run:
```bash
export SUPABASE_SERVICE_ROLE_KEY="${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}"
node scripts/create-users-from-customers.js
```

## 🆘 Troubleshooting

### Error: "SUPABASE_SERVICE_ROLE_KEY environment variable is required!"

**Solution:** Make sure you set the environment variable:
```bash
export SUPABASE_SERVICE_ROLE_KEY="your-key-here"
node scripts/create-users-from-customers.js
```

Or use the interactive setup:
```bash
bash scripts/setup-users.sh
```

### Error: "Could not find SUPABASE_URL or SUPABASE_ANON_KEY"

**Solution:** Your `src/lib/env.ts` file might be missing. Make sure it exists with:
```typescript
export const SUPABASE_URL = 'https://...';
export const SUPABASE_ANON_KEY = '...';
```

### Error: "User creation returned no user data"

**Solution:** This usually means the email already exists in Supabase. Check:
- Is the customer already assigned a user_id?
- Was the script previously run?

### Error: "Failed to update customer"

**Solution:** Database permission issue. Check:
- Your Supabase RLS (Row Level Security) policies
- That your service role key is valid
- Your database connection

## 📝 What Gets Created

**In Supabase Auth:**
- New user account with email `{phone}@customer.local`
- Password: Phone number
- User metadata including name, phone, customer_id

**In Database:**
- Customer record updated with the new user_id
- Links customer to their Supabase auth account

## 🔗 Related Features

- **Change Password:** Users can change their password anytime using the "Change Password" feature in the app sidebar
- **Scoped Customer Access:** Customers linked to a user_id get read-only access to their own data
- **Auto-Logout:** Users are automatically logged out after 30 minutes of inactivity

## 📚 Learn More

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase User Management](https://supabase.com/docs/guides/auth/admin-api)
- See `scripts/README.md` for detailed script documentation
