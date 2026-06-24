import type { IncomingMessage } from 'http';

/**
 * Extracts the real IP address from an HTTP request, respecting proxy headers.
 *
 * Priority:
 *   1. `x-forwarded-for`  (first address if multiple)
 *   2. `x-real-ip`
 *   3. `req.ip` / `req.socket.remoteAddress`
 *   4. `req.connection?.remoteAddress`
 *   5. `'0.0.0.0'` as final fallback (never returns undefined)
 */
export function extractIpAddress(request: IncomingMessage): string {
  const forwardedFor = request.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string') {
    const ip = forwardedFor.split(',')[0]?.trim();
    if (ip) return ip;
  } else if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    const ip = forwardedFor[0]?.split(',')[0]?.trim();
    if (ip) return ip;
  }

  const realIp = request.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp) return realIp;

  const req = request as { ip?: string };
  if (req.ip) return req.ip;

  if (request.socket?.remoteAddress) return request.socket.remoteAddress;

  return '0.0.0.0';
}

/**
 * Extracts the User-Agent header value from an HTTP request.
 * Returns an empty string if missing.
 */
export function extractUserAgent(request: IncomingMessage): string {
  const ua = request.headers['user-agent'];
  if (typeof ua === 'string') return ua;
  if (Array.isArray(ua)) return ua[0] ?? '';
  return '';
}
