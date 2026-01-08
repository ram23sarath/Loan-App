import { createClient } from '@supabase/supabase-js';

/**
 * Netlify Function: Create Supabase user from customer
 * 
 * Called when a new customer is added to the database.
 * Creates a Supabase auth user with:
 * - Email: {phone}@gmail.com
 * - Password: {phone} (customer's phone number)
 * 
 * Environment variables required:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY (for admin access)
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async (req, context) => {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Validate environment variables
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('❌ Missing required environment variables');
    console.error('  - SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗');
    console.error('  - SUPABASE_SERVICE_ROLE_KEY:', SERVICE_ROLE_KEY ? '✓' : '✗');
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Parse request body
    const { customer_id, name, phone } = await req.json();

    // Validate input
    if (!customer_id || !name || !phone) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: customer_id, name, phone',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate phone format (10 digits)
    if (!/^\d{10}$/.test(phone)) {
      return new Response(
        JSON.stringify({
          error: 'Invalid phone number format. Must be exactly 10 digits.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📝 Creating user for customer: ${name} (${phone})`);

    // Create admin client with service role key
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Create the Supabase auth user
    const email = `${phone}@gmail.com`;
    const password = phone; // Use phone as password

    const { data: userData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        name,
        phone,
        customer_id,
      },
    });

    if (createError) {
      console.error('❌ Error creating user:', createError.message);
      return new Response(
        JSON.stringify({
          error: `Failed to create user: ${createError.message}`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!userData.user) {
      throw new Error('User creation returned no user data');
    }

    const userId = userData.user.id;
    console.log(`✅ User created: ${userId}`);

    // Update customer with user_id
    const { error: updateError } = await supabase
      .from('customers')
      .update({ user_id: userId })
      .eq('id', customer_id);

    if (updateError) {
      console.error('❌ Error updating customer:', updateError.message);
      // Even if update fails, user was created, so report success
      console.warn(
        `⚠️  User created but customer update failed. Manual update may be needed.`
      );
    }

    console.log(`✅ Customer updated with user_id: ${userId}`);

    // Create system notification
    const { error: notifyError } = await supabase
      .from('system_notifications')
      .insert({
        type: 'user_created',
        status: 'success',
        message: `User account for ${name} created`,
        metadata: { customer_id, user_id: userId }
      });

    if (notifyError) {
      console.error('❌ Error creating notification:', notifyError.message);
      // Don't fail the request if notification fails
    } else {
      console.log('✅ System notification created');
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'User created successfully',
        user_id: userId,
        email,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    return new Response(
      JSON.stringify({
        error: 'An unexpected error occurred',
        details: error.message,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
