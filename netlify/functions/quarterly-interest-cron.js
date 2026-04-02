import { createClient } from '@supabase/supabase-js';
import { NOTIFICATION_TYPES, NOTIFICATION_STATUSES } from '../../shared/notificationSchema.js';

/**
 * Netlify Scheduled Function: Quarterly Interest Calculation
 * 
 * Runs at 00:00 IST on the 2nd of each FY quarter start month (equivalent to 18:30 UTC on the 1st):
 *   - April 2   (Q1: Apr–Jun)
 *   - July 2    (Q2: Jul–Sep)
 *   - October 2 (Q3: Oct–Dec)
 *   - January 2 (Q4: Jan–Mar)
 * 
 * Applies 3% interest on each customer's subscription total.
 * Idempotent — safe to re-run; the DB function skips already-processed quarters.
 * 
 * Environment variables required:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - SUPER_ADMIN_UID (recommended for audit attribution)
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
  const adminUid = normalizeAuditUuid(payload.admin_uid);
  if (!adminUid) {
    console.warn('[AuditLog] Skipped quarterly-interest audit write: invalid admin_uid');
    return;
  }

  const entityId = normalizeAuditUuid(payload.entity_id);

  const { error } = await supabase.from('admin_audit_log').insert({
    admin_uid: adminUid,
    action: payload.action,
    entity_type: payload.entity_type,
    entity_id: entityId,
    metadata: redactAuditObject(payload.metadata),
  });
  if (error) {
    console.error('[AuditLog] Failed to write quarterly-interest audit log:', error.message || error);
  }
};

/**
 * Get financial year quarter boundaries for a given date.
 * FY quarters: Apr-Jun, Jul-Sep, Oct-Dec, Jan-Mar
 */
function getFYQuarter(date) {
  const month = date.getMonth() + 1; // 1-12
  const year = date.getFullYear();

  if (month >= 4 && month <= 6) {
    return { label: 'Q1', start: `${year}-04-01`, end: `${year}-06-30` };
  } else if (month >= 7 && month <= 9) {
    return { label: 'Q2', start: `${year}-07-01`, end: `${year}-09-30` };
  } else if (month >= 10 && month <= 12) {
    return { label: 'Q3', start: `${year}-10-01`, end: `${year}-12-31` };
  } else {
    // Jan-Mar belongs to previous FY
    return { label: 'Q4', start: `${year}-01-01`, end: `${year}-03-31` };
  }
}

export default async (req) => {
  console.log('🕐 Quarterly Interest Cron triggered at', new Date().toISOString());

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const now = new Date();
  const quarter = getFYQuarter(now);
  console.log(`📅 Current FY Quarter: ${quarter.label} (${quarter.start} → ${quarter.end})`);

  try {
    console.log('👥 Processing all active customers in bulk...');

    const { data, error } = await supabase.rpc(
      'apply_quarterly_interest_for_all_customers',
      { p_admin_uid: SUPER_ADMIN_UID || null }
    );

    if (error) throw error;
    if (!data) {
      throw new Error('Bulk quarterly interest RPC returned no data');
    }
    if (data.status === 'error') {
      throw new Error(data.error || 'Bulk quarterly interest RPC reported an error');
    }

    const results = {
      success: Number(data?.totals?.success || 0),
      skipped: Number(data?.totals?.skipped || 0),
      errors: Number(data?.totals?.errors || 0),
      details: Array.isArray(data?.details) ? data.details : [],
    };

    if (results.details.length === 0) {
      console.log('ℹ️ No active customers found. Nothing to do.');
      return new Response(JSON.stringify({ status: 'no_customers' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`👥 Processed ${results.details.length} customers in bulk.`);

    console.log('');
    console.log('📊 Summary:');
    console.log(`   ✅ Success: ${results.success}`);
    console.log(`   ⏭️  Skipped: ${results.skipped}`);
    console.log(`   ❌ Errors:  ${results.errors}`);
    console.log(`   📅 Quarter: ${quarter.label} (${quarter.start} → ${quarter.end})`);

    // Create a system notification so admins see the result in the notification panel
    try {
      const totalInterest = results.details
        .filter(d => d.status === 'success')
        .reduce((sum, d) => sum + (d.interest_charged || 0), 0);

      const fyYear = quarter.label === 'Q4'
        ? `${now.getFullYear() - 1}-${String(now.getFullYear()).slice(2)}`
        : `${now.getFullYear()}-${String(now.getFullYear() + 1).slice(2)}`;

      const successfulCustomers = results.details
        .filter((d) => d.status === 'success')
        .map((d) => ({
          id: d.id,
          name: d.name,
          interest_charged: d.interest_charged || 0,
          subscription_total: d.subscription_total || 0,
        }));

      const skippedCustomers = results.details
        .filter((d) => d.status === 'skipped')
        .map((d) => ({
          id: d.id,
          name: d.name,
          reason: d.reason || 'Skipped',
        }));

      const errorCustomers = results.details
        .filter((d) => d.status === 'error')
        .map((d) => ({
          id: d.id,
          name: d.name,
          error: d.error || 'Unknown error',
        }));

      const sampleSize = 5;
      const sampledCustomers = {
        success: successfulCustomers.slice(0, sampleSize),
        skipped: skippedCustomers.slice(0, sampleSize),
        errors: errorCustomers.slice(0, sampleSize),
      };

      let message, status;
      if (results.errors > 0) {
        status = NOTIFICATION_STATUSES.WARNING;
        message = `⚠️ Quarterly Interest (${quarter.label} FY ${fyYear}): ${results.success} customers charged ₹${totalInterest.toLocaleString('en-IN')}, ${results.skipped} skipped, ${results.errors} errors`;
      } else if (results.success === 0) {
        status = NOTIFICATION_STATUSES.PENDING;
        message = `ℹ️ Quarterly Interest (${quarter.label} FY ${fyYear}): No new interest applied — ${results.skipped} customers skipped (already processed or no subscriptions)`;
      } else {
        status = NOTIFICATION_STATUSES.SUCCESS;
        message = `✅ Quarterly Interest (${quarter.label} FY ${fyYear}): ₹${totalInterest.toLocaleString('en-IN')} charged across ${results.success} customers (${results.skipped} skipped)`;
      }

      await supabase.from('system_notifications').insert([{
        type: NOTIFICATION_TYPES.QUARTERLY_INTEREST,
        status,
        message,
        metadata: {
          source: 'quarterly-interest-cron',
          quarter: quarter.label,
          fy: fyYear,
          period_start: quarter.start,
          period_end: quarter.end,
          total_interest: totalInterest,
          success_count: results.success,
          skipped_count: results.skipped,
          error_count: results.errors,
          total_customers_processed: results.details.length,
          sampled_customers: sampledCustomers,
          top_errors: errorCustomers.slice(0, sampleSize).map((c) => c.error),
        },
      }]);
      console.log('🔔 Notification created in system_notifications');
    } catch (notifErr) {
      console.error('⚠️ Failed to create notification (non-blocking):', notifErr.message);
    }

    return new Response(JSON.stringify({
      status: 'completed',
      quarter,
      timestamp: now.toISOString(),
      totals: { success: results.success, skipped: results.skipped, errors: results.errors },
      details: results.details,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('💥 Fatal error in quarterly interest cron:', err);

    // Notify admins about the failure
    try {
      const supabaseForNotif = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      await logAuditEvent(supabaseForNotif, {
        admin_uid: SUPER_ADMIN_UID,
        action: 'update',
        entity_type: 'quarterly_interest_run',
        entity_id: null,
        metadata: {
          source: 'quarterly-interest-cron',
          actor_name: 'System Cron',
          actor_email: 'system-cron@internal',
          status: 'fatal_error',
          error: err.message || String(err),
          timestamp: new Date().toISOString(),
        },
      });

      await supabaseForNotif.from('system_notifications').insert([{
        type: NOTIFICATION_TYPES.QUARTERLY_INTEREST,
        status: NOTIFICATION_STATUSES.ERROR,
        message: `❌ Quarterly Interest Cron Failed: ${err.message}`,
        metadata: { source: 'quarterly-interest-cron', error: err.message },
      }]);
    } catch (_) { /* best-effort */ }

    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// Netlify scheduled function config
// Runs at 00:00 IST on the 2nd of each FY quarter month (18:30 UTC on the 1st)
// April 2, July 2, October 2, January 2
export const config = {
  schedule: "30 18 1 1,4,7,10 *",
};