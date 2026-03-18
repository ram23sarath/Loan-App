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
const SUPER_ADMIN_UID = (process.env.SUPER_ADMIN_UID || '').trim();

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DEFAULT_AUDIT_REDACTION = {
  redactKeys: ['password', 'passcode', 'token', 'access_token', 'refresh_token', 'ssn', 'credit_card', 'auth0_id'],
  mask: '<REDACTED>',
};

const redactAuditObject = (input, policy = DEFAULT_AUDIT_REDACTION) => {
  if (input === null || input === undefined) return input;
  if (Array.isArray(input)) return input.map((v) => redactAuditObject(v, policy));
  if (typeof input !== 'object') return input;
  const out = {};
  for (const [key, value] of Object.entries(input)) {
    const shouldRedact = policy.redactKeys.some((rk) => rk.toLowerCase() === key.toLowerCase());
    out[key] = shouldRedact ? policy.mask : redactAuditObject(value, policy);
  }
  return out;
};

const normalizeAuditUuid = (value) => {
  if (!value) return null;
  const trimmed = String(value).trim();
  return UUID_REGEX.test(trimmed) ? trimmed : null;
};

const logAuditEvent = async (supabase, payload) => {
  const { error } = await supabase.from('admin_audit_log').insert({
    admin_uid: payload.admin_uid,
    action: payload.action,
    entity_type: payload.entity_type,
    entity_id: payload.entity_id,
    metadata: redactAuditObject(payload.metadata),
  });
  if (error) {
    console.error('[AuditLog] Failed to write audit log:', error.message || error);
  }
};

export default async (req) => {
  const requestId = req.headers.get('x-request-id') || crypto.randomUUID();
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Missing Supabase configuration');
    return new Response(JSON.stringify({ error: 'Server configuration error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const {
      customer_id,
      user_id,
      admin_uid,
      actor_name,
      actor_email,
      customer_name,
    } = await req.json();

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

    const normalizedAdminUid = normalizeAuditUuid(admin_uid) || normalizeAuditUuid(SUPER_ADMIN_UID);
    const normalizedUserId = normalizeAuditUuid(user_id);
    const normalizedCustomerId = normalizeAuditUuid(customer_id);

    if (!normalizedAdminUid) {
      console.warn('[AuditLog] Skipped auth user delete audit log: missing valid admin uid and SUPER_ADMIN_UID fallback');
    } else {
      await logAuditEvent(supabase, {
        admin_uid: normalizedAdminUid,
        action: 'permanent_delete',
        entity_type: 'auth_user',
        entity_id: normalizedUserId,
        metadata: {
          request_id: requestId,
          source: 'delete-user-from-customer',
          customer_id: normalizedCustomerId,
          user_id: normalizedUserId,
          actor_name: typeof actor_name === 'string' && actor_name.trim() ? actor_name.trim() : null,
          actor_email: typeof actor_email === 'string' && actor_email.trim() ? actor_email.trim() : null,
          customer_name: typeof customer_name === 'string' && customer_name.trim() ? customer_name.trim() : null,
          changes: {
            before: {
              customer_id: normalizedCustomerId,
              user_id: normalizedUserId,
            },
            after: {
              customer_id: normalizedCustomerId,
              user_id: null,
            },
          },
          fields_changed: ['user_id'],
        },
      });
    }

    return new Response(JSON.stringify({ success: true, user_id }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('Unexpected error in delete-user-from-customer:', err);
    return new Response(JSON.stringify({ error: 'Unexpected server error', details: String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
