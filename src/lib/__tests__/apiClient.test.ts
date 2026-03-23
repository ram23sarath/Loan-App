import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest, ApiError, clearApiCache } from '../apiClient';

describe('apiRequest', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    clearApiCache();
  });

  it('deduplicates identical in-flight requests', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const [first, second] = await Promise.all([
      apiRequest<{ ok: boolean }>('/api/test', { dedupeKey: 'same-request' }),
      apiRequest<{ ok: boolean }>('/api/test', { dedupeKey: 'same-request' }),
    ]);

    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('serves cached responses within the stale window', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ value: 42 }), { status: 200 }),
    );

    const first = await apiRequest<{ value: number }>('/api/cache', {
      cacheKey: 'cache-key',
      staleTimeMs: 1_000,
    });
    const second = await apiRequest<{ value: number }>('/api/cache', {
      cacheKey: 'cache-key',
      staleTimeMs: 1_000,
    });

    expect(first.value).toBe(42);
    expect(second.value).toBe(42);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('normalizes http errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Nope' }), { status: 500, statusText: 'Server Error' }),
    );

    await expect(apiRequest('/api/error')).rejects.toMatchObject<ApiError>({
      type: 'http',
      status: 500,
      message: 'Nope',
    });
  });
});
