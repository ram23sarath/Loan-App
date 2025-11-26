#!/usr/bin/env node

/**
 * CLI Script: Reset Customer Password
 *
 * Usage: node scripts/reset-password-cli.js <email> <new_password>
 *
 * Example:
 *   node scripts/reset-password-cli.js customer@example.com NewPassword123
 *   node scripts/reset-password-cli.js 9515808010@gmail.com MySecurePassword
 *
 * Environment variables can be set via:
 *   1. .env file in project root (recommended)
 *   2. System environment variables
 *   3. PowerShell: $env:SUPABASE_URL="..."; $env:SUPABASE_SERVICE_ROLE_KEY="..."
 *
 * This script will:
 * 1. Validate email and password inputs
 * 2. Connect to Supabase with service role key
 * 3. Find the user by email
 * 4. Update their password
 * 5. Show success or error message
 */

import { createClient } from '@supabase/supabase-js';
import readline from 'readline';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env file if it exists
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  error: (msg) => console.log(`${colors.red}❌ Error: ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ Success: ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.cyan}ℹ️  ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}⚠️  Warning: ${msg}${colors.reset}`),
};

// Validate configuration
function validateConfig() {
  if (!SUPABASE_URL) {
    log.error('SUPABASE_URL environment variable is not set');
    process.exit(1);
  }
  if (!SERVICE_ROLE_KEY) {
    log.error('SUPABASE_SERVICE_ROLE_KEY environment variable is not set');
    process.exit(1);
  }
}

// Validate email format
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate password strength
function validatePassword(password) {
  if (password.length < 6) {
    log.error('Password must be at least 6 characters');
    return false;
  }
  return true;
}

// Create readline interface for interactive input
function createInputInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

// Get input from user
function getUserInput(prompt) {
  return new Promise((resolve) => {
    const rl = createInputInterface();
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Hide password input
function getPasswordInput(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    rl.question(prompt, (password) => {
      rl.close();
      resolve(password);
    });
  });
}

// Main function
async function resetPassword() {
  try {
    // Validate environment variables
    validateConfig();

    log.info('Customer Password Reset Tool');
    console.log('');

    // Get email from command line arguments or prompt user
    let email = process.argv[2];
    if (!email) {
      email = await getUserInput('Enter customer email address: ');
    }

    // Validate email
    if (!validateEmail(email)) {
      log.error('Invalid email format');
      process.exit(1);
    }

    // Get password from command line arguments or prompt user
    let password = process.argv[3];
    if (!password) {
      password = await getPasswordInput('Enter new password: ');
    }

    // Validate password
    if (!validatePassword(password)) {
      process.exit(1);
    }

    // Confirm password
    const confirmPassword = await getPasswordInput('Confirm new password: ');
    if (password !== confirmPassword) {
      log.error('Passwords do not match');
      process.exit(1);
    }

    // Show summary
    console.log('');
    log.info(`Resetting password for: ${email}`);

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    log.info('Connecting to Supabase...');

    // List all users with pagination to find the target user
    let allUsers = [];
    let page = 1;
    let hasMore = true;

    log.info('Fetching all users...');
    while (hasMore) {
      const { data: users, error: listError } = await supabase.auth.admin.listUsers({
        perPage: 1000,
        page: page,
      });

      if (listError) {
        log.error(`Failed to access users: ${listError.message}`);
        process.exit(1);
      }

      const pageUsers = users?.users || [];
      allUsers = allUsers.concat(pageUsers);
      
      // Check if there are more pages
      hasMore = pageUsers.length === 1000;
      page++;
    }

    log.info(`Found ${allUsers.length} total users`);

    // Find user by email (case-insensitive)
    const user = allUsers.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (!user) {
      log.error(`User with email "${email}" not found in system`);
      console.log('');
      log.info(`Searched ${allUsers.length} users. Sample users:`);
      allUsers.slice(0, 10).forEach(u => {
        console.log(`  - ${u.email}`);
      });
      if (allUsers.length > 10) {
        console.log(`  ... and ${allUsers.length - 10} more`);
      }
      process.exit(1);
    }

    log.success(`Found user: ${user.id}`);
    log.info('Updating password...');

    // Update password
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      password: password,
    });

    if (updateError) {
      log.error(`Failed to reset password: ${updateError.message}`);
      process.exit(1);
    }

    log.success(`Password reset successfully for ${email}`);
    console.log('');
    console.log(`${colors.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.green}  Password Reset Completed${colors.reset}`);
    console.log(`${colors.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`  Email: ${email}`);
    console.log(`  User ID: ${user.id}`);
    console.log(`  Updated at: ${new Date().toLocaleString()}`);
    console.log(`${colors.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log('');
  } catch (error) {
    log.error(`Unexpected error: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
resetPassword();
