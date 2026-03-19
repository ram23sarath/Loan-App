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

const json = (payload, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const resolveCallerIdentity = async (req, supabase) => {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  const bearerPrefix = 'Bearer ';
  if (!authHeader.startsWith(bearerPrefix)) {
    return { response: json({ error: 'Unauthorized' }, 401) };
  }

  const token = authHeader.slice(bearerPrefix.length).trim();
  if (!token) {
    return { response: json({ error: 'Unauthorized' }, 401) };
  }

  const {
    data: { user: callerUser },
    error: callerError,
  } = await supabase.auth.getUser(token);

  if (callerError || !callerUser) {
    return { response: json({ error: 'Unauthorized' }, 401) };
  }

  const { data: superAdminRow, error: superAdminLookupError } = await supabase
    .from('super_admins')
    .select('user_id')
    .eq('user_id', callerUser.id)
    .maybeSingle();

  if (superAdminLookupError) {
    console.error('[reset-customer-password] Failed checking super_admins lookup', superAdminLookupError);
    return { response: json({ error: 'Authorization check failed' }, 500) };
  }

  if (!superAdminRow?.user_id) {
    return { response: json({ error: 'Forbidden' }, 403) };
  }

  return {
    callerAdminUid: callerUser.id,
    callerName:
      callerUser.user_metadata?.name ||
      callerUser.app_metadata?.name ||
      callerUser.email?.split('@')[0] ||
      callerUser.id,
    callerEmail: callerUser.email || null,
  };
};

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
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const callerIdentity = await resolveCallerIdentity(req, supabase);
    if (callerIdentity.response) {
      return callerIdentity.response;
    }

    const { callerAdminUid, callerName, callerEmail } = callerIdentity;

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

    console.log(`🔐 Attempting to reset password for: ${email}`);

    // Search for user with matching email using pagination
    let user;
    let page = 1;
    let hasMore = true;
    const PAGE_SIZE = 50; // Use default page size to be safe

    // Normalize target email for comparison
    const targetEmail = email.trim().toLowerCase();

    // Loop through all users until we find a match or run out of pages
    while (hasMore && !user) {
      console.log(`📄 Fetching page ${page} (size ${PAGE_SIZE})...`);

      const { data, error: listError } = await supabase.auth.admin.listUsers({
        perPage: PAGE_SIZE,
        page: page,
      });

      if (listError) {
        console.error('❌ Error listing users:', listError.message);
        return new Response(
          JSON.stringify({ error: `Failed to access users: ${listError.message}` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const usersList = data?.users || [];
      console.log(`   - Retrieved ${usersList.length} users in this page.`);

      // Strict matching on email
      user = usersList.find(u => u.email?.trim().toLowerCase() === targetEmail);

      if (user) {
        console.log(`✅ Direct match found on page ${page}: ${user.id}`);
      }

      // If strict match failed, try phone matching fallback if the email looks like a phone number + @gmail.com
      if (!user && targetEmail.endsWith('@gmail.com')) {
        const potentialPhone = targetEmail.split('@')[0];
        // Check if it's all digits and valid length
        if (/^\d{10,15}$/.test(potentialPhone)) {
          console.log(`   - Attempting phone fallback check for: "${potentialPhone}"`);
          const phoneMatch = usersList.find(u => u.phone === potentialPhone);
          if (phoneMatch) {
            console.log(`✅ Found user by phone fallback on page ${page}: ${phoneMatch.id} (Email: ${phoneMatch.email})`);
            user = phoneMatch;
          }
        }
      }

      if (!user) {
        // If we got fewer users than requested, we've reached the end
        if (usersList.length < PAGE_SIZE) {
          console.log(`   - End of list reached (Page ${page} had < ${PAGE_SIZE} items).`);
          hasMore = false;
        } else {
          page++;
        }
      }
    }

    if (!user) {
      console.warn(`User not found: ${email} (scanned ${page} pages)`);
      return new Response(
        JSON.stringify({
          error: `User with email "${email}" not found in system.`,
          details: `Scanned ${page} pages of users. Verified exact match and phone fallback. Please ask developer to check if user is orphaned.`
        }),
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

    const { error: auditError } = await supabase.from('admin_audit_log').insert({
      admin_uid: callerAdminUid,
      action: 'password_reset',
      entity_type: 'auth_user',
      entity_id: user.id,
      metadata: {
        source: 'reset-customer-password',
        target_email: user.email,
        actor_name: callerName,
        actor_email: callerEmail,
      },
    });

    if (auditError) {
      console.error('[AuditLog] Failed to write password reset audit entry:', auditError.message);
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
