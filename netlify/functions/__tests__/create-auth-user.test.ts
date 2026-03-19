import { beforeEach, describe, expect, it, vi } from 'vitest';

const createClientMock = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

const loadHandler = async () => {
  const mod = await import('../create-auth-user.js');
  return mod.default;
};

type MaybeSingleResult = { data: { user_id: string } | null; error: unknown };

type MockState = {
  getUserResult: { data: { user: any } | null; error: unknown };
  superAdminLookup: MaybeSingleResult;
  createUserResult: { data: { user: any } | null; error: any };
  auditInsertError: any;
  capturedAuditInsert: any[];
};

const buildSupabaseMock = (state: Partial<MockState> = {}) => {
  const resolvedState: MockState = {
    getUserResult: {
      data: { user: { id: 'admin-uid', email: 'admin@example.com', user_metadata: { name: 'Admin' }, app_metadata: {} } },
      error: null,
    },
    superAdminLookup: { data: { user_id: 'admin-uid' }, error: null },
    createUserResult: {
      data: { user: { id: 'new-user-1', email: 'new@example.com' } },
      error: null,
    },
    auditInsertError: null,
    capturedAuditInsert: [],
    ...state,
  };

  const supabase = {
    auth: {
      getUser: vi.fn(async () => resolvedState.getUserResult),
      admin: {
        createUser: vi.fn(async () => resolvedState.createUserResult),
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

const makeRequest = (headers: Record<string, string> = {}) =>
  new Request('http://localhost/.netlify/functions/create-auth-user', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify({
      email: 'new@example.com',
      password: 'secret123',
      name: 'New User',
      isAdmin: false,
    }),
  });

describe('create-auth-user function', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  });

  it('returns 401 when authorization header is missing', async () => {
    const { supabase } = buildSupabaseMock();
    createClientMock.mockReturnValueOnce(supabase);

    const createAuthUserHandler = await loadHandler();
    const response = await createAuthUserHandler(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 403 when caller is not a super admin', async () => {
    const { supabase } = buildSupabaseMock({
      superAdminLookup: { data: null, error: null },
    });
    createClientMock.mockReturnValueOnce(supabase);

    const createAuthUserHandler = await loadHandler();
    const response = await createAuthUserHandler(
      makeRequest({ Authorization: 'Bearer token-123' }),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Forbidden');
    expect(supabase.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it('creates a user and writes audit log for super admins', async () => {
    const { supabase, state } = buildSupabaseMock();
    createClientMock.mockReturnValueOnce(supabase);

    const createAuthUserHandler = await loadHandler();
    const response = await createAuthUserHandler(
      makeRequest({ Authorization: 'Bearer token-123' }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(supabase.auth.admin.createUser).toHaveBeenCalledTimes(1);
    expect(state.capturedAuditInsert).toHaveLength(1);
    expect(state.capturedAuditInsert[0]).toMatchObject({
      admin_uid: 'admin-uid',
      action: 'create',
      entity_type: 'auth_user',
      metadata: {
        source: 'create-auth-user',
        actor_email: 'admin@example.com',
      },
    });
  });
});
