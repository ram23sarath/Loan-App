export type ApiErrorType = 'network' | 'timeout' | 'http' | 'parse' | 'abort' | 'unknown';

export class ApiError extends Error {
  type: ApiErrorType;
  status?: number;
  details?: unknown;
  isAbort: boolean;

  constructor(message: string, options: { type: ApiErrorType; status?: number; details?: unknown; cause?: unknown }) {
    super(message);
    this.name = 'ApiError';
    this.type = options.type;
    this.status = options.status;
    this.details = options.details;
    this.isAbort = options.type === 'abort';
    if (options.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  timeoutMs?: number;
  cacheKey?: string;
  staleTimeMs?: number;
  dedupeKey?: string;
  parseAs?: 'json' | 'text' | 'blob' | 'response';
  retries?: number;
};

type CacheEntry = { expiresAt: number; data: unknown };
const responseCache = new Map<string, CacheEntry>();
const inflightRequests = new Map<string, Promise<unknown>>();
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeBody = (body: unknown) => {
  if (body === undefined || body === null) return undefined;
  if (
    typeof body === 'string' ||
    body instanceof Blob ||
    body instanceof FormData ||
    body instanceof URLSearchParams ||
    body instanceof ArrayBuffer
  ) {
    return body;
  }
  return JSON.stringify(body);
};

const buildHeaders = (headers: HeadersInit | undefined, body: unknown) => {
  const resolved = new Headers(headers);
  if (body !== undefined && !(body instanceof FormData) && !resolved.has('Content-Type')) {
    resolved.set('Content-Type', 'application/json');
  }
  return resolved;
};

const parseResponse = async (
  response: Response,
  parseAs: NonNullable<RequestOptions['parseAs']>,
) => {
  if (parseAs === 'response') return response;
  if (parseAs === 'text') return response.text();
  if (parseAs === 'blob') return response.blob();
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new ApiError('Invalid server response.', { type: 'parse', status: response.status, details: text, cause: error });
  }
};

const getErrorMessageFromBody = (parsed: unknown, response: Response) => {
  if (typeof parsed === 'string' && parsed.trim()) {
    return parsed.trim();
  }

  if (
    parsed &&
    typeof parsed === 'object' &&
    'error' in parsed &&
    typeof (parsed as { error?: unknown }).error === 'string'
  ) {
    return String((parsed as { error: string }).error);
  }

  return response.statusText || 'Request failed.';
};

const parseErrorResponse = async (response: Response, parseAs: NonNullable<RequestOptions['parseAs']>) => {
  if (parseAs === 'response') {
    return null;
  }

  if (parseAs === 'text' || parseAs === 'blob') {
    return response.text();
  }

  const rawText = await response.text();
  if (!rawText.trim()) {
    return null;
  }

  try {
    return JSON.parse(rawText);
  } catch {
    return rawText;
  }
};

const isAbortError = (error: unknown) => error instanceof DOMException && error.name === 'AbortError';

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;
export const getApiErrorMessage = (error: unknown, fallback = 'Request failed.') => {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

export async function apiRequest<T = unknown>(url: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const dedupeKey = options.dedupeKey ?? `${method}:${url}:${typeof options.body === 'string' ? options.body : JSON.stringify(options.body ?? null)}`;
  const cacheKey = options.cacheKey;
  const staleTimeMs = options.staleTimeMs ?? 0;
  const parseAs = options.parseAs ?? 'json';

  if (cacheKey) {
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data as T;
    }
  }

  const existing = inflightRequests.get(dedupeKey);
  if (existing) return existing as Promise<T>;

  const requestPromise = (async () => {
    const retries = options.retries ?? 0;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const controller = new AbortController();
      const timeoutMs = options.timeoutMs ?? 15000;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const externalSignal = options.signal;
      const abortListener = () => controller.abort();

      try {
        if (externalSignal) {
          if (externalSignal.aborted) {
            controller.abort();
          } else {
            externalSignal.addEventListener('abort', abortListener, { once: true });
          }
        }

        const body = normalizeBody(options.body);
        const headers = buildHeaders(options.headers, body);
        const response = await fetch(url, {
          ...options,
          headers,
          body: body as BodyInit | undefined,
          signal: controller.signal,
        });

        if (!response.ok) {
          const parsedErrorBody = await parseErrorResponse(response.clone(), parseAs);
          const message = getErrorMessageFromBody(parsedErrorBody, response);
          throw new ApiError(message, {
            type: 'http',
            status: response.status,
            details: parsedErrorBody,
          });
        }

        const parsed = await parseResponse(response, parseAs);

        if (cacheKey && staleTimeMs > 0) {
          responseCache.set(cacheKey, { data: parsed, expiresAt: Date.now() + staleTimeMs });
        }

        return parsed as T;
      } catch (error) {
        const apiError = isAbortError(error)
          ? new ApiError(externalSignal?.aborted ? 'Request was cancelled.' : 'Request timed out.', {
              type: externalSignal?.aborted ? 'abort' : 'timeout',
              cause: error,
            })
          : error instanceof ApiError
            ? error
            : new ApiError(error instanceof Error ? error.message : 'Network request failed.', {
                type: 'network',
                cause: error,
              });

        const shouldRetry =
          apiError.type !== 'abort' &&
          apiError.type !== 'parse' &&
          (apiError.type === 'network' ||
            apiError.type === 'timeout' ||
            (apiError.status !== undefined && RETRYABLE_STATUS.has(apiError.status)));

        if (attempt >= retries || !shouldRetry) {
          throw apiError;
        }

        await delay(250 * 2 ** attempt);
      } finally {
        clearTimeout(timeoutId);
        externalSignal?.removeEventListener('abort', abortListener);
      }
    }

    throw new ApiError('Request failed.', { type: 'unknown' });
  })();

  inflightRequests.set(dedupeKey, requestPromise);
  try {
    return await requestPromise;
  } finally {
    inflightRequests.delete(dedupeKey);
  }
}

export const clearApiCache = (cacheKey?: string) => {
  if (cacheKey) responseCache.delete(cacheKey);
  else responseCache.clear();
};
