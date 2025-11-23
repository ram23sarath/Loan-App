#!/usr/bin/env node

/**
 * Script: compare-customers-users.js
 *
 * Compares customers in the `customers` table with Auth users in Supabase
 * and prints which customers are missing a linked auth user (either no
 * `user_id` set or the `user_id` doesn't exist in the auth users list).
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY="..." node scripts/compare-customers-users.js
 *
 * Requirements:
 * - The repo already contains `src/lib/env.ts` with `SUPABASE_URL` and
 *   `SUPABASE_ANON_KEY`. This script uses the Service Role Key via
 *   the environment variable `SUPABASE_SERVICE_ROLE_KEY` to list auth users.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Read SUPABASE_URL and (optional) ANON key from src/lib/env.ts similar to other scripts
const envPath = resolve('./src/lib/env.ts');
let envContent = '';
try {
  envContent = readFileSync(envPath, 'utf-8');
} catch (err) {
  console.error(`❌ Could not read ${envPath}. Make sure you're running this from project root.`);
  process.exit(1);
}

const urlMatch = envContent.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)['"]/);
const keyMatch = envContent.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)['"]/);

if (!urlMatch) {
  console.error('❌ Could not find SUPABASE_URL in src/lib/env.ts');
  process.exit(1);
}

const SUPABASE_URL = urlMatch[1];
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required!');
  console.error('Set it before running this script:');
  console.error('  export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function listAllAuthUsers() {
  // supabase.auth.admin.listUsers() returns paginated results in some SDK versions.
  // We'll call it once and attempt to gather `data.users`. If pagination is present
  // the response may include `data.next` or similar; for most projects the user
  // count is small enough that a single call suffices. If you have >1000 users,
  // extend this function to follow pagination using the appropriate token.

  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) throw error;
  if (!data) return [];
  // Some SDK shapes: data.users or data?.users
  if (Array.isArray(data)) return data; // defensive
  return data.users || [];
}

async function run() {
  try {
    console.log('🔎 Fetching customers from `customers` table...');
    const { data: customers, error: custErr } = await supabase
      .from('customers')
      .select('id, name, phone, user_id')
      .order('created_at', { ascending: true });

    if (custErr) throw custErr;
    if (!customers) {
      console.log('ℹ️  No customers found');
      return;
    }

    console.log(`✅ Found ${customers.length} customers`);

    console.log('🔐 Fetching auth users from Supabase...');
    const authUsers = await listAllAuthUsers();
    console.log(`✅ Found ${authUsers.length} auth users`);

    const authUserIds = new Set(authUsers.map((u) => u.id));

    const noUserId = customers.filter((c) => !c.user_id);
    const userIdMissing = customers.filter(
      (c) => c.user_id && !authUserIds.has(c.user_id)
    );

    console.log('\n' + '='.repeat(60));
    console.log('📊 Comparison Summary');
    console.log('='.repeat(60));
    console.log(`Total customers: ${customers.length}`);
    console.log(`Total auth users: ${authUsers.length}`);
    console.log(`Customers without user_id: ${noUserId.length}`);
    console.log(`Customers with user_id but missing in auth.users: ${userIdMissing.length}`);

    if (noUserId.length > 0) {
      console.log('\nCustomers missing user_id:');
      noUserId.forEach((c) => {
        console.log(` - ${c.id} | ${c.name} | phone: ${c.phone}`);
      });
    }

    if (userIdMissing.length > 0) {
      console.log('\nCustomers referencing a missing auth user:');
      userIdMissing.forEach((c) => {
        console.log(` - ${c.id} | ${c.name} | user_id: ${c.user_id} | phone: ${c.phone}`);
      });
    }

    if (noUserId.length === 0 && userIdMissing.length === 0) {
      console.log('\n✅ All customers have matching auth users.');
    }
  } catch (err) {
    console.error('❌ Error:', err.message || err);
    process.exit(1);
  }
}

run();
