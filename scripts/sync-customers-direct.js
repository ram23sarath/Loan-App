#!/usr/bin/env node

/**
 * Script to sync all customer phone numbers with Supabase auth emails
 * 
 * This version calls Supabase auth directly instead of via Netlify function
 * 
 * Usage: 
 *   export SUPABASE_URL="your-url"
 *   export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
 *   node scripts/sync-customers-direct.js
 */

import { createClient } from '@supabase/supabase-js';

// Get environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing configuration!');
  console.error('Set environment variables before running this script:');
  console.error('  export SUPABASE_URL="your-supabase-url"');
  console.error('  export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"');
  process.exit(1);
}

// Create admin client with service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function syncCustomersToAuthDirect() {
  console.log('🚀 Starting direct sync of customers to auth...\n');

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

      if (!/^\d{10}$/.test(customer.phone)) {
        console.log(`⏭️  Skipping ${customer.name}: invalid phone (${customer.phone})`);
        continue;
      }

      try {
        console.log(`🔄 Syncing ${customer.name} (${customer.phone})...`);

        const expectedEmail = `${customer.phone}@gmail.com`;
        const expectedPassword = customer.phone;

        // If no linked user, create one
        if (!customer.user_id) {
          try {
            const { data: userData, error: createErr } = await supabase.auth.admin.createUser({
              email: expectedEmail,
              password: expectedPassword,
              email_confirm: true,
              user_metadata: { name: customer.name || '', phone: customer.phone, customer_id: customer.id },
            });

            if (createErr) {
              console.error(`   ❌ Failed to create: ${createErr.message}`);
              failed++;
              failures.push({ customer: customer.name, id: customer.id, error: createErr.message });
              continue;
            }

            const newUserId = userData?.user?.id;
            if (!newUserId) {
              console.error('   ❌ Created user but no id returned');
              failed++;
              failures.push({ customer: customer.name, id: customer.id, error: 'No user id returned' });
              continue;
            }

            // Update customer.user_id
            const { error: updErr } = await supabase
              .from('customers')
              .update({ user_id: newUserId })
              .eq('id', customer.id);

            if (updErr) {
              console.error(`   ❌ Failed to link user: ${updErr.message}`);
              failed++;
              failures.push({ customer: customer.name, id: customer.id, error: `Created but link failed: ${updErr.message}` });
              continue;
            }

            console.log(`   ✨ Created new user: ${expectedEmail}`);
            created++;
          } catch (createErr) {
            console.error(`   ❌ Exception creating user: ${createErr.message}`);
            failed++;
            failures.push({ customer: customer.name, id: customer.id, error: createErr.message });
          }
        } else {
          // Try to update existing user
          try {
            const { error: updateErr } = await supabase.auth.admin.updateUserById(customer.user_id, {
              email: expectedEmail,
              password: expectedPassword,
              email_confirm: true,
            });

            if (updateErr) {
              // User might not exist, try to create new one
              if (updateErr.status === 404 || /not found/i.test(updateErr.message)) {
                console.log(`   🔄 User deleted, recreating...`);
                const { data: userData, error: createErr } = await supabase.auth.admin.createUser({
                  email: expectedEmail,
                  password: expectedPassword,
                  email_confirm: true,
                  user_metadata: { name: customer.name || '', phone: customer.phone, customer_id: customer.id },
                });

                if (createErr) {
                  console.error(`   ❌ Failed to recreate: ${createErr.message}`);
                  failed++;
                  failures.push({ customer: customer.name, id: customer.id, error: `Recreate failed: ${createErr.message}` });
                  continue;
                }

                const newUserId = userData?.user?.id;
                if (newUserId && newUserId !== customer.user_id) {
                  await supabase.from('customers').update({ user_id: newUserId }).eq('id', customer.id);
                }

                console.log(`   ✨ Recreated user: ${expectedEmail}`);
                created++;
              } else {
                console.error(`   ❌ Update failed: ${updateErr.message}`);
                failed++;
                failures.push({ customer: customer.name, id: customer.id, error: updateErr.message });
              }
            } else {
              console.log(`   ✅ Updated user: ${expectedEmail}`);
              updated++;
            }
          } catch (updateErr) {
            console.error(`   ❌ Exception updating user: ${updateErr.message}`);
            failed++;
            failures.push({ customer: customer.name, id: customer.id, error: updateErr.message });
          }
        }
      } catch (err) {
        console.error(`   ❌ Exception: ${err.message}`);
        failed++;
        failures.push({ customer: customer.name, id: customer.id, error: err.message });
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Sync Summary:');
    console.log(`   ✨ Created: ${created}`);
    console.log(`   ✅ Updated: ${updated}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log('='.repeat(60));

    if (failures.length > 0 && failures.length <= 10) {
      console.log('\n❌ Failed customers:');
      failures.forEach((f) => {
        console.log(`   • ${f.customer} (${f.id}): ${f.error}`);
      });
    } else if (failures.length > 10) {
      console.log(`\n❌ ${failures.length} customers failed (showing first 10):`);
      failures.slice(0, 10).forEach((f) => {
        console.log(`   • ${f.customer} (${f.id}): ${f.error}`);
      });
    }

    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('❌ Fatal error:', error.message || error);
    process.exit(1);
  }
}

syncCustomersToAuthDirect();
