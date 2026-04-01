import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadHandler = async () => {
  const mod = await import('../installment-cron-status.js');
  return mod.default;
};

describe('installment-cron-status function', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    process.env.GITHUB_OWNER = 'ram23sarath';
    process.env.GITHUB_REPO = 'Loan-App';
    process.env.GITHUB_TOKEN = 'token-123';
    delete process.env.INSTALLMENT_CRON_WORKFLOW_FILE;
  });

  it('returns 405 for non-GET methods', async () => {
    const handler = await loadHandler();
    const response = await handler(new Request('http://localhost/.netlify/functions/installment-cron-status', { method: 'POST' }));
    const body = await response.json();

    expect(response.status).toBe(405);
    expect(body.error).toBe('Method Not Allowed');
  });

  it('returns latest run and success flag', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        workflow_runs: [
          {
            id: 101,
            status: 'completed',
            conclusion: 'success',
            html_url: 'https://github.com/example/run/101',
            created_at: '2026-03-31T10:00:00Z',
            updated_at: '2026-03-31T10:05:00Z',
            run_started_at: '2026-03-31T10:01:00Z',
          },
        ],
      }),
    } as Response);

    const handler = await loadHandler();
    const response = await handler(new Request('http://localhost/.netlify/functions/installment-cron-status', { method: 'GET' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.found).toBe(true);
    expect(body.isSuccessful).toBe(true);
    expect(body.run.id).toBe(101);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns found false when no run exists', async () => {
    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ workflow_runs: [] }),
    } as Response);

    const handler = await loadHandler();
    const response = await handler(new Request('http://localhost/.netlify/functions/installment-cron-status', { method: 'GET' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.found).toBe(false);
  });
});
