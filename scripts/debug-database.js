#!/usr/bin/env node

/**
 * Debug script to check database contents
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkDatabase() {
  console.log('🔍 Checking database...\n');

  try {
    // Check customers table
    console.log('📊 Customers table:');
    const { data: customers, error: custError, count } = await supabase
      .from('customers')
      .select('*', { count: 'exact' });

    if (custError) {
      console.error('❌ Error:', custError.message);
    } else {
      console.log(`   Total count: ${count}`);
      console.log(`   Returned: ${customers?.length || 0} records`);
      if (customers && customers.length > 0) {
        console.log('\n   First 3 customers:');
        customers.slice(0, 3).forEach((c, i) => {
          console.log(`   ${i + 1}. ${c.name} (${c.phone}) - user_id: ${c.user_id || 'none'}`);
        });
      }
    }

    // Check auth users count
    console.log('\n📊 Auth users table:');
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();
    if (userError) {
      console.error('   ❌ Error:', userError.message);
    } else {
      console.log(`   Total: ${users?.users?.length || 0} users`);
    }

  } catch (error) {
    console.error('❌ Fatal error:', error.message || error);
  }
}

checkDatabase();
