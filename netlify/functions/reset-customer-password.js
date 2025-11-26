import { createClient } from '@supabase/supabase-js';

/**
 * Netlify Function: Reset Customer Password
 *
 * This function allows admins to reset a customer's password directly.
 * It takes the customer's email and a new password, then updates it in Supabase auth.
 *
 * Called via POST request with JSON body:
 *  { email: string, new_password: string }
 *
 * Environment variables required:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Missing Supabase configuration');
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { email, new_password } = await req.json();

    // Validate input
    if (!email || !new_password) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email and new_password' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate password strength
    if (new_password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 6 characters' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    console.log(`🔐 Attempting to reset password for: ${email}`);

    // Find user by email
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      console.error('Error listing users:', listError.message);
      return new Response(
        JSON.stringify({ error: `Failed to access users: ${listError.message}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Search for user with matching email
    const user = users.users.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (!user) {
      console.warn(`User not found: ${email}`);
      return new Response(
        JSON.stringify({ error: `User with email "${email}" not found in system` }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Found user: ${user.id} (${user.email})`);

    // Update user password
    const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
      password: new_password,
    });

    if (error) {
      console.error('Error updating password:', error.message);
      return new Response(
        JSON.stringify({ error: `Failed to reset password: ${error.message}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Password reset successfully for: ${email} (${user.id})`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Password reset successfully for ${email}`,
        user_id: user.id,
        email: user.email,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Unexpected error in reset-customer-password:', err);
    return new Response(
      JSON.stringify({
        error: 'Unexpected server error',
        details: String(err),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
