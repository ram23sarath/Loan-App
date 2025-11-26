#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve('./src/lib/env.ts');
const envContent = readFileSync(envPath, 'utf-8');
const urlMatch = envContent.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)['"]/);

const SUPABASE_URL = urlMatch[1];
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const phone = process.argv[2] || '2098765432';

async function debug() {
  console.log(`\n🔍 Debugging customer: ${phone}\n`);

  // Get customer from DB
  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, phone, user_id')
    .eq('phone', phone);

  if (customers && customers.length > 0) {
    const customer = customers[0];
    console.log('✅ Customer found in database:');
    console.log(`   Name: ${customer.name}`);
    console.log(`   Phone: ${customer.phone}`);
    console.log(`   User ID: ${customer.user_id}`);
    console.log('');

    // Check if user_id references an existing auth user
    if (customer.user_id) {
      const { data: authUser } = await supabase.auth.admin.getUserById(customer.user_id);
      if (authUser?.user) {
        console.log('✅ Auth user found for this user_id:');
        console.log(`   Email: ${authUser.user.email}`);
        console.log(`   ID: ${authUser.user.id}`);
      } else {
        console.log('❌ Auth user NOT found for this user_id');
        console.log(`   Referenced ID: ${customer.user_id}`);
        console.log('   -> User needs to be recreated');
      }
    } else {
      console.log('❌ No user_id in customer record');
      console.log('   -> User needs to be created');
    }
  } else {
    console.log('❌ Customer not found in database');
  }

  // Check if email exists in auth
  console.log('');
  const email = `${phone}@gmail.com`;
  console.log(`🔍 Checking for email: ${email}`);
  
  const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000, page: 1 });
  const authUsers = authData?.users || [];
  const foundAuth = authUsers.find(u => u.email === email);
  
  if (foundAuth) {
    console.log(`✅ Auth user found with this email:`);
    console.log(`   Email: ${foundAuth.email}`);
    console.log(`   ID: ${foundAuth.id}`);
  } else {
    console.log(`❌ No auth user with email: ${email}`);
    console.log(`   Total auth users searched: ${authUsers.length}`);
  }
}

debug().catch(console.error);
