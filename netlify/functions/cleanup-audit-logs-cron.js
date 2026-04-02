import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const json = (payload, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export default async (req) => {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json({ error: 'Server configuration error' }, 500);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const { data, error } = await supabase
      .from('admin_audit_log')
      .delete()
      .lt('created_at', thirtyDaysAgo)
      .select('id');

    if (error) {
      console.error('[cleanup-audit-logs-cron] Failed cleanup', error);
      return json({ error: 'Failed to clean up audit logs' }, 500);
    }

    return json({
      success: true,
      deleted: (data || []).length,
      cutoff: thirtyDaysAgo,
    });
  } catch (cleanupError) {
    console.error('[cleanup-audit-logs-cron] Unexpected error', cleanupError);
    return json({ error: 'Unexpected server error' }, 500);
  }
};
