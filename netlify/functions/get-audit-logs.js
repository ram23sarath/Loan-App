import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPER_ADMIN_UID = (process.env.SUPER_ADMIN_UID || '').trim();

const json = (payload, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const sanitizeForIlike = (input) =>
  input
    .replace(/[.,%()*:;{}\[\]"'`\\|<>!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);

const parseParams = async (req) => {
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      return body && typeof body === 'object' ? body : {};
    } catch {
      return {};
    }
  }

  const url = new URL(req.url);
  return {
    page: url.searchParams.get('page') || '1',
    page_size: url.searchParams.get('page_size') || '20',
    action: url.searchParams.get('action') || '',
    entity_type: url.searchParams.get('entity_type') || '',
    from_date: url.searchParams.get('from_date') || '',
    to_date: url.searchParams.get('to_date') || '',
    search: url.searchParams.get('search') || '',
  };
};

export default async (req) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !SUPER_ADMIN_UID) {
    console.error('[get-audit-logs] Missing required server configuration', {
      hasSupabaseUrl: Boolean(SUPABASE_URL),
      hasServiceRole: Boolean(SERVICE_ROLE_KEY),
      hasSuperAdminUid: Boolean(SUPER_ADMIN_UID),
    });
    return json({ error: 'Server configuration error' }, 500);
  }

  const params = await parseParams(req);
  const authHeader = req.headers.get('authorization') || '';
  const bearerPrefix = 'Bearer ';
  if (!authHeader.startsWith(bearerPrefix)) {
    return json({ error: 'Unauthorized' }, 401);
  }
  const accessToken = authHeader.slice(bearerPrefix.length).trim();
  if (!accessToken) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const page = Math.max(1, Number.parseInt(String(params.page || '1'), 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number.parseInt(String(params.page_size || '20'), 10) || 20),
  );

  const action = String(params.action || '').trim();
  const entityType = String(params.entity_type || '').trim();
  const fromDate = String(params.from_date || '').trim();
  const toDate = String(params.to_date || '').trim();
  const safeSearch = sanitizeForIlike(String(params.search || ''));

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !userData?.user) {
      console.error('[get-audit-logs] Token validation failed', userError);
      return json({ error: 'Unauthorized' }, 401);
    }

    const user = userData.user;
    const role = String(user.app_metadata?.role || '').toLowerCase();
    const isSuperAdminByRole = role === 'super_admin';
    const isSuperAdminByUid = user.id === SUPER_ADMIN_UID;

    const { data: superAdminRow, error: superAdminLookupError } = await supabase
      .from('super_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (superAdminLookupError) {
      console.error('[get-audit-logs] Failed checking super_admins lookup', superAdminLookupError);
      return json({ error: 'Authorization check failed' }, 500);
    }

    const isSuperAdminByLookup = Boolean(superAdminRow?.user_id);
    const isSuperAdmin = isSuperAdminByUid || isSuperAdminByRole || isSuperAdminByLookup;

    if (!isSuperAdmin) {
      return json({ error: 'Forbidden' }, 403);
    }

    let query = supabase
      .from('admin_audit_log')
      .select('*', { count: 'exact' });

    if (action) query = query.eq('action', action);
    if (entityType) query = query.eq('entity_type', entityType);
    if (fromDate) query = query.gte('created_at', fromDate);
    if (toDate) query = query.lte('created_at', `${toDate}T23:59:59.999Z`);
    if (safeSearch) {
      query = query.or(
        `entity_id.ilike.%${safeSearch}%,action.ilike.%${safeSearch}%,entity_type.ilike.%${safeSearch}%`,
      );
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('[get-audit-logs] Failed to fetch audit logs', error);
      return json({ error: 'Failed to fetch audit logs' }, 500);
    }

    const entries = data || [];
    const total = count || 0;
    const totalPages = total > 0 ? Math.ceil(total / pageSize) : 1;

    const { data: adminRows } = await supabase
      .from('admin_audit_log')
      .select('admin_uid')
      .order('created_at', { ascending: false })
      .limit(2000);

    const adminUids = Array.from(
      new Set((adminRows || []).map((item) => item.admin_uid).filter(Boolean)),
    );

    return json({
      success: true,
      is_super_admin: true,
      super_admin_uid: SUPER_ADMIN_UID,
      entries,
      admins: [SUPER_ADMIN_UID, ...adminUids.filter((uid) => uid !== SUPER_ADMIN_UID)],
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (error) {
    console.error('[get-audit-logs] Unexpected server error', error);
    return json(
      {
        error: 'Unexpected server error',
      },
      500,
    );
  }
};