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
  *   - CRON_SECRET
  *     - Purpose: Secret used to validate incoming cron requests. When set,
  *       the function expects an `Authorization: Bearer <CRON_SECRET>` header
  *       on incoming requests and will reject requests without a matching
  *       bearer token. Provide a strong secret string (e.g. a long random
  *       token). Required in production to prevent unauthorized executions.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

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

  // Authenticate cron request using secret header.
  // Require a CRON_SECRET in non-development environments so the function fails fast.
  if (process.env.NODE_ENV !== 'development' && !CRON_SECRET) {
    console.error('❌ Unauthorized: Missing CRON_SECRET in non-development environment');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // If a secret is provided, validate the Authorization header.
  // In development, missing CRON_SECRET is allowed (warn and continue).
  if (CRON_SECRET) {
    const authHeader = req.headers.authorization || '';
    const expectedAuth = `Bearer ${CRON_SECRET}`;
    if (authHeader !== expectedAuth) {
      console.error('❌ Unauthorized: Invalid or missing CRON_SECRET');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } else {
    console.warn('⚠️ CRON_SECRET not set; running in development mode, skipping auth check');
  }

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
    // 1. Fetch all active customers
    const { data: customers, error: fetchErr } = await supabase
      .from('customers')
      .select('id, name, phone')
      .is('deleted_at', null);

    if (fetchErr) throw fetchErr;

    if (!customers || customers.length === 0) {
      console.log('ℹ️ No active customers found. Nothing to do.');
      return new Response(JSON.stringify({ status: 'no_customers' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`👥 Processing ${customers.length} customers...`);

    const results = { success: 0, skipped: 0, errors: 0, details: [] };

    // 2. Apply interest for each customer using the DB function
    for (const customer of customers) {
      try {
        const { data, error } = await supabase.rpc(
          'apply_quarterly_interest_for_customer',
          { p_customer_id: customer.id }
        );

        if (error) {
          console.error(`❌ Error for ${customer.name} (${customer.id}):`, error.message);
          results.errors++;
          results.details.push({ id: customer.id, name: customer.name, status: 'error', error: error.message });
          continue;
        }

        const result = data;
        if (result.status === 'success') {
          console.log(`✅ ${customer.name}: ₹${result.interest_charged} interest applied (sub total: ₹${result.subscription_total})`);
          results.success++;
        } else if (result.status === 'skipped') {
          console.log(`⏭️  ${customer.name}: Skipped — ${result.reason}`);
          results.skipped++;
        } else if (result.status === 'error') {
          console.error(`❌ ${customer.name}: ${result.error}`);
          results.errors++;
        }
        results.details.push({ id: customer.id, name: customer.name, ...result });
      } catch (err) {
        console.error(`❌ Exception for ${customer.name}:`, err.message);
        results.errors++;
        results.details.push({ id: customer.id, name: customer.name, status: 'error', error: err.message });
      }
    }

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