interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimits = new Map<string, RateLimitEntry>();

export function checkRateLimit(ip: string, maxRequests: number, windowMs: number): { success: boolean; limit: number; remaining: number; reset: number } {
  const now = Date.now();
  let entry = rateLimits.get(ip);

  // Xóa entry nếu đã hết hạn
  if (entry && entry.resetAt < now) {
    rateLimits.delete(ip);
    entry = undefined;
  }

  if (!entry) {
    entry = { count: 0, resetAt: now + windowMs };
    rateLimits.set(ip, entry);
  }

  entry.count++;

  const success = entry.count <= maxRequests;
  const remaining = Math.max(0, maxRequests - entry.count);

  return {
    success,
    limit: maxRequests,
    remaining,
    reset: entry.resetAt,
  };
}
