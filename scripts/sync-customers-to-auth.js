#!/usr/bin/env node

/**
 * Script to sync all customer phone numbers with Supabase auth emails
 * 
 * This script:
 * 1. Fetches all customers from the database
 * 2. For each customer with a phone number, calls the update-user-from-customer function
 * 3. Updates or creates auth users to match phone@gmail.com email and phone password
 * 
 * Usage: 
 *   export ADMIN_API_KEY="your-admin-key"
 *   export NETLIFY_SITE_URL="https://your-site.netlify.app"
 *   node scripts/sync-customers-to-auth.js
 */

import { createClient } from '@supabase/supabase-js';

// Get environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;
const NETLIFY_SITE_URL = process.env.NETLIFY_SITE_URL;

if (!SUPABASE_URL) {
  console.error('❌ Missing SUPABASE_URL!');
  console.error('Set environment variables before running this script:');
  console.error('  export VITE_SUPABASE_URL="your-supabase-url"');
  process.exit(1);
}

// Use service role key if available (bypasses RLS), otherwise fall back to anon key
const key = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
if (!key) {
  console.error('❌ Missing Supabase keys!');
  console.error('Set environment variables before running this script:');
  console.error('  export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key" (preferred)');
  console.error('  OR export VITE_SUPABASE_ANON_KEY="your-anon-key"');
  process.exit(1);
}

if (key === SUPABASE_ANON_KEY) {
  console.warn('⚠️  Using anon key. If this fails due to RLS, set SUPABASE_SERVICE_ROLE_KEY.');
}

if (!ADMIN_API_KEY) {
  console.error('❌ ADMIN_API_KEY environment variable is required!');
  console.error('Set it before running this script:');
  console.error('  export ADMIN_API_KEY="your-admin-key"');
  process.exit(1);
}

if (!NETLIFY_SITE_URL) {
  console.error('❌ NETLIFY_SITE_URL environment variable is required!');
  console.error('Set it before running this script:');
  console.error('  export NETLIFY_SITE_URL="https://your-site.netlify.app"');
  process.exit(1);
}

// Create client to fetch customer data (use service role key to bypass RLS)
const supabase = createClient(SUPABASE_URL, key, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const functionUrl = `${NETLIFY_SITE_URL}/.netlify/functions/update-user-from-customer`;

async function syncCustomersToAuth() {
  console.log('🚀 Starting sync of customers to auth...\n');

  try {
    // Fetch all customers
    console.log('📋 Fetching all customers...');
    const { data: customers, error } = await supabase
      .from('customers')
      .select('id, name, phone, user_id')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching customers:', error.message);
      process.exit(1);
    }

    if (!customers || customers.length === 0) {
      console.log('⚠️  No customers found in database');
      process.exit(0);
    }

    console.log(`✅ Found ${customers.length} customers\n`);

    let updated = 0;
    let created = 0;
    let failed = 0;
    const failures = [];

    // Process each customer
    for (const customer of customers) {
      if (!customer.phone) {
        console.log(`⏭️  Skipping ${customer.name} (${customer.id}): no phone number`);
        continue;
      }

      try {
        console.log(`🔄 Syncing ${customer.name} (${customer.phone})...`);

        const response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-api-key': ADMIN_API_KEY,
          },
          body: JSON.stringify({
            customer_id: customer.id,
            phone: customer.phone,
          }),
        });

        const responseText = await response.text();
        let result;
        
        try {
          result = JSON.parse(responseText);
        } catch (parseErr) {
          console.error(`   ❌ Invalid response: ${responseText}`);
          failed++;
          failures.push({
            customer: customer.name,
            id: customer.id,
            error: `Invalid response: ${responseText}`,
          });
          continue;
        }

        if (!response.ok) {
          console.error(`   ❌ Error: ${result.error || responseText}`);
          failed++;
          failures.push({
            customer: customer.name,
            id: customer.id,
            error: result.error || responseText,
          });
        } else {
          if (result.created) {
            console.log(`   ✨ Created new user: ${result.email}`);
            created++;
          } else if (result.updated) {
            console.log(`   ✅ Updated existing user: ${result.email}`);
            updated++;
          } else if (result.recreated) {
            console.log(`   🔄 Recreated user: ${result.email}`);
            created++;
          }
        }
      } catch (err) {
        console.error(`   ❌ Exception: ${err.message}`);
        failed++;
        failures.push({
          customer: customer.name,
          id: customer.id,
          error: err.message,
        });
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Sync Summary:');
    console.log(`   ✨ Created: ${created}`);
    console.log(`   ✅ Updated: ${updated}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log('='.repeat(60));

    if (failures.length > 0) {
      console.log('\n❌ Failed customers:');
      failures.forEach((f) => {
        console.log(`   • ${f.customer} (${f.id}): ${f.error}`);
      });
    }

    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('❌ Fatal error:', error.message || error);
    process.exit(1);
  }
}

syncCustomersToAuth();
