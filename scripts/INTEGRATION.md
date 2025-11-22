#!/usr/bin/env node

/**
 * INTEGRATION GUIDE: User Creation Script
 * 
 * This script integrates with the Loan Management app to create Supabase users
 * from existing customers in the database.
 * 
 * QUICK REFERENCE
 * ===============
 * 
 * 1. Interactive Setup (Recommended for first-time):
 *    bash scripts/setup-users.sh
 * 
 * 2. Command Line Usage:
 *    export SUPABASE_SERVICE_ROLE_KEY="your-key-here"
 *    node scripts/create-users-from-customers.js
 * 
 * 3. Get Service Role Key:
 *    - Go to Supabase Dashboard
 *    - Settings → API
 *    - Copy "Service Role Secret"
 * 
 * WHAT IT DOES
 * ============
 * 
 * For each customer in the database WITHOUT a user_id:
 * 1. Creates a Supabase auth user
 * 2. Sets email to: {phone}@customer.local
 * 3. Sets password to: {phone} (customer's phone number)
 * 4. Stores customer info in user metadata
 * 5. Updates customer record with new user_id
 * 6. Reports success/failure for each customer
 * 
 * AFTER RUNNING
 * =============
 * 
 * Customers can now:
 * - Log in with email: {phone}@customer.local
 * - Log in with password: {phone}
 * - Change password using "Change Password" button in app sidebar
 * - View their own data (if scoped as customer user)
 * 
 * WORKFLOW WITH PASSWORD CHANGE FEATURE
 * ======================================
 * 
 * 1. Admin runs this script
 * 2. Users get: email={phone}@customer.local, password={phone}
 * 3. Users log in with those credentials
 * 4. Users immediately change password using app's Change Password feature
 * 5. Users securely use new password going forward
 * 
 * SECURITY CONSIDERATIONS
 * =======================
 * 
 * ✓ Service Role Key NOT in codebase (env var only)
 * ✓ Email auto-confirmed (no confirmation email sent)
 * ✓ User metadata stored for audit trail
 * ✓ Script validates input and errors
 * ✓ Database updated only after successful user creation
 * 
 * ✗ DO NOT commit Service Role Key to git
 * ✗ DO NOT share Service Role Key
 * ✗ DO NOT use anon key (script needs admin key)
 * 
 * FILES INVOLVED
 * ==============
 * 
 * Source:
 * - src/lib/env.ts - Provides SUPABASE_URL and SUPABASE_ANON_KEY
 * 
 * Scripts:
 * - scripts/create-users-from-customers.js - Main script (you are here)
 * - scripts/setup-users.sh - Interactive setup helper
 * 
 * Documentation:
 * - USERS.md - Quick start guide (best for users)
 * - scripts/README.md - Technical details (best for developers)
 * 
 * Related Features:
 * - components/modals/ChangePasswordModal.tsx - User password change
 * - components/Sidebar.tsx - Integrated with app UI
 * - context/DataContext.tsx - Auth integration
 * 
 * DATABASE SCHEMA
 * ===============
 * 
 * customers table:
 * - id: UUID
 * - user_id: UUID (updated by this script)
 * - name: string
 * - phone: string
 * - created_at: timestamp
 * 
 * After script runs:
 * - Customers with user_id are linked to Supabase auth users
 * - These customers can log in with their account
 * 
 * EXAMPLES
 * ========
 * 
 * Before:
 * | id  | name         | phone      | user_id |
 * |-----|--------------|-----------|---------|
 * | 1   | John Doe     | 9876543210| NULL    |
 * | 2   | Jane Smith   | 9123456789| NULL    |
 * 
 * After running script:
 * | id  | name         | phone      | user_id         |
 * |-----|--------------|-----------|-----------------|
 * | 1   | John Doe     | 9876543210| a1b2c3d4-...    |
 * | 2   | Jane Smith   | 9123456789| b2c3d4e5-...    |
 * 
 * Login credentials created:
 * - Email: 9876543210@customer.local
 * - Password: 9876543210
 * 
 * - Email: 9123456789@customer.local
 * - Password: 9123456789
 * 
 * TROUBLESHOOTING QUICK LINKS
 * ===========================
 * 
 * Problem: "SUPABASE_SERVICE_ROLE_KEY environment variable is required!"
 * Solution: See USERS.md section "Error: SUPABASE_SERVICE_ROLE_KEY..."
 * 
 * Problem: "User creation returned no user data"
 * Solution: See scripts/README.md section "Troubleshooting"
 * 
 * Problem: "Failed to update customer"
 * Solution: See scripts/README.md section "Error Handling"
 * 
 * For other issues, check:
 * - scripts/README.md (technical details)
 * - USERS.md (common questions)
 * 
 * CUSTOMIZATION
 * =============
 * 
 * To change email format:
 * Edit line: const email = `${customer.phone}@customer.local`;
 * 
 * To change password format:
 * Edit line: const password = customer.phone;
 * 
 * To modify user metadata:
 * Edit user_metadata object in createUser call
 * 
 * See scripts/README.md for detailed customization guide
 * 
 * INTEGRATION WITH APP
 * ====================
 * 
 * This script works with:
 * 
 * ✓ LoginPage.tsx
 *   - Users created by this script can log in
 *   - Phone can be used as email (normalized in login)
 * 
 * ✓ ChangePasswordModal.tsx (NEW)
 *   - Users can change password after first login
 *   - Available in Sidebar with amber button + key icon
 * 
 * ✓ DataContext.tsx
 *   - Manages session and user authentication
 *   - Scoped access for customer users (read-only)
 * 
 * ✓ Sidebar.tsx
 *   - Shows "Change Password" button for logged-in users
 *   - Available on desktop and mobile
 * 
 * ADVANCED: CI/CD INTEGRATION
 * ===========================
 * 
 * GitHub Actions example:
 * 
 * - name: Create users from customers
 *   env:
 *     SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
 *   run: node scripts/create-users-from-customers.js
 * 
 * Store SUPABASE_SERVICE_ROLE_KEY as a GitHub secret!
 * 
 * LOGS & AUDITING
 * ===============
 * 
 * Script outputs:
 * - Full customer name with phone number
 * - Success/failure status
 * - User ID generated (for reference)
 * - Error messages (if any)
 * - Summary of results
 * 
 * All user metadata is stored in Supabase auth user profile
 * Useful for auditing and support
 * 
 * PERFORMANCE
 * ===========
 * 
 * Time to create 100 users: ~2-3 minutes
 * (Depends on internet speed and Supabase load)
 * 
 * The script processes one customer at a time
 * Safe for large databases
 * 
 * VERSION HISTORY
 * ===============
 * 
 * v1.0 - Initial release
 * - Creates Supabase users from customers
 * - Uses phone as password
 * - Updates customer records
 * - Comprehensive error handling
 * - Interactive setup script
 * - Full documentation
 * 
 * For latest docs: See USERS.md and scripts/README.md
 * 
 */

console.log(`
╔════════════════════════════════════════════════════════════╗
║     LOAN MANAGEMENT APP - USER CREATION SCRIPT             ║
║                                                            ║
║  Creates Supabase users from customers in your database   ║
║  Uses phone numbers as initial passwords                  ║
╚════════════════════════════════════════════════════════════╝

📚 DOCUMENTATION

Quick Start:
  👉 Read: USERS.md (in project root)
  
For detailed technical info:
  👉 Read: scripts/README.md
  
To run interactively:
  👉 Run: bash scripts/setup-users.sh

To run from command line:
  👉 Run: export SUPABASE_SERVICE_ROLE_KEY="your-key"
         node scripts/create-users-from-customers.js

❓ Questions?
  Check USERS.md section "FAQ" or scripts/README.md "Troubleshooting"

Let's go! 🚀
`);
