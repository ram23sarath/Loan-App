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
    .replace(/[%]/g, '')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);

const parseBooleanParam = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
};

const isAdminLikeUser = (user) => {
  const role = String(user?.app_metadata?.role || '').toLowerCase();
  if (role === 'admin' || role === 'super_admin') return true;

  return Boolean(
    user?.app_metadata?.is_admin === true ||
      user?.user_metadata?.is_admin === true,
  );
};

const getAdminDisplayName = (user) =>
  String(
    user?.user_metadata?.name ||
      user?.app_metadata?.name ||
      user?.email ||
      user?.id ||
      'Unknown Admin',
  );

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (value) => UUID_REGEX.test(String(value || '').trim());

const listAllAuthAdmins = async (supabase) => {
  const directory = {};
  const uids = [];

  const perPage = 100;
  let page = 1;
  const maxPages = 50;

  while (page <= maxPages) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.warn('[get-audit-logs] Failed listing auth users for include_all_admins', error);
      break;
    }

    const users = data?.users || [];
    users.forEach((user) => {
      if (!isAdminLikeUser(user) || !user?.id) return;
      directory[user.id] = getAdminDisplayName(user);
      uids.push(user.id);
    });

    if (users.length < perPage) break;
    page += 1;
  }

  return {
    uids: Array.from(new Set(uids)),
    directory,
  };
};

const getEntryMetadata = (entry) => {
  const metadata = entry?.metadata;
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return metadata;
  }
  return {};
};

const getEntityKey = (entityType, entityId) => `${entityType}:${entityId}`;

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
  const includeAllAdmins = parseBooleanParam(params.include_all_admins);

  const safeSearch = sanitizeForIlike(String(params.search || ''));
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

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

    query = query.gte('created_at', thirtyDaysAgo);

    if (safeSearch) {
      const searchFilters = [
        `metadata->>actor_name.ilike.%${safeSearch}%`,
        `metadata->>actor_email.ilike.%${safeSearch}%`,
      ];

      // admin_uid is uuid-typed, so use eq only for valid UUID inputs.
      if (isUuid(safeSearch)) {
        searchFilters.push(`admin_uid.eq.${safeSearch}`);
      }

      query = query.or(searchFilters.join(','));
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

    const customerIds = new Set();
    const loanIds = new Set();
    const subscriptionIds = new Set();
    const installmentIds = new Set();
    const dataEntryIds = new Set();
    const entityToCustomerId = new Map();
    const entityToMetadataCustomerName = {};
    let customerDirectory = {};

    entries.forEach((entry) => {
      const metadata = getEntryMetadata(entry);
      const metadataCustomerId =
        typeof metadata.customer_id === 'string' ? metadata.customer_id : null;
      const metadataCustomerName =
        typeof metadata.customer_name === 'string' ? metadata.customer_name.trim() : '';

      if (entry.entity_type === 'customer' && entry.entity_id) {
        customerIds.add(entry.entity_id);
      }
      if (metadataCustomerId) {
        customerIds.add(metadataCustomerId);
        if (entry.entity_id) {
          const entityKey = getEntityKey(entry.entity_type, entry.entity_id);
          entityToCustomerId.set(entityKey, metadataCustomerId);
          if (metadataCustomerName) {
            entityToMetadataCustomerName[entityKey] = metadataCustomerName;
          }
        }
      }

      if (entry.entity_id && metadataCustomerName) {
        const entityKey = getEntityKey(entry.entity_type, entry.entity_id);
        entityToMetadataCustomerName[entityKey] = metadataCustomerName;
      }

      if (entry.entity_type === 'customer' && entry.entity_id && metadataCustomerName) {
        customerDirectory[entry.entity_id] = metadataCustomerName;
      }

      if (entry.entity_type === 'customer' && entry.entity_id && !metadataCustomerName) {
        const fallbackName =
          typeof metadata.name === 'string' && metadata.name.trim() ? metadata.name.trim() : '';
        if (fallbackName) {
          customerDirectory[entry.entity_id] = fallbackName;
        }
      }

      if (metadataCustomerId && metadataCustomerName) {
        customerDirectory[metadataCustomerId] = metadataCustomerName;
      }

      if (!entry.entity_id) return;
      if (entry.entity_type === 'loan') loanIds.add(entry.entity_id);
      if (entry.entity_type === 'subscription') subscriptionIds.add(entry.entity_id);
      if (entry.entity_type === 'installment') installmentIds.add(entry.entity_id);
      if (entry.entity_type === 'data_entry') dataEntryIds.add(entry.entity_id);
    });

    if (loanIds.size > 0) {
      const { data: loanRows } = await supabase
        .from('loans')
        .select('id, customer_id')
        .in('id', Array.from(loanIds));
      (loanRows || []).forEach((row) => {
        if (row.id && row.customer_id) {
          entityToCustomerId.set(getEntityKey('loan', row.id), row.customer_id);
          customerIds.add(row.customer_id);
        }
      });
    }

    if (subscriptionIds.size > 0) {
      const { data: subRows } = await supabase
        .from('subscriptions')
        .select('id, customer_id')
        .in('id', Array.from(subscriptionIds));
      (subRows || []).forEach((row) => {
        if (row.id && row.customer_id) {
          entityToCustomerId.set(getEntityKey('subscription', row.id), row.customer_id);
          customerIds.add(row.customer_id);
        }
      });
    }

    if (dataEntryIds.size > 0) {
      const { data: dataEntryRows } = await supabase
        .from('data_entries')
        .select('id, customer_id')
        .in('id', Array.from(dataEntryIds));
      (dataEntryRows || []).forEach((row) => {
        if (row.id && row.customer_id) {
          entityToCustomerId.set(getEntityKey('data_entry', row.id), row.customer_id);
          customerIds.add(row.customer_id);
        }
      });
    }

    if (installmentIds.size > 0) {
      const { data: installmentRows } = await supabase
        .from('installments')
        .select('id, loan_id')
        .in('id', Array.from(installmentIds));

      const uniqueLoanIds = Array.from(
        new Set((installmentRows || []).map((row) => row.loan_id).filter(Boolean)),
      );

      if (uniqueLoanIds.length > 0) {
        const { data: installmentLoanRows } = await supabase
          .from('loans')
          .select('id, customer_id')
          .in('id', uniqueLoanIds);

        const loanCustomerMap = new Map();
        (installmentLoanRows || []).forEach((row) => {
          if (row.id && row.customer_id) {
            loanCustomerMap.set(row.id, row.customer_id);
            customerIds.add(row.customer_id);
          }
        });

        (installmentRows || []).forEach((row) => {
          const customerId = loanCustomerMap.get(row.loan_id);
          if (row.id && customerId) {
            entityToCustomerId.set(getEntityKey('installment', row.id), customerId);
          }
        });
      }
    }

    if (customerIds.size > 0) {
      const { data: customerRows } = await supabase
        .from('customers')
        .select('id, name')
        .in('id', Array.from(customerIds));

      customerDirectory = (customerRows || []).reduce((acc, row) => {
        if (row.id && row.name) {
          acc[row.id] = row.name;
        }
        return acc;
      }, customerDirectory);
    }

    const entityCustomerNames = {};
    entityToCustomerId.forEach((customerId, entityKey) => {
      const customerName = customerDirectory[customerId];
      if (customerName) {
        entityCustomerNames[entityKey] = customerName;
        return;
      }
      const metadataName = entityToMetadataCustomerName[entityKey];
      if (metadataName) {
        entityCustomerNames[entityKey] = metadataName;
      }
    });

    Object.entries(entityToMetadataCustomerName).forEach(([entityKey, customerName]) => {
      if (customerName && !entityCustomerNames[entityKey]) {
        entityCustomerNames[entityKey] = customerName;
      }
    });

    const { data: adminRows } = await supabase
      .from('admin_audit_log')
      .select('admin_uid')
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false })
      .limit(2000);

    let adminUids = Array.from(
      new Set((adminRows || []).map((item) => item.admin_uid).filter(Boolean)),
    );

    const adminDirectory = {};
    entries.forEach((entry) => {
      const metadata = getEntryMetadata(entry);
      const actorName =
        typeof metadata.actor_name === 'string' ? metadata.actor_name.trim() : '';
      const actorEmail =
        typeof metadata.actor_email === 'string' ? metadata.actor_email.trim() : '';
      if (!entry.admin_uid) return;
      if (actorName) {
        adminDirectory[entry.admin_uid] = actorName;
        return;
      }
      if (actorEmail && !adminDirectory[entry.admin_uid]) {
        adminDirectory[entry.admin_uid] = actorEmail;
      }
    });
    await Promise.all(
      adminUids.map(async (uid) => {
        try {
          const { data: adminUserData, error: adminUserError } =
            await supabase.auth.admin.getUserById(uid);
          if (adminUserError || !adminUserData?.user) {
            return;
          }
          const user = adminUserData.user;
          const displayName =
            user.user_metadata?.name ||
            user.app_metadata?.name ||
            user.email ||
            uid;
          adminDirectory[uid] = String(displayName);
        } catch (lookupError) {
          console.warn('[get-audit-logs] Admin lookup failed for uid', uid, lookupError);
        }
      }),
    );

    if (includeAllAdmins) {
      const { uids: allAdminUids, directory: allAdminDirectory } = await listAllAuthAdmins(supabase);
      adminUids = Array.from(new Set([...adminUids, ...allAdminUids]));
      Object.entries(allAdminDirectory).forEach(([uid, displayName]) => {
        if (!adminDirectory[uid]) {
          adminDirectory[uid] = displayName;
        }
      });
    }

    return json({
      success: true,
      is_super_admin: true,
      super_admin_uid: SUPER_ADMIN_UID,
      include_all_admins: includeAllAdmins,
      entries,
      admins: [SUPER_ADMIN_UID, ...adminUids.filter((uid) => uid !== SUPER_ADMIN_UID)],
      admin_directory: adminDirectory,
      customer_directory: customerDirectory,
      entity_customer_names: entityCustomerNames,
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