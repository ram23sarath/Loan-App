import { beforeEach, describe, expect, it, vi } from 'vitest';

const createClientMock = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

const loadHandler = async () => {
  const mod = await import('../get-audit-logs.js');
  return mod.default;
};

const buildQueryMock = (rows: unknown[] = []) => {
  const query = {
    select: vi.fn(() => query),
    gte: vi.fn(() => query),
    or: vi.fn(() => query),
    order: vi.fn(() => query),
    range: vi.fn(async () => ({ data: rows, error: null })),
  };

  return query;
};

const buildSupabaseMock = () => {
  const auditQuery = buildQueryMock([]);

  const supabase = {
    auth: {
      getUser: vi.fn(async () => ({
        data: {
          user: {
            id: 'super-admin-1',
            email: 'admin@example.com',
            app_metadata: { role: 'super_admin' },
            user_metadata: { name: 'Admin' },
          },
        },
        error: null,
      })),
      admin: {
        listUsers: vi.fn(async () => ({ data: { users: [] }, error: null })),
      },
    },
    from: vi.fn((table: string) => {
      if (table === 'super_admins') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: { user_id: 'super-admin-1' }, error: null })),
            })),
          })),
        };
      }

      if (table === 'admin_audit_log') {
        return auditQuery;
      }

      if (table === 'customers') {
        return {
          select: vi.fn(() => ({ in: vi.fn(async () => ({ data: [], error: null })) })),
        };
      }

      if (table === 'loans' || table === 'subscriptions' || table === 'installments' || table === 'data_entries') {
        return {
          select: vi.fn(() => ({ in: vi.fn(async () => ({ data: [], error: null })) })),
        };
      }

      throw new Error(`Unexpected table in test: ${table}`);
    }),
  };

  return { supabase, auditQuery };
};

describe('get-audit-logs function cursor parsing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  });

  it('accepts base64url cursors with Supabase ISO timestamps', async () => {
    const { supabase } = buildSupabaseMock();
    createClientMock.mockReturnValueOnce(supabase);

    const getAuditLogsHandler = await loadHandler();
    const cursor = Buffer.from(
      JSON.stringify({
        created_at: '2026-03-17T13:09:50.564631+00:00',
        id: 'c87b4d96-c9ad-4c6f-9c4c-091cd6912ec0',
      }),
      'utf8',
    ).toString('base64url');

    const response = await getAuditLogsHandler(
      new Request(
        `http://localhost/.netlify/functions/get-audit-logs?page_size=20&cursor=${cursor}`,
        {
          method: 'GET',
          headers: { Authorization: 'Bearer token-123' },
        },
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('still rejects malformed cursors', async () => {
    const getAuditLogsHandler = await loadHandler();

    const response = await getAuditLogsHandler(
      new Request(
        'http://localhost/.netlify/functions/get-audit-logs?page_size=20&cursor=not-a-cursor',
        {
          method: 'GET',
          headers: { Authorization: 'Bearer token-123' },
        },
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid cursor');
  });
});