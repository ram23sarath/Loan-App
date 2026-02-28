const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
]);

const copyHeaders = (sourceHeaders) => {
  const headers = new Headers();

  sourceHeaders.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  return headers;
};

const resolveSplat = (pathname, requestUrl) => {
  if (pathname.startsWith('/.netlify/functions/supabase-auth/')) {
    return pathname.replace('/.netlify/functions/supabase-auth/', '');
  }

  if (pathname.startsWith('/supabase-auth/')) {
    return pathname.replace('/supabase-auth/', '');
  }

  return requestUrl.searchParams.get('path') || '';
};

export default async (req) => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return new Response(
      JSON.stringify({ error: 'Missing Supabase proxy environment variables' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const requestUrl = new URL(req.url);
    const pathSuffix = resolveSplat(requestUrl.pathname, requestUrl);
    const forwardQuery = buildForwardQuery(requestUrl);
    const targetUrl = `${SUPABASE_URL}/auth/v1/${pathSuffix}${forwardQuery}`;

    const headers = copyHeaders(req.headers);
    if (!headers.has('apikey') && SUPABASE_ANON_KEY) {
      headers.set('apikey', SUPABASE_ANON_KEY);
    }

    const debug = process.env.SUPABASE_PROXY_DEBUG === '1' || process.env.SUPABASE_PROXY_DEBUG === 'true';
    const verbose = debug && (process.env.SUPABASE_PROXY_DEBUG === '2' || process.env.SUPABASE_PROXY_DEBUG_VERBOSE === '1');
    if (debug) {
      // Log safe request metadata (do not log sensitive request bodies)
      const safeReqHeaders = {};
      ['accept', 'content-type', 'referer', 'user-agent'].forEach((h) => {
        const v = req.headers.get?.(h) || req.headers[h];
        if (v) safeReqHeaders[h] = v;
      });
      console.log('[supabase-auth-proxy] forwarding', { method: req.method, path: requestUrl.pathname, targetUrl, headers: safeReqHeaders });
    }

    const start = Date.now();
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.arrayBuffer(),
    });
    const elapsed = Date.now() - start;

    const responseHeaders = copyHeaders(response.headers);
    responseHeaders.set('Cache-Control', 'no-store');

    if (debug) {
      const respType = response.headers.get('content-type') || '';
      console.log(`[supabase-auth-proxy] response status=${response.status} statusText=${response.statusText} content-type=${respType} elapsed=${elapsed}ms`);
      if (verbose) {
        try {
          const cloned = response.clone();
          const text = await cloned.text();
          const snippet = text.length > 1024 ? text.slice(0, 1024) + '...<truncated>' : text;
          console.log('[supabase-auth-proxy] response body snippet:\n' + snippet);
        } catch (e) {
          console.log('[supabase-auth-proxy] failed to read response body for debug:', e?.message || e);
        }
      }
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('[supabase-auth-proxy] unexpected error', error);
    const debug = process.env.SUPABASE_PROXY_DEBUG === '1' || process.env.SUPABASE_PROXY_DEBUG === 'true';
    const body = debug
      ? JSON.stringify({ error: 'Supabase auth proxy request failed', message: error?.message, stack: error?.stack })
      : JSON.stringify({ error: 'Supabase auth proxy request failed' });
    return new Response(body, { status: 502, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  }
};
