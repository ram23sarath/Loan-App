import { createClient } from '@supabase/supabase-js';

/**
 * Netlify Function: Create Auth User
 * 
 * Creates a Supabase auth user directly with email and password.
 * Can create either admin users or regular (scoped) users.
 *
 * Called via POST request with JSON body:
 *  { email: string, password: string, name?: string, isAdmin?: boolean }
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
    const { email, password, name = '', isAdmin = false } = await req.json();

    // Validate input
    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email and password' }),
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
    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 6 characters' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const userType = isAdmin ? 'Admin' : 'Regular';
    console.log(`👤 Creating ${userType} user: ${email}${name ? ` (${name})` : ''}`);

    // Create the auth user
    const { data: userData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        name: name || '',
        is_admin: isAdmin,
        created_via: 'admin_tools',
        created_at: new Date().toISOString(),
      },
    });

    if (createError) {
      console.error('❌ Error creating user:', createError.message);
      return new Response(
        JSON.stringify({ error: `Failed to create user: ${createError.message}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!userData.user) {
      throw new Error('User creation returned no user data');
    }

    const userId = userData.user.id;
    console.log(`✅ ${userType} user created: ${userId} (${email})`);

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        email: userData.user.email,
        name: name || '',
        is_admin: isAdmin,
        message: `${userType} user created successfully`,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Unexpected error in create-auth-user:', err);
    return new Response(
      JSON.stringify({
        error: 'Unexpected server error',
        details: String(err),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
