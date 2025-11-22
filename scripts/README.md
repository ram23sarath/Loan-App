# User Creation Script

This directory contains scripts for managing users in the Loan Management application.

## `create-users-from-customers.js`

A Node.js script that creates Supabase authentication users from existing customers in the database.

### What it does:
1. Fetches all customers from the database
2. For each customer without an existing Supabase user account:
   - Creates a new Supabase auth user
   - Uses the customer's phone number as the email (converted to `{phone}@customer.local`)
   - Uses the customer's phone number as the initial password
   - Sets the user's metadata with customer name, phone, and customer_id
3. Updates the customer record with the new user_id
4. Provides a detailed summary of successes and failures

### Prerequisites:

1. **Node.js installed** - The script runs with Node.js
2. **Supabase Service Role Key** - Required to create users in Supabase
   - Found in Supabase Dashboard → Settings → API → Service Role Secret Key
   - ⚠️ **IMPORTANT**: Never commit this key to version control. Only use it in scripts run locally or in secure CI/CD environments.

### Usage:

#### Step 1: Set the Supabase Service Role Key
```bash
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"
```

#### Step 2: Run the script
```bash
node scripts/create-users-from-customers.js
```

### Example Output:
```
🚀 Starting user creation from customers...

📥 Fetching customers from database...
✅ Found 5 customers

📝 Will create 3 user(s)

Creating user for: John Doe (Phone: 9876543210)...
  ✅ User created with ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890

Creating user for: Jane Smith (Phone: 9123456789)...
  ✅ User created with ID: b2c3d4e5-f6a7-8901-bcde-f12345678901

...

============================================================
📊 SUMMARY
============================================================
✅ Successfully created: 3 user(s)
❌ Failed: 0 user(s)

Successfully created users:
  • John Doe (9876543210) → 9876543210@customer.local [ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890]
  • Jane Smith (9123456789) → 9123456789@customer.local [ID: b2c3d4e5-f6a7-8901-bcde-f12345678901]
  • ...
```

### Notes:

- **Initial Password**: Customers can log in with:
  - Email: `{phone}@customer.local`
  - Password: Their phone number
- **Password Change**: After first login, users should change their password using the "Change Password" feature in the app
- **Idempotent**: The script automatically skips customers who already have a user_id, so it's safe to run multiple times
- **Error Handling**: If a user creation fails, the script will continue with the next customer and report all failures at the end

### Troubleshooting:

**Error: "SUPABASE_SERVICE_ROLE_KEY environment variable is required!"**
- Make sure you exported the service role key:
  ```bash
  export SUPABASE_SERVICE_ROLE_KEY="your-key"
  node scripts/create-users-from-customers.js
  ```

**Error: "User creation returned no user data"**
- This typically means the email already exists in Supabase
- Check if the customer was already created
- The customer record should have a user_id if they were previously created

**Error: "Failed to update customer"**
- This means the user was created in Supabase but couldn't be linked to the customer
- The database might have permission issues
- Check your Supabase RLS (Row Level Security) policies

### Security Considerations:

1. **Service Role Key**: Only use this key in secure environments (local development or CI/CD with proper secrets management)
2. **Email Format**: Customers are created with `{phone}@customer.local` - adjust if needed
3. **Password**: Phone numbers are used as initial passwords - encourage users to change them immediately after first login
4. **Metadata**: Customer information is stored in user metadata for easy access in the application

### Extending the Script:

To modify password rules, email format, or user metadata:
- Edit the `createUsersFromCustomers()` function
- Change the `email` variable format
- Change the `password` variable
- Modify the `user_metadata` object

Example: To use a different email domain:
```javascript
const email = `${customer.phone}@example.com`; // Change from customer.local
```
