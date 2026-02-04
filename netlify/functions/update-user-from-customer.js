import { createClient } from '@supabase/supabase-js';

/**
 * Netlify Function: Update Auth User From Customer
 *
 * Updates a Supabase auth user's email and password to match a customer's phone.
 * If the customer has no `user_id`, this will create a new auth user and link it.
 *
 * POST body: { customer_id: string, phone: string }
 * Environment variables required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed. Use POST.', { status: 405 });
  }

  const authHeader = req.headers.get('authorization');
  const adminKeyHeader = req.headers.get('x-admin-api-key');
  const providedKey = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : authHeader?.trim();

  if (!ADMIN_API_KEY || (providedKey !== ADMIN_API_KEY && adminKeyHeader !== ADMIN_API_KEY)) {
    console.warn('Unauthorized update-user-from-customer attempt', {
      hasAuthorizationHeader: Boolean(authHeader),
      hasAdminKeyHeader: Boolean(adminKeyHeader),
    });
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Missing Supabase configuration');
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { customer_id, phone } = await req.json();

    if (!customer_id || !phone) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: customer_id and phone' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!/^\d{10}$/.test(phone)) {
      return new Response(
        JSON.stringify({ error: 'Invalid phone number. Expect exactly 10 digits.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Fetch customer
    const { data: customer, error: custErr } = await supabase
      .from('customers')
      .select('id, name, phone, user_id')
      .eq('id', customer_id)
      .single();

    if (custErr) throw custErr;
    if (!customer) {
      return new Response(
        JSON.stringify({ error: 'Customer not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const expectedEmail = `${phone}@gmail.com`;
    const expectedPassword = phone;

    // If no linked user, create one and update customer.user_id
    if (!customer.user_id) {
      const { data: userData, error: createErr } = await supabase.auth.admin.createUser({
        email: expectedEmail,
        password: expectedPassword,
        email_confirm: true,
        user_metadata: { name: customer.name || '', phone, customer_id },
      });

      if (createErr) {
        console.error('Error creating auth user:', createErr.message);
        return new Response(
          JSON.stringify({ error: `Failed to create auth user: ${createErr.message}` }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const newUserId = userData?.user?.id;
      if (!newUserId) {
        return new Response(
          JSON.stringify({ error: 'Auth user created but no id returned' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const { error: updErr } = await supabase
        .from('customers')
        .update({ user_id: newUserId })
        .eq('id', customer_id);

      if (updErr) {
        console.error('Created user but failed to update customer.user_id:', updErr.message);
        try {
          const { error: deleteErr } = await supabase.auth.admin.deleteUser(newUserId);
          if (deleteErr) {
            console.error('Rollback failed to delete auth user:', deleteErr.message);
          }
        } catch (deleteErr) {
          console.error('Rollback exception deleting auth user:', deleteErr.message || deleteErr);
        }

        return new Response(
          JSON.stringify({ error: 'Failed to link user_id to customer. Rolled back auth user.' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, created: true, user_id: newUserId, email: expectedEmail }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // If we have a user_id, attempt to update the existing auth user
    try {
      const { error: updateErr } = await supabase.auth.admin.updateUserById(customer.user_id, {
        email: expectedEmail,
        password: expectedPassword,
        email_confirm: true,
      });

      if (updateErr) {
        throw updateErr;
      }

      return new Response(
        JSON.stringify({ success: true, updated: true, user_id: customer.user_id, email: expectedEmail }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (err) {
      const errMessage = err?.message || String(err);
      const errStatus = err?.status;
      const errCode = err?.code;
      const isNotFound =
        errStatus === 404 ||
        errCode === 'user_not_found' ||
        /not found/i.test(errMessage);

      if (!isNotFound) {
        console.error('Update user error, not recreating:', errMessage);
        return new Response(
          JSON.stringify({ error: 'Failed to update auth user', details: errMessage }),
          { status: errStatus || 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // If update failed because user not found, just silently skip - this is normal
      // The customer has a user_id but the auth user was deleted or doesn't exist
      console.warn(`User ${customer.user_id} linked to customer but auth user not found - recreating...`);
      
      try {
        const { data: userData, error: createErr } = await supabase.auth.admin.createUser({
          email: expectedEmail,
          password: expectedPassword,
          email_confirm: true,
          user_metadata: { name: customer.name || '', phone, customer_id },
        });

        if (createErr) {
          console.error('Failed to recreate auth user:', createErr.message);
          return new Response(
            JSON.stringify({ error: 'Failed to update or recreate auth user', details: createErr.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          );
        }

        const newUserId = userData?.user?.id;
        if (!newUserId) {
          return new Response(
            JSON.stringify({ error: 'Recreated user but no id returned' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          );
        }

        // Update customer.user_id to new user if different
        if (newUserId !== customer.user_id) {
          const { error: linkErr } = await supabase.from('customers').update({ user_id: newUserId }).eq('id', customer_id);
          if (linkErr) {
            console.error('Recreated user but failed linking to customer:', linkErr.message);
          }
        }

        return new Response(
          JSON.stringify({ success: true, recreated: true, user_id: newUserId, email: expectedEmail }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      } catch (recreateErr) {
        console.error('Exception recreating user:', recreateErr.message || recreateErr);
        return new Response(
          JSON.stringify({ error: 'Failed to recreate auth user', details: String(recreateErr) }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
  } catch (error) {
    console.error('Error in update-user-from-customer:', error.message || error);
    return new Response(
      JSON.stringify({ error: 'Failed to update user', details: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
