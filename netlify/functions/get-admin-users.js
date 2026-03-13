import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPER_ADMIN_UID = (process.env.SUPER_ADMIN_UID || '').trim();

const json = (payload, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const getDisplayName = (user) =>
  String(
    user?.user_metadata?.name ||
      user?.app_metadata?.name ||
      user?.email ||
      user?.id ||
      'Unknown',
  );

const getUserRole = (user, superAdminUidSet) => {
  const role = String(user?.app_metadata?.role || '').toLowerCase();
  const isAdminFlag = Boolean(
    user?.app_metadata?.is_admin ?? user?.user_metadata?.is_admin,
  );
  const isSuperAdmin = role === 'super_admin' || superAdminUidSet.has(user.id);
  if (isSuperAdmin) return 'super_admin';
  if (role === 'admin' || isAdminFlag) return 'admin';
  return null;
};

export default async (req) => {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !SUPER_ADMIN_UID) {
    console.error('[get-admin-users] Missing required server configuration', {
      hasSupabaseUrl: Boolean(SUPABASE_URL),
      hasServiceRole: Boolean(SERVICE_ROLE_KEY),
      hasSuperAdminUid: Boolean(SUPER_ADMIN_UID),
    });
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

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !userData?.user) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const requestUser = userData.user;
    const role = String(requestUser.app_metadata?.role || '').toLowerCase();
    const isSuperAdminByRole = role === 'super_admin';
    const isSuperAdminByUid = requestUser.id === SUPER_ADMIN_UID;

    const { data: superAdminRow, error: superAdminLookupError } = await supabase
      .from('super_admins')
      .select('user_id')
      .eq('user_id', requestUser.id)
      .maybeSingle();

    if (superAdminLookupError) {
      return json({ error: 'Authorization check failed' }, 500);
    }

    const isSuperAdminByLookup = Boolean(superAdminRow?.user_id);
    const isSuperAdmin = isSuperAdminByUid || isSuperAdminByRole || isSuperAdminByLookup;

    if (!isSuperAdmin) {
      return json({ error: 'Forbidden' }, 403);
    }

    const { data: superAdminRows, error: superAdminRowsError } = await supabase
      .from('super_admins')
      .select('user_id');

    if (superAdminRowsError) {
      return json({ error: 'Failed to load super-admin directory' }, 500);
    }

    const superAdminUidSet = new Set(
      [
        SUPER_ADMIN_UID,
        ...(superAdminRows || []).map((row) => row.user_id).filter(Boolean),
      ].filter(Boolean),
    );

    let allUsers = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({
        page,
        perPage,
      });

      if (error) {
        return json({ error: 'Failed to list auth users' }, 500);
      }

      const users = data?.users || [];
      allUsers = allUsers.concat(users);

      if (users.length < perPage) break;
      page += 1;
    }

    const admins = allUsers
      .map((user) => {
        const userRole = getUserRole(user, superAdminUidSet);
        if (!userRole) return null;

        return {
          uid: user.id,
          name: getDisplayName(user),
          email: String(user.email || ''),
          role: userRole,
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (a.role !== b.role) {
          return a.role === 'super_admin' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

    return json({
      success: true,
      is_super_admin: true,
      super_admin_uid: SUPER_ADMIN_UID,
      admins,
    });
  } catch (error) {
    console.error('[get-admin-users] Unexpected server error', error);
    return json({ error: 'Unexpected server error' }, 500);
  }
};
