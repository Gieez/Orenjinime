/**
 * Simple in-memory rate limiter for API routes.
 * Works per-IP. Resets on server restart (fine for serverless).
 *
 * Usage in API route:
 *   const rateLimitResult = checkRateLimit(ip, 60, 60_000); // 60 req per 60s
 *   if (!rateLimitResult.success) {
 *     return NextResponse.json({ error: "Too many requests" }, { status: 429 });
 *   }
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

export function checkRateLimit(
  identifier: string,
  maxRequests: number = 60,
  windowMs: number = 60_000,
): { success: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(identifier);

  if (!entry || now > entry.resetAt) {
    // New window
    store.set(identifier, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  if (entry.count >= maxRequests) {
    return { success: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { success: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}

/**
 * IPv4 format validation — used to harden IP extraction against header spoofing.
 */
function isValidIp(s: string): boolean {
  // IPv4
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(s)) {
    return s.split(".").every((p) => {
      const n = Number(p);
      return n >= 0 && n <= 255;
    });
  }
  // IPv6 (basic — contains colons, no spaces)
  if (s.includes(":") && !s.includes(" ")) {
    return true;
  }
  return false;
}

/**
 * Get client IP from request headers.
 * Note: Vercel sets x-forwarded-for and x-real-ip automatically. We pick the
 * FIRST hop from x-forwarded-for which is conventionally the client IP, but
 * we validate the format to prevent obvious garbage injection.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0].trim();
    if (first && isValidIp(first)) {
      return first;
    }
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp && isValidIp(realIp)) {
    return realIp;
  }
  return "unknown";
}
