type RateLimitOptions = {
  key: string;
  maxRequests: number;
  windowMs: number;
};

type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
};

type RateLimitEntry = {
  count: number;
  expiresAt: number;
};

declare global {
  var __authRateLimitStore: Map<string, RateLimitEntry> | undefined;
}

function getStore(): Map<string, RateLimitEntry> {
  if (!globalThis.__authRateLimitStore) {
    globalThis.__authRateLimitStore = new Map();
  }

  return globalThis.__authRateLimitStore;
}

function cleanupExpiredEntries(now: number, store: Map<string, RateLimitEntry>): void {
  for (const [key, entry] of store.entries()) {
    if (entry.expiresAt <= now) {
      store.delete(key);
    }
  }
}

export function consumeRateLimit(options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const store = getStore();
  cleanupExpiredEntries(now, store);

  const existing = store.get(options.key);

  if (!existing || existing.expiresAt <= now) {
    store.set(options.key, {
      count: 1,
      expiresAt: now + options.windowMs,
    });

    return {
      allowed: true,
      retryAfterSeconds: 0,
      remaining: Math.max(0, options.maxRequests - 1),
    };
  }

  if (existing.count >= options.maxRequests) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.expiresAt - now) / 1000)),
      remaining: 0,
    };
  }

  const updated = {
    count: existing.count + 1,
    expiresAt: existing.expiresAt,
  };

  store.set(options.key, updated);

  return {
    allowed: true,
    retryAfterSeconds: 0,
    remaining: Math.max(0, options.maxRequests - updated.count),
  };
}
