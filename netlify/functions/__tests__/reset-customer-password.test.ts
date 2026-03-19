import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createClientMock = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

const loadHandler = async () => {
  const mod = await import('../reset-customer-password.js');
  return mod.default;
};

type MockState = {
  getUserResult: { data: { user: any } | null; error: unknown };
  superAdminLookup: { data: { user_id: string } | null; error: unknown };
  listUsersResult: { data: { users: any[] } | null; error: any };
  updateUserResult: { data: any; error: any };
  auditInsertError: any;
  capturedAuditInsert: any[];
};

const buildSupabaseMock = (state: Partial<MockState> = {}) => {
  const resolvedState: MockState = {
    getUserResult: {
      data: {
        user: {
          id: 'super-admin-1',
          email: 'owner@example.com',
          user_metadata: { name: 'Owner' },
          app_metadata: {},
        },
      },
      error: null,
    },
    superAdminLookup: { data: { user_id: 'super-admin-1' }, error: null },
    listUsersResult: {
      data: {
        users: [{ id: 'target-user-1', email: 'customer@example.com', phone: '9999999999' }],
      },
      error: null,
    },
    updateUserResult: { data: { user: { id: 'target-user-1' } }, error: null },
    auditInsertError: null,
    capturedAuditInsert: [],
    ...state,
  };

  const supabase = {
    auth: {
      getUser: vi.fn(async () => resolvedState.getUserResult),
      admin: {
        listUsers: vi.fn(async () => resolvedState.listUsersResult),
        updateUserById: vi.fn(async () => resolvedState.updateUserResult),
      },
    },
    from: vi.fn((table: string) => {
      if (table === 'super_admins') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => resolvedState.superAdminLookup),
            })),
          })),
        };
      }

      if (table === 'admin_audit_log') {
        return {
          insert: vi.fn(async (payload: unknown) => {
            resolvedState.capturedAuditInsert.push(payload);
            return { error: resolvedState.auditInsertError };
          }),
        };
      }

      throw new Error(`Unexpected table in test: ${table}`);
    }),
  };

  return { supabase, state: resolvedState };
};

const makeRequest = (
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
) =>
  new Request('http://localhost/.netlify/functions/reset-customer-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });

describe('reset-customer-password function', () => {
  let originalSupabaseUrl: string | undefined;
  let originalServiceRoleKey: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    originalSupabaseUrl = process.env.SUPABASE_URL;
    originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  });

  afterEach(() => {
    if (originalSupabaseUrl === undefined) {
      delete process.env.SUPABASE_URL;
    } else {
      process.env.SUPABASE_URL = originalSupabaseUrl;
    }

    if (originalServiceRoleKey === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRoleKey;
    }
  });

  it('returns 401 when authorization header is missing', async () => {
    const { supabase } = buildSupabaseMock();
    createClientMock.mockReturnValueOnce(supabase);

    const resetPasswordHandler = await loadHandler();
    const response = await resetPasswordHandler(
      makeRequest({ email: 'customer@example.com', new_password: 'newpass123' }),
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 403 when caller is not super admin', async () => {
    const { supabase } = buildSupabaseMock({
      superAdminLookup: { data: null, error: null },
    });
    createClientMock.mockReturnValueOnce(supabase);

    const resetPasswordHandler = await loadHandler();
    const response = await resetPasswordHandler(
      makeRequest(
        { email: 'customer@example.com', new_password: 'newpass123' },
        { Authorization: 'Bearer token-123' },
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Forbidden');
    expect(supabase.auth.admin.updateUserById).not.toHaveBeenCalled();
  });

  it('resets password and writes password_reset audit log entry', async () => {
    const { supabase, state } = buildSupabaseMock();
    createClientMock.mockReturnValueOnce(supabase);

    const resetPasswordHandler = await loadHandler();
    const response = await resetPasswordHandler(
      makeRequest(
        { email: 'customer@example.com', new_password: 'newpass123' },
        { Authorization: 'Bearer token-123' },
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(supabase.auth.admin.updateUserById).toHaveBeenCalledWith(
      'target-user-1',
      { password: 'newpass123' },
    );
    expect(state.capturedAuditInsert).toHaveLength(1);
    expect(state.capturedAuditInsert[0]).toMatchObject({
      admin_uid: 'super-admin-1',
      action: 'password_reset',
      entity_type: 'auth_user',
      entity_id: 'target-user-1',
      metadata: {
        source: 'reset-customer-password',
        target_email: 'customer@example.com',
        actor_email: 'owner@example.com',
      },
    });
  });
});
