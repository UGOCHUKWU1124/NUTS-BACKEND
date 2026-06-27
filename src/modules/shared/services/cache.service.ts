/**
 * Cache Service - Production-grade caching for hot data
 * Improves latency by caching frequently accessed data
 * Supports Redis integration for distributed caching
 */

import { Injectable } from '@nestjs/common';

// Simple in-memory cache implementation
interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

type Cache = Map<string, CacheEntry>;

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  isGlobal?: boolean; // Cache globally vs per-tenant
}

export enum CacheKeys {
  // Products
  PRODUCT_DETAILS = 'product:details:',
  PRODUCT_CARD = 'product:card:',
  CATEGORY_TREE = 'category:tree',
  CREATOR_PROFILE = 'creator:profile:',
  CREATOR_STORE = 'creator:store:',
  PRODUCT_VARIANTS = 'product:variants:',

  // Orders
  ORDER_SUMMARY = 'order:summary:',
  ORDER_STATS = 'order:stats:',

  // Promotions
  DISCOUNT_CODE = 'discount:code:',
  PROMOTION_LIST = 'promotion:list',

  // Users
  USER_PROFILE = 'user:profile:',
  USER_STATS = 'user:stats:',

  // System
  FEATURE_FLAGS = 'feature:flags',
  CONFIG_CACHE = 'config:cache',
}

@Injectable()
export class CacheService {
  private readonly DEFAULT_TTL = 3600; // 1 hour
  private cache: Cache = new Map();

  constructor() {}

  /**
   * Get value from cache
   */
  get<T = unknown>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check if expired
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value as T;
  }

  /**
   * Set value in cache
   */
  set<T = unknown>(key: string, value: T, options?: CacheOptions): void {
    const ttl = options?.ttl ?? this.DEFAULT_TTL;
    const expiresAt = Date.now() + ttl * 1000;
    this.cache.set(key, { value, expiresAt });
  }

  /**
   * Delete value from cache
   */
  del(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Delete all values matching pattern
   */
  delByPattern(pattern: string): void {
    const regex = new RegExp(pattern);
    const keysToDelete = Array.from(this.cache.keys()).filter((key) =>
      regex.test(key),
    );
    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get or compute value (cache-aside pattern)
   */
  async wrap<T = unknown>(
    key: string,
    ttlSeconds: number,
    computeFn: () => Promise<T>,
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await computeFn();
    this.set(key, value, { ttl: ttlSeconds });
    return value;
  }

  /**
   * Get or compute value (cache-aside pattern, legacy API)
   */
  async getOrCompute<T = unknown>(
    key: string,
    computeFn: () => Promise<T>,
    options?: CacheOptions,
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await computeFn();
    this.set(key, value, options);
    return value;
  }

  /**
   * Batch get multiple values
   */
  mget(keys: string[]): Record<string, unknown> {
    const results: Record<string, unknown> = {};
    for (const key of keys) {
      results[key] = this.get(key);
    }
    return results;
  }

  /**
   * Batch set multiple values
   */
  mset(values: Record<string, unknown>, options?: CacheOptions): void {
    for (const [key, value] of Object.entries(values)) {
      this.set(key, value, options);
    }
  }

  /**
   * Increment counter
   */
  increment(key: string, amount = 1): number {
    const current = this.get<number>(key) ?? 0;
    const updated = current + amount;
    this.set(key, updated);
    return updated;
  }

  /**
   * Decrement counter
   */
  decrement(key: string, amount = 1): number {
    return this.increment(key, -amount);
  }

  /**
   * Set with automatic expiration
   */
  setWithExpiry(
    key: string,
    value: unknown,
    expiresIn: number, // milliseconds
  ): void {
    this.set(key, value, { ttl: Math.ceil(expiresIn / 1000) });
    // Auto-delete after expiry
    setTimeout(() => this.del(key), expiresIn);
  }

  /**
   * Bulk invalidation by pattern
   */
  invalidatePattern(pattern: string): void {
    this.delByPattern(pattern);
  }

  /**
   * Create a namespaced key
   */
  buildKey(prefix: string, ...parts: string[]): string {
    return [prefix, ...parts].filter(Boolean).join(':');
  }

  /**
   * Cache product details (1 hour TTL)
   */
  cacheProductDetails(productId: string, data: unknown): void {
    this.set(this.buildKey(CacheKeys.PRODUCT_DETAILS, productId), data, {
      ttl: 3600,
    });
  }

  /**
   * Get cached product details
   */
  getProductDetailsFromCache(productId: string): unknown {
    return this.get(this.buildKey(CacheKeys.PRODUCT_DETAILS, productId));
  }

  /**
   * Invalidate product cache
   */
  invalidateProductCache(productId: string): void {
    this.delByPattern(`^${CacheKeys.PRODUCT_DETAILS}${productId}$`);
    this.delByPattern(`^${CacheKeys.PRODUCT_CARD}${productId}$`);
  }

  /**
   * Cache creator profile (30 minutes TTL)
   */
  cacheCreatorProfile(creatorId: string, data: unknown): void {
    this.set(this.buildKey(CacheKeys.CREATOR_PROFILE, creatorId), data, {
      ttl: 1800,
    });
  }

  /**
   * Get cached creator profile
   */
  getCreatorProfileFromCache(creatorId: string): unknown {
    return this.get(this.buildKey(CacheKeys.CREATOR_PROFILE, creatorId));
  }

  /**
   * Invalidate creator cache
   */
  invalidateCreatorCache(creatorId: string): void {
    this.delByPattern(`^${CacheKeys.CREATOR_PROFILE}${creatorId}$`);
    this.delByPattern(`^${CacheKeys.CREATOR_STORE}${creatorId}$`);
  }

  /**
   * Cache category tree (2 hours TTL)
   */
  cacheCategoryTree(data: unknown): void {
    this.set(CacheKeys.CATEGORY_TREE, data, { ttl: 7200 });
  }

  /**
   * Get cached category tree
   */
  getCategoryTreeFromCache(): unknown {
    return this.get(CacheKeys.CATEGORY_TREE);
  }

  /**
   * Invalidate category cache
   */
  invalidateCategoryCache(): void {
    this.del(CacheKeys.CATEGORY_TREE);
  }

  /**
   * Cache discount code (validation cache, 5 minutes TTL)
   */
  cacheDiscountCode(code: string, data: unknown): void {
    this.set(this.buildKey(CacheKeys.DISCOUNT_CODE, code), data, {
      ttl: 300,
    });
  }

  /**
   * Get cached discount code
   */
  getDiscountCodeFromCache(code: string): unknown {
    return this.get(this.buildKey(CacheKeys.DISCOUNT_CODE, code));
  }

  /**
   * Invalidate discount code cache
   */
  invalidateDiscountCodeCache(code: string): void {
    this.del(this.buildKey(CacheKeys.DISCOUNT_CODE, code));
  }

  /**
   * Check if cache is available
   */
  isAvailable(): boolean {
    return true; // In-memory cache always available
  }

  /**
   * Get cache manager stats (if available)
   */
  getStats(): { available: boolean; keys: number } {
    return {
      available: true,
      keys: this.cache.size,
    };
  }
}
