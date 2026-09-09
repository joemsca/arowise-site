// Edge Middleware: HTTP Basic Auth for the client portal.
// Protects everything under /clients/ (pages and the submit endpoint rewritten beneath it).
// Credentials come from Vercel env vars CLIENT_PORTAL_USER / CLIENT_PORTAL_PASS.
export const config = { matcher: ['/clients/:path*'] };

export default function middleware(request) {
  const expectedUser = process.env.CLIENT_PORTAL_USER || '';
  const expectedPass = process.env.CLIENT_PORTAL_PASS || '';
  const header = request.headers.get('authorization') || '';
  if (expectedPass && header.startsWith('Basic ')) {
    try {
      const [user, pass] = atob(header.slice(6)).split(':');
      if (user === expectedUser && pass === expectedPass) return; // continue to the page
    } catch (e) { /* fall through to challenge */ }
  }
  return new Response('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="AroWise client portal", charset="UTF-8"',
      'X-Robots-Tag': 'noindex, nofollow',
      'Cache-Control': 'no-store',
    },
  });
}
