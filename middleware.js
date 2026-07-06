/**
 * Proxies /api/* to the Java backend (set BACKEND_URL in Vercel project env).
 * Example: BACKEND_URL=https://esukan-api.onrender.com
 */
export const config = {
  matcher: '/api/:path*',
};

export default async function middleware(request) {
  const backend = process.env.BACKEND_URL ? process.env.BACKEND_URL.trim() : null;
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
  console.log(`Proxying ${request.method} ${incoming.pathname} -> ${target}`);

  // Create clean headers to forward (prevent Vercel internal headers from breaking Render/Cloudflare)
  const headers = new Headers();
  const forwardKeys = [
    'content-type',
    'authorization',
    'cookie',
    'accept',
    'user-agent',
    'accept-language',
    'referer',
    'origin'
  ];
  for (const key of forwardKeys) {
    const val = request.headers.get(key);
    if (val) {
      headers.set(key, val);
    }
  }

  let body = undefined;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    body = await request.text();
  }

  try {
    return await fetch(target, {
      method: request.method,
      headers,
      body,
      redirect: 'manual',
    });
  } catch (err) {
    console.error(`Fetch failed for target: ${target}`, err);
    throw err;
  }
}
