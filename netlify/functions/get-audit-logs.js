import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const json = (payload, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const sanitizeForIlike = (input) =>
  input
    .replace(/[\\%_]/g, '\\$&')
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

const CURSOR_ID_REGEX = /^(\d+|[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;

const requestParamsSchema = z.object({
  page_size: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().default(''),
  include_all_admins: z.preprocess((value) => parseBooleanParam(value), z.boolean().default(false)),
  cursor: z.string().trim().max(500).optional(),
});

const cursorSchema = z.object({
  created_at: z
    .string()
    .trim()
    .refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid datetime'),
  id: z.union([
    z.number().int().nonnegative(),
    z.string().regex(CURSOR_ID_REGEX),
  ]),
});

const decodeCursor = (cursor) => {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    return cursorSchema.safeParse(parsed);
  } catch {
    return { success: false };
  }
};

const encodeCursor = (row) =>
  Buffer.from(
    JSON.stringify({
      created_at: row.created_at,
      id: row.id,
    }),
    'utf8',
  ).toString('base64url');

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

const parseAndValidateParams = async (req) => {
  let rawParams = {};

  if (req.method === 'POST') {
    try {
      const body = await req.json();
      rawParams = body && typeof body === 'object' ? body : {};
    } catch {
      rawParams = {};
    }

    const parsedParams = requestParamsSchema.safeParse(rawParams);
    if (!parsedParams.success) {
      return {
        response: json(
          {
            error: 'Invalid request parameters',
            details: parsedParams.error.flatten(),
          },
          400,
        ),
      };
    }

    const parsedCursor = parsedParams.data.cursor
      ? decodeCursor(parsedParams.data.cursor)
      : null;

    if (parsedParams.data.cursor && !parsedCursor?.success) {
      return { response: json({ error: 'Invalid cursor' }, 400) };
    }

    return {
      params: {
        ...parsedParams.data,
        cursorData: parsedCursor?.success ? parsedCursor.data : null,
      },
    };
  }

  const url = new URL(req.url);
  rawParams = {
    page_size: url.searchParams.get('page_size') || '20',
    search: url.searchParams.get('search') || '',
    include_all_admins: url.searchParams.get('include_all_admins') || 'false',
    cursor: url.searchParams.get('cursor') || undefined,
  };

  const parsedParams = requestParamsSchema.safeParse(rawParams);
  if (!parsedParams.success) {
    return {
      response: json(
        {
          error: 'Invalid request parameters',
          details: parsedParams.error.flatten(),
        },
        400,
      ),
    };
  }

  const parsedCursor = parsedParams.data.cursor
    ? decodeCursor(parsedParams.data.cursor)
    : null;

  if (parsedParams.data.cursor && !parsedCursor?.success) {
    return { response: json({ error: 'Invalid cursor' }, 400) };
  }

  return {
    params: {
      ...parsedParams.data,
      cursorData: parsedCursor?.success ? parsedCursor.data : null,
    },
  };
};

const authenticateUser = async (req, supabase) => {
  const authHeader = req.headers.get('authorization') || '';
  const bearerPrefix = 'Bearer ';
  if (!authHeader.startsWith(bearerPrefix)) {
    return { response: json({ error: 'Unauthorized' }, 401) };
  }

  const accessToken = authHeader.slice(bearerPrefix.length).trim();
  if (!accessToken) {
    return { response: json({ error: 'Unauthorized' }, 401) };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData?.user) {
    console.error('[get-audit-logs] Token validation failed', userError);
    return { response: json({ error: 'Unauthorized' }, 401) };
  }

  return { user: userData.user };
};

const validateSuperAdmin = async (user, supabase) => {
  const { data: superAdminRow, error: superAdminLookupError } = await supabase
    .from('super_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (superAdminLookupError) {
    console.error('[get-audit-logs] Failed checking super_admins lookup', superAdminLookupError);
    return { response: json({ error: 'Authorization check failed' }, 500) };
  }

  if (!superAdminRow?.user_id) {
    return { response: json({ error: 'Forbidden' }, 403) };
  }

  return { isSuperAdmin: true, superAdminUid: user.id };
};

const fetchAuditLogs = async (params, supabase) => {
  const pageSize = params.page_size;
  const includeAllAdmins = params.include_all_admins;
  const safeSearch = sanitizeForIlike(String(params.search || ''));
  const cursorData = params.cursorData;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from('admin_audit_log')
    .select('*')
    .gte('created_at', thirtyDaysAgo);

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

  if (cursorData) {
    query = query.or(
      `created_at.lt.${cursorData.created_at},and(created_at.eq.${cursorData.created_at},id.lt.${cursorData.id})`,
    );
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(0, pageSize);

  if (error) {
    console.error('[get-audit-logs] Failed to fetch audit logs', error);
    return { response: json({ error: 'Failed to fetch audit logs' }, 500) };
  }

  const rows = data || [];
  const hasMore = rows.length > pageSize;
  const entries = hasMore ? rows.slice(0, pageSize) : rows;
  const nextCursor = hasMore ? encodeCursor(entries[entries.length - 1]) : null;

  return {
    entries,
    includeAllAdmins,
    pagination: {
      pageSize,
      hasMore,
      nextCursor,
    },
  };
};

const resolveRelatedEntities = async (entries, supabase) => {
  const customerIds = new Set();
  const loanIds = new Set();
  const subscriptionIds = new Set();
  const installmentIds = new Set();
  const dataEntryIds = new Set();
  let customerDirectory = {};
  const entityCustomerNames = {};

  const getJoinedName = (customersValue) => {
    if (Array.isArray(customersValue)) {
      return typeof customersValue[0]?.name === 'string' ? customersValue[0].name : '';
    }
    return typeof customersValue?.name === 'string' ? customersValue.name : '';
  };

  const setEntityCustomerName = (entityType, entityId, name) => {
    if (!entityId || !name) return;
    entityCustomerNames[getEntityKey(entityType, entityId)] = name;
  };

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
      if (metadataCustomerName) customerDirectory[metadataCustomerId] = metadataCustomerName;
    }

    if (entry.entity_id && metadataCustomerName) {
      setEntityCustomerName(entry.entity_type, entry.entity_id, metadataCustomerName);
    }

    if (entry.entity_type === 'customer' && entry.entity_id && metadataCustomerName) {
      customerDirectory[entry.entity_id] = metadataCustomerName;
    }

    if (entry.entity_type === 'customer' && entry.entity_id && !metadataCustomerName) {
      const fallbackName =
        typeof metadata.name === 'string' && metadata.name.trim() ? metadata.name.trim() : '';
      if (fallbackName) {
        customerDirectory[entry.entity_id] = fallbackName;
        setEntityCustomerName('customer', entry.entity_id, fallbackName);
      }
    }

    if (!entry.entity_id) return;
    if (entry.entity_type === 'loan') loanIds.add(entry.entity_id);
    if (entry.entity_type === 'subscription') subscriptionIds.add(entry.entity_id);
    if (entry.entity_type === 'installment') installmentIds.add(entry.entity_id);
    if (entry.entity_type === 'data_entry') dataEntryIds.add(entry.entity_id);
  });

  const hydrateCustomersByIds = async () => {
    if (customerIds.size === 0) return;

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
  };

  const resolveEntityCustomersWithJoin = async (entityType, tableName, entityIds) => {
    if (entityIds.size === 0) return;

    const { data: rows } = await supabase
      .from(tableName)
      .select('id, customer_id, customers(name)')
      .in('id', Array.from(entityIds));

    (rows || []).forEach((row) => {
      if (!row.id) return;
      const joinedName = getJoinedName(row.customers);
      if (row.customer_id && joinedName) {
        customerDirectory[row.customer_id] = joinedName;
      }
      if (joinedName) {
        setEntityCustomerName(entityType, row.id, joinedName);
      }
    });
  };

  await hydrateCustomersByIds();

  await Promise.all([
    resolveEntityCustomersWithJoin('loan', 'loans', loanIds),
    resolveEntityCustomersWithJoin('subscription', 'subscriptions', subscriptionIds),
    resolveEntityCustomersWithJoin('data_entry', 'data_entries', dataEntryIds),
  ]);

  if (installmentIds.size > 0) {
    const { data: installmentRows } = await supabase
      .from('installments')
      .select('id, loan_id')
      .in('id', Array.from(installmentIds));

    const uniqueLoanIds = Array.from(
      new Set((installmentRows || []).map((row) => row.loan_id).filter(Boolean)),
    );

    if (uniqueLoanIds.length > 0) {
      const { data: loanRows } = await supabase
        .from('loans')
        .select('id, customer_id, customers(name)')
        .in('id', uniqueLoanIds);

      const loanLookup = new Map();
      (loanRows || []).forEach((row) => {
        if (row.id) {
          const customerName = getJoinedName(row.customers);
          loanLookup.set(row.id, {
            customerId: row.customer_id,
            customerName,
          });
          if (row.customer_id && customerName) {
            customerDirectory[row.customer_id] = customerName;
          }
        }
      });

      (installmentRows || []).forEach((row) => {
        const loan = loanLookup.get(row.loan_id);
        if (row.id && loan?.customerName) {
          setEntityCustomerName('installment', row.id, loan.customerName);
        }
      });
    }
  }

  return {
    customerDirectory,
    entityCustomerNames,
  };
};

const resolveAdminDirectory = async (entries, includeAllAdmins, supabase) => {
  let adminUids = Array.from(new Set(entries.map((entry) => entry.admin_uid).filter(Boolean)));

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
      return;
    }
    if (!adminDirectory[entry.admin_uid]) {
      adminDirectory[entry.admin_uid] = entry.admin_uid;
    }
  });

  if (includeAllAdmins) {
    const { uids: allAdminUids, directory: allAdminDirectory } = await listAllAuthAdmins(supabase);
    adminUids = Array.from(new Set([...adminUids, ...allAdminUids]));
    Object.entries(allAdminDirectory).forEach(([uid, displayName]) => {
      if (!adminDirectory[uid]) {
        adminDirectory[uid] = displayName;
      }
    });
  }

  return {
    adminUids,
    adminDirectory,
  };
};

export default async (req) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('[get-audit-logs] Missing required server configuration', {
      hasSupabaseUrl: Boolean(SUPABASE_URL),
      hasServiceRole: Boolean(SERVICE_ROLE_KEY),
    });
    return json({ error: 'Server configuration error' }, 500);
  }

  const paramsResult = await parseAndValidateParams(req);
  if (paramsResult.response) return paramsResult.response;
  const params = paramsResult.params;

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authResult = await authenticateUser(req, supabase);
    if (authResult.response) return authResult.response;

    const superAdminResult = await validateSuperAdmin(authResult.user, supabase);
    if (superAdminResult.response) return superAdminResult.response;

    const auditLogResult = await fetchAuditLogs(params, supabase);
    if (auditLogResult.response) return auditLogResult.response;

    const { entries, includeAllAdmins, pagination } = auditLogResult;

    const { customerDirectory, entityCustomerNames } =
      await resolveRelatedEntities(entries, supabase);

    const { adminUids, adminDirectory } = await resolveAdminDirectory(
      entries,
      includeAllAdmins,
      supabase,
    );

    return json({
      success: true,
      is_super_admin: true,
      super_admin_uid: superAdminResult.superAdminUid,
      include_all_admins: includeAllAdmins,
      entries,
      admins: adminUids,
      admin_directory: adminDirectory,
      customer_directory: customerDirectory,
      entity_customer_names: entityCustomerNames,
      pagination,
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