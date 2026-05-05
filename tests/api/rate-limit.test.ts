import { describe, expect, it } from 'vitest';

import {
  buildRateLimitKey,
  consumeD1RateLimit,
  consumeMemoryRateLimit,
  normalizeRateLimitPath
} from '../../apps/api/src/rateLimit';

class MockRateLimitStatement {
  values: unknown[] = [];

  constructor(
    private readonly db: MockRateLimitD1,
    private readonly query: string
  ) {}

  bind(...values: unknown[]): D1PreparedStatement {
    this.values = values;
    return this as unknown as D1PreparedStatement;
  }

  async run(): Promise<D1Result> {
    return this.db.run(this.query, this.values);
  }

  async first<T = unknown>(): Promise<T | null> {
    return this.db.first(this.query, this.values) as T | null;
  }
}

class MockRateLimitD1 {
  readonly buckets = new Map<string, { count: number; resetAt: number }>();

  prepare(query: string): D1PreparedStatement {
    return new MockRateLimitStatement(this, query) as unknown as D1PreparedStatement;
  }

  async run(query: string, values: unknown[]): Promise<D1Result> {
    if (query.includes('UPDATE rate_limit_buckets') && query.includes('count = count + 1')) {
      const [key, nowSeconds, maxRequests] = values as [string, number, number];
      const bucket = this.buckets.get(key);
      if (!bucket || bucket.resetAt <= nowSeconds || bucket.count >= maxRequests) {
        return makeResult(0);
      }
      bucket.count += 1;
      return makeResult(1);
    }

    if (query.includes('INSERT INTO rate_limit_buckets')) {
      const [key, resetAtSeconds, nowSeconds] = values as [string, number, number];
      const bucket = this.buckets.get(key);
      if (bucket && bucket.resetAt > nowSeconds) {
        return makeResult(0);
      }
      this.buckets.set(key, { count: 1, resetAt: resetAtSeconds });
      return makeResult(1);
    }

    return makeResult(0);
  }

  first(_query: string, values: unknown[]): { count: number; resetAt: number } | null {
    const [key] = values as [string];
    const bucket = this.buckets.get(key);
    return bucket ? { count: bucket.count, resetAt: bucket.resetAt } : null;
  }
}

const makeResult = (changes: number): D1Result =>
  ({
    success: true,
    meta: { changes },
    results: []
  }) as D1Result;

describe('rate limit helpers', () => {
  it('normalizes per-episode paths so unique episode ids do not bypass a route bucket', () => {
    expect(normalizeRateLimitPath('/api/episodes/2f0e4f8f-5805-49ac-8e98-42f6f6be2ae8/actions')).toBe(
      '/api/episodes/:id/actions'
    );
    expect(buildRateLimitKey({
      clientIp: '203.0.113.10',
      method: 'post',
      path: '/api/episodes/2f0e4f8f-5805-49ac-8e98-42f6f6be2ae8/actions'
    })).toBe('203.0.113.10:POST:/api/episodes/:id/actions');
  });

  it('keeps the memory fallback behavior bounded for local overrides', () => {
    const store = new Map();
    const first = consumeMemoryRateLimit(store, {
      bucketKey: 'client:POST:/api/episodes/start',
      maxRequests: 1,
      windowSeconds: 60,
      nowMs: 1_000
    });
    const second = consumeMemoryRateLimit(store, {
      bucketKey: 'client:POST:/api/episodes/start',
      maxRequests: 1,
      windowSeconds: 60,
      nowMs: 1_500
    });

    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(0);
    expect(second.allowed).toBe(false);
    expect(second.retryAfterSeconds).toBe(60);
  });

  it('persists rate limit buckets in D1-style storage across requests', async () => {
    const rawDb = new MockRateLimitD1() as unknown as D1Database;
    const config = {
      bucketKey: 'client:POST:/api/episodes/start',
      maxRequests: 2,
      windowSeconds: 60,
      nowMs: 1_000
    };

    const first = await consumeD1RateLimit(rawDb, config);
    const second = await consumeD1RateLimit(rawDb, { ...config, nowMs: 2_000 });
    const third = await consumeD1RateLimit(rawDb, { ...config, nowMs: 3_000 });

    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(1);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(0);
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSeconds).toBe(58);
  });

  it('resets D1-style buckets after the window expires', async () => {
    const rawDb = new MockRateLimitD1() as unknown as D1Database;
    const config = {
      bucketKey: 'client:POST:/api/episodes/start',
      maxRequests: 1,
      windowSeconds: 60,
      nowMs: 1_000
    };

    await consumeD1RateLimit(rawDb, config);
    const blocked = await consumeD1RateLimit(rawDb, { ...config, nowMs: 2_000 });
    const reset = await consumeD1RateLimit(rawDb, { ...config, nowMs: 62_000 });

    expect(blocked.allowed).toBe(false);
    expect(reset.allowed).toBe(true);
    expect(reset.remaining).toBe(0);
  });
});
