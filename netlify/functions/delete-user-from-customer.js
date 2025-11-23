import { createClient } from '@supabase/supabase-js';

/**
 * Netlify Function: Delete Supabase auth user for a customer
 *
 * Called when a customer is deleted from the database. This function will
 * remove the corresponding auth user (if present) using the Supabase Service
 * Role Key. It accepts POST requests with JSON body:
 *  { customer_id: string, user_id: string }
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
    return new Response(JSON.stringify({ error: 'Server configuration error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const { customer_id, user_id } = await req.json();

    if (!customer_id || !user_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields: customer_id and user_id' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    console.log(`🗑️  Deleting auth user ${user_id} for customer ${customer_id}`);

    // Call deleteUser - SDK may accept the id directly
    const { data, error } = await supabase.auth.admin.deleteUser(user_id);
    if (error) {
      console.error('Error deleting auth user:', error.message || error);
      return new Response(JSON.stringify({ error: `Failed to delete auth user: ${error.message || error}` }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    console.log(`✅ Auth user deleted: ${user_id}`);

    return new Response(JSON.stringify({ success: true, user_id }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('Unexpected error in delete-user-from-customer:', err);
    return new Response(JSON.stringify({ error: 'Unexpected server error', details: String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
