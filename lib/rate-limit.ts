import "server-only";

// Limitation de débit simple, en mémoire : suffisante contre un script naïf.
// (Sur Vercel chaque instance a sa propre mémoire ; à renforcer plus tard avec un service dédié si besoin.)

type Entry = { count: number; resetAt: number };

export function createRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, Entry>();
  return function isLimited(key: string): boolean {
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.resetAt < now) {
      if (hits.size > 5000) hits.clear();
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return false;
    }
    entry.count += 1;
    return entry.count > limit;
  };
}

export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
