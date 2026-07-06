/**
 * Proxies /api/* to the Java backend (set BACKEND_URL in Vercel project env).
 * Example: BACKEND_URL=https://esukan-api.onrender.com
 */
export const config = {
  matcher: '/api/:path*',
};

export default async function middleware(request) {
  const backend = process.env.BACKEND_URL;
  if (!backend) {
    return new Response(
      JSON.stringify({
        error: 'BACKEND_URL is not set on Vercel. Deploy the Java API (see DEPLOYMENT_VERCEL_TIDB.md) and add BACKEND_URL.',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const incoming = new URL(request.url);
  const target = `${backend.replace(/\/$/, '')}${incoming.pathname}${incoming.search}`;
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('connection');
  headers.delete('content-length');
  headers.delete('content-encoding');
  headers.delete('transfer-encoding');

  let body = undefined;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    body = await request.text();
  }

  return fetch(target, {
    method: request.method,
    headers,
    body,
    redirect: 'manual',
  });
}
