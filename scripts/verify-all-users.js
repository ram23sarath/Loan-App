#!/usr/bin/env node

/**
 * Script: verify-all-users.js
 *
 * Verifies that ALL customers have linked auth users in Supabase.
 * Handles pagination properly to get ALL auth users (not just first 50).
 *
 * Usage:
 *   node scripts/verify-all-users.js
 *
 * Environment:
 *   SUPABASE_SERVICE_ROLE_KEY - Required (from .env or env variable)
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

// Load .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Read Supabase URL from src/lib/env.ts
const envPath = path.join(__dirname, '..', 'src', 'lib', 'env.ts');
const envContent = readFileSync(envPath, 'utf-8');
const urlMatch = envContent.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)['"]/);

if (!urlMatch) {
  console.error('❌ Could not find SUPABASE_URL in src/lib/env.ts');
  process.exit(1);
}

const SUPABASE_URL = urlMatch[1];
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required!');
  process.exit(1);
}

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

const log = {
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.cyan}ℹ️  ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  header: (msg) => console.log(`\n${colors.magenta}${'='.repeat(60)}${colors.reset}\n${colors.magenta}${msg}${colors.reset}\n${colors.magenta}${'='.repeat(60)}${colors.reset}\n`),
};

async function getAllAuthUsers() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let allUsers = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    log.info(`Fetching auth users page ${page}...`);
    
    const { data, error } = await supabase.auth.admin.listUsers({
      perPage: 1000, // Max per page
      page: page,
    });

    if (error) throw error;

    const users = data?.users || [];
    allUsers = allUsers.concat(users);

    // Check if there are more pages
    hasMore = users.length === 1000;
    page++;
  }

  return allUsers;
}

async function verifyAllUsers() {
  log.header('🔍 User Verification Tool');

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Fetch all customers
    log.info('Fetching customers...');
    const { data: customers, error: custError } = await supabase
      .from('customers')
      .select('id, name, phone, user_id')
      .order('created_at', { ascending: true });

    if (custError) throw custError;
    if (!customers || customers.length === 0) {
      log.warn('No customers found');
      return;
    }

    log.success(`Found ${customers.length} customers`);

    // Fetch all auth users with pagination
    const authUsers = await getAllAuthUsers();
    log.success(`Found ${authUsers.length} total auth users (across all pages)`);

    // Create maps for quick lookups
    const authUserIds = new Set(authUsers.map(u => u.id));
    const authUserEmails = new Set(authUsers.map(u => u.email));

    // Analyze customers
    const customersWithoutUserId = customers.filter(c => !c.user_id);
    const customersWithOrphanedUserId = customers.filter(
      c => c.user_id && !authUserIds.has(c.user_id)
    );

    // Check if customers can still log in even if user_id is orphaned
    const customersCanLogin = customersWithOrphanedUserId.filter(
      c => authUserEmails.has(`${c.phone}@gmail.com`)
    );

    log.header('📊 Verification Summary');

    console.log(`Total customers: ${customers.length}`);
    console.log(`Total auth users: ${authUsers.length}`);
    console.log('');

    if (customersWithoutUserId.length === 0) {
      log.success(`All ${customers.length} customers have a user_id assigned`);
    } else {
      log.warn(`${customersWithoutUserId.length} customer(s) without user_id`);
    }

    if (customersWithOrphanedUserId.length === 0) {
      log.success(`All user_id values reference valid auth users`);
    } else {
      log.warn(`${customersWithOrphanedUserId.length} customer(s) with orphaned user_id`);
    }

    console.log('');

    // Show recoverable orphans
    if (customersCanLogin.length > 0) {
      log.info(`${customersCanLogin.length} customer(s) with orphaned user_id but CAN still login:`);
      console.log('  (They can login because auth user exists with phone@gmail.com format)');
      customersCanLogin.slice(0, 10).forEach(c => {
        console.log(`    • ${c.name} (${c.phone}@gmail.com)`);
      });
      if (customersCanLogin.length > 10) {
        console.log(`    ... and ${customersCanLogin.length - 10} more`);
      }
      console.log('');
      log.info(`To fix these, update their user_id to match the auth user:`);
      console.log(`  node scripts/fix-orphaned-user-ids.js`);
    }

    // Show unrecoverable orphans
    const unrecover = customersWithOrphanedUserId.filter(
      c => !authUserEmails.has(`${c.phone}@gmail.com`)
    );
    if (unrecover.length > 0) {
      log.warn(`${unrecover.length} customer(s) with UNRECOVERABLE orphaned user_id:`);
      console.log('  (Auth user does not exist - needs to be recreated)');
      unrecover.slice(0, 5).forEach(c => {
        console.log(`    • ${c.name} (${c.phone})`);
      });
      if (unrecover.length > 5) {
        console.log(`    ... and ${unrecover.length - 5} more`);
      }
    }

    // Final status
    console.log('');
    const allValid = customersWithoutUserId.length === 0 && 
                     customersWithOrphanedUserId.length === 0;
    
    if (allValid) {
      log.success('✨ All customers are properly configured!');
    } else if (customersCanLogin.length === customersWithOrphanedUserId.length) {
      log.warn('⚠️  All customers can login, but user_id records are stale.');
      log.info('Run: node scripts/fix-orphaned-user-ids.js');
    } else {
      log.error('Some customers may have login issues.');
    }

  } catch (error) {
    log.error(`Unexpected error: ${error.message}`);
    process.exit(1);
  }
}

verifyAllUsers();
