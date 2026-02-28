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
  if (pathname.startsWith('/.netlify/functions/supabase-rest/')) {
    return pathname.replace('/.netlify/functions/supabase-rest/', '');
  }

  if (pathname.startsWith('/supabase-rest/')) {
    return pathname.replace('/supabase-rest/', '');
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
    const targetUrl = `${SUPABASE_URL}/rest/v1/${pathSuffix}${requestUrl.search}`;

    const headers = copyHeaders(req.headers);
    if (!headers.has('apikey') && SUPABASE_ANON_KEY) {
      headers.set('apikey', SUPABASE_ANON_KEY);
    }

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.arrayBuffer(),
    });

    const responseHeaders = copyHeaders(response.headers);
    responseHeaders.set('Cache-Control', 'no-store');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Supabase rest proxy request failed', details: error.message }),
      { status: 502, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
    );
  }
};
