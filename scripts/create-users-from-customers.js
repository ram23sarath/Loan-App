#!/usr/bin/env node

/**
 * Script to create Supabase users from existing customers
 * 
 * This script:
 * 1. Fetches all customers from the database
 * 2. For each customer without a user_id, creates a Supabase auth user
 * 3. Uses the customer's phone number as the password
 * 4. Converts phone to email format (phone@example.com)
 * 5. Updates the customer record with the new user_id
 * 
 * Usage: node scripts/create-users-from-customers.js
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load environment variables from src/lib/env.ts
const envPath = resolve('./src/lib/env.ts');
const envContent = readFileSync(envPath, 'utf-8');

const urlMatch = envContent.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)['"]/);
const keyMatch = envContent.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)['"]/);

if (!urlMatch || !keyMatch) {
  console.error('❌ Could not find SUPABASE_URL or SUPABASE_ANON_KEY in src/lib/env.ts');
  process.exit(1);
}

const SUPABASE_URL = urlMatch[1];
const SUPABASE_ANON_KEY = keyMatch[1];

// For creating users, we need the service role key, not the anon key
// You'll need to set SUPABASE_SERVICE_ROLE_KEY environment variable
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required!');
  console.error('Set it before running this script:');
  console.error('  export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"');
  console.error('');
  console.error('You can find your service role key in your Supabase dashboard:');
  console.error('  Settings → API → Service Role Key');
  process.exit(1);
}

// Create admin client with service role key for user creation
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function createUsersFromCustomers() {
  console.log('🚀 Starting user creation from customers...\n');

  try {
    // Step 1: Fetch all customers
    console.log('📥 Fetching customers from database...');
    const { data: customers, error: fetchError } = await supabase
      .from('customers')
      .select('id, name, phone, user_id')
      .order('created_at', { ascending: true });

    if (fetchError) {
      console.error('❌ Error fetching customers:', fetchError);
      process.exit(1);
    }

    if (!customers || customers.length === 0) {
      console.log('ℹ️  No customers found in the database.');
      process.exit(0);
    }

    console.log(`✅ Found ${customers.length} customers\n`);

    // Filter customers without user_id
    const customersWithoutUser = customers.filter((c) => !c.user_id);
    if (customersWithoutUser.length === 0) {
      console.log('✅ All customers already have user accounts. Nothing to do!');
      process.exit(0);
    }

    console.log(`📝 Will create ${customersWithoutUser.length} user(s)\n`);

    const results = {
      success: [],
      failed: [],
    };

    // Step 2: Create users
    for (const customer of customersWithoutUser) {
      const email = `${customer.phone}@gmail.com`;
      const password = customer.phone; // Use phone number as password

      try {
        console.log(
          `Creating user for: ${customer.name} (Phone: ${customer.phone})...`
        );

        // Create the auth user
        const { data: userData, error: createError } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true, // Auto-confirm email
          user_metadata: {
            name: customer.name,
            phone: customer.phone,
            customer_id: customer.id,
          },
        });

        if (createError) {
          throw new Error(createError.message);
        }

        if (!userData.user) {
          throw new Error('User creation returned no user data');
        }

        const userId = userData.user.id;

        // Step 3: Update customer with user_id
        const { error: updateError } = await supabase
          .from('customers')
          .update({ user_id: userId })
          .eq('id', customer.id);

        if (updateError) {
          throw new Error(`Failed to update customer: ${updateError.message}`);
        }

        results.success.push({
          customerName: customer.name,
          phone: customer.phone,
          email,
          userId,
        });

        console.log(`  ✅ User created with ID: ${userId}\n`);
      } catch (error) {
        results.failed.push({
          customerName: customer.name,
          phone: customer.phone,
          error: error.message,
        });

        console.log(
          `  ❌ Failed: ${error.message}\n`
        );
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successfully created: ${results.success.length} user(s)`);
    console.log(`❌ Failed: ${results.failed.length} user(s)\n`);

    if (results.success.length > 0) {
      console.log('Successfully created users:');
      results.success.forEach((user) => {
        console.log(
          `  • ${user.customerName} (${user.phone}) → ${user.email} [ID: ${user.userId}]`
        );
      });
    }

    if (results.failed.length > 0) {
      console.log('\nFailed to create users:');
      results.failed.forEach((user) => {
        console.log(`  • ${user.customerName} (${user.phone}): ${user.error}`);
      });
    }

    if (results.failed.length > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

// Run the script
createUsersFromCustomers();
