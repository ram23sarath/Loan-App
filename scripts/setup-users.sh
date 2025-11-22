#!/bin/bash

# Quick setup script to help users get the service role key and run the user creation script
# Usage: bash scripts/setup-users.sh

set -e

echo "🚀 Loan Management - User Creation Setup"
echo "========================================"
echo ""

# Check if we're in the right directory
if [ ! -f "src/lib/env.ts" ]; then
  echo "❌ Error: Please run this script from the project root directory"
  exit 1
fi

echo "This script will help you create Supabase users from your customers."
echo ""
echo "You'll need your Supabase Service Role Key. Here's how to get it:"
echo ""
echo "1. Go to your Supabase Dashboard: https://supabase.com/dashboard"
echo "2. Select your project"
echo "3. Go to Settings → API"
echo "4. Copy the 'Service Role Secret' (NOT the anon key)"
echo ""
echo "⚠️  KEEP THIS KEY SECURE - Never commit it to version control!"
echo ""

read -p "Do you have your Service Role Key ready? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Get your key from Supabase dashboard and run this script again."
  exit 0
fi

echo ""
read -sp "Enter your Supabase Service Role Key: " SERVICE_ROLE_KEY
echo ""
echo ""

# Validate the key format (basic check)
if [ ${#SERVICE_ROLE_KEY} -lt 50 ]; then
  echo "❌ Error: The key seems too short. Please verify you copied the entire Service Role Key."
  exit 1
fi

# Export the key and run the script
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"

echo "🔄 Running user creation script..."
echo ""

node scripts/create-users-from-customers.js

exit_code=$?

if [ $exit_code -eq 0 ]; then
  echo ""
  echo "✅ User creation completed successfully!"
  echo ""
  echo "Next steps:"
  echo "1. Users can now log in with:"
  echo "   Email: {customer_phone}@customer.local"
  echo "   Password: {customer_phone}"
  echo ""
  echo "2. After login, users should change their password using the"
  echo "   'Change Password' feature in the app sidebar."
else
  echo ""
  echo "⚠️  User creation script exited with errors. See above for details."
  exit $exit_code
fi
