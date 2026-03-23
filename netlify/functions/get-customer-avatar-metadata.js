import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (value) => UUID_REGEX.test(String(value || '').trim());

const resolveRequestUrl = (req) => {
  try {
    return new URL(req.url);
  } catch {
    // Some local runtimes provide a relative req.url; fallback keeps parsing stable.
    return new URL(req.url, 'http://localhost');
  }
};

const json = (payload, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const isAdminLikeUser = (user) => {
  const role = String(user?.app_metadata?.role || '').toLowerCase();
  if (role === 'admin' || role === 'super_admin') return true;

  return Boolean(
    user?.app_metadata?.is_admin === true ||
      user?.user_metadata?.is_admin === true,
  );
};

const getMetadataValue = (metadata, key) => {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

export default async (req) => {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('[get-customer-avatar-metadata] Missing required server configuration');
    return json({ error: 'Server configuration error' }, 500);
  }

  const authHeader = req.headers.get('authorization') || '';
  const bearerPrefix = 'Bearer ';
  if (!authHeader.startsWith(bearerPrefix)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const accessToken = authHeader.slice(bearerPrefix.length).trim();
  if (!accessToken) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const requestUrl = resolveRequestUrl(req);
  const customerUserId = String(
    requestUrl.searchParams.get('customer_user_id') || '',
  ).trim();

  if (!customerUserId || !isUuid(customerUserId)) {
    return json({ error: 'Invalid customer_user_id' }, 400);
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: callerData, error: callerError } = await supabase.auth.getUser(accessToken);
    if (callerError || !callerData?.user) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const caller = callerData.user;
    const isSelfRequest = caller.id === customerUserId;
    let isSuperAdminByLookup = false;
    if (!isSelfRequest) {
      const { data: superAdminRow, error: superAdminLookupError } = await supabase
        .from('super_admins')
        .select('user_id')
        .eq('user_id', caller.id)
        .maybeSingle();

      if (superAdminLookupError) {
        console.error(
          '[get-customer-avatar-metadata] Failed checking super_admins lookup',
          superAdminLookupError,
        );
        return json({ error: 'Authorization check failed' }, 500);
      }

      isSuperAdminByLookup = Boolean(superAdminRow?.user_id);
    }

    if (!isSelfRequest && !isAdminLikeUser(caller) && !isSuperAdminByLookup) {
      return json({ error: 'Forbidden' }, 403);
    }

    const { data: targetData, error: targetError } = await supabase.auth.admin.getUserById(customerUserId);

    if (targetError || !targetData?.user) {
      return json({
        success: true,
        avatarPath: null,
        avatarUpdatedAt: null,
      });
    }

    const metadata =
      targetData.user.user_metadata && typeof targetData.user.user_metadata === 'object'
        ? targetData.user.user_metadata
        : {};

    return json({
      success: true,
      avatarPath: getMetadataValue(metadata, 'avatar_path'),
      avatarUpdatedAt: getMetadataValue(metadata, 'avatar_updated_at'),
    });
  } catch (error) {
    console.error('[get-customer-avatar-metadata] Unexpected server error', error);
    return json({ error: 'Unexpected server error' }, 500);
  }
};
