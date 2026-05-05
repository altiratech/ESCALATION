export type RateLimitEntry = {
  count: number;
  resetAt: number;
};

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

export interface RateLimitConfig {
  bucketKey: string;
  maxRequests: number;
  windowSeconds: number;
  nowMs: number;
}

const getChanges = (result: unknown): number => (result as { meta?: { changes?: number } }).meta?.changes ?? 0;

export const normalizeRateLimitPath = (path: string): string =>
  path
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, ':id')
    .replace(/\/+/g, '/');

export const buildRateLimitKey = (input: { clientIp: string; method: string; path: string }): string =>
  [input.clientIp || 'unknown', input.method.toUpperCase(), normalizeRateLimitPath(input.path)].join(':');

export const consumeMemoryRateLimit = (
  store: Map<string, RateLimitEntry>,
  config: RateLimitConfig
): RateLimitResult => {
  const windowMs = config.windowSeconds * 1000;
  let entry = store.get(config.bucketKey);
  if (!entry || config.nowMs >= entry.resetAt) {
    entry = { count: 0, resetAt: config.nowMs + windowMs };
    store.set(config.bucketKey, entry);
  }

  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      limit: config.maxRequests,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - config.nowMs) / 1000))
    };
  }

  entry.count += 1;
  return {
    allowed: true,
    limit: config.maxRequests,
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetAt: entry.resetAt,
    retryAfterSeconds: 0
  };
};

export const consumeD1RateLimit = async (
  rawDb: D1Database,
  config: RateLimitConfig
): Promise<RateLimitResult> => {
  const nowSeconds = Math.floor(config.nowMs / 1000);
  const resetAtSeconds = nowSeconds + config.windowSeconds;

  const incrementResult = await rawDb
    .prepare(
      `UPDATE rate_limit_buckets
       SET count = count + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE bucket_key = ?
         AND reset_at > ?
         AND count < ?`
    )
    .bind(config.bucketKey, nowSeconds, config.maxRequests)
    .run();

  if (getChanges(incrementResult) > 0) {
    const row = await rawDb
      .prepare('SELECT count, reset_at AS resetAt FROM rate_limit_buckets WHERE bucket_key = ?')
      .bind(config.bucketKey)
      .first<{ count: number; resetAt: number }>();
    const count = row?.count ?? config.maxRequests;
    const resetAt = (row?.resetAt ?? resetAtSeconds) * 1000;
    return {
      allowed: true,
      limit: config.maxRequests,
      remaining: Math.max(0, config.maxRequests - count),
      resetAt,
      retryAfterSeconds: 0
    };
  }

  const upsertResult = await rawDb
    .prepare(
      `INSERT INTO rate_limit_buckets (bucket_key, count, reset_at)
       VALUES (?, 1, ?)
       ON CONFLICT(bucket_key) DO UPDATE SET
         count = 1,
         reset_at = excluded.reset_at,
         updated_at = CURRENT_TIMESTAMP
       WHERE rate_limit_buckets.reset_at <= ?`
    )
    .bind(config.bucketKey, resetAtSeconds, nowSeconds)
    .run();

  if (getChanges(upsertResult) > 0) {
    return {
      allowed: true,
      limit: config.maxRequests,
      remaining: Math.max(0, config.maxRequests - 1),
      resetAt: resetAtSeconds * 1000,
      retryAfterSeconds: 0
    };
  }

  const row = await rawDb
    .prepare('SELECT count, reset_at AS resetAt FROM rate_limit_buckets WHERE bucket_key = ?')
    .bind(config.bucketKey)
    .first<{ count: number; resetAt: number }>();
  const resetAt = (row?.resetAt ?? resetAtSeconds) * 1000;

  return {
    allowed: false,
    limit: config.maxRequests,
    remaining: 0,
    resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((resetAt - config.nowMs) / 1000))
  };
};
