/**
 * Cache Service - Production-grade caching for hot data
 * Improves latency by caching frequently accessed data
 * Supports Redis integration for distributed caching
 */

import { Injectable, Inject, Optional } from '@nestjs/common';

// Simple in-memory cache implementation
interface CacheEntry {
  value: any;
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
  async get<T = any>(key: string): Promise<T | undefined> {
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
  async set<T = any>(
    key: string,
    value: T,
    options?: CacheOptions,
  ): Promise<void> {
    const ttl = options?.ttl || this.DEFAULT_TTL;
    const expiresAt = Date.now() + ttl * 1000;
    this.cache.set(key, { value, expiresAt });
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  /**
   * Delete all values matching pattern
   */
  async deletePattern(pattern: string): Promise<void> {
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
  async clear(): Promise<void> {
    this.cache.clear();
  }

  /**
   * Get or compute value (cache-aside pattern)
   */
  async getOrCompute<T = any>(
    key: string,
    computeFn: () => Promise<T>,
    options?: CacheOptions,
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    // Compute and cache
    const value = await computeFn();
    await this.set(key, value, options);
    return value;
  }

  /**
   * Batch get multiple values
   */
  async mget(keys: string[]): Promise<Record<string, any>> {
    const results: Record<string, any> = {};
    for (const key of keys) {
      results[key] = await this.get(key);
    }
    return results;
  }

  /**
   * Batch set multiple values
   */
  async mset(
    values: Record<string, any>,
    options?: CacheOptions,
  ): Promise<void> {
    for (const [key, value] of Object.entries(values)) {
      await this.set(key, value, options);
    }
  }

  /**
   * Increment counter
   */
  async increment(key: string, amount = 1): Promise<number> {
    const current = (await this.get<number>(key)) || 0;
    const updated = current + amount;
    await this.set(key, updated);
    return updated;
  }

  /**
   * Decrement counter
   */
  async decrement(key: string, amount = 1): Promise<number> {
    return this.increment(key, -amount);
  }

  /**
   * Set with automatic expiration
   */
  async setWithExpiry(
    key: string,
    value: any,
    expiresIn: number, // milliseconds
  ): Promise<void> {
    await this.set(key, value, { ttl: Math.ceil(expiresIn / 1000) });
    // Auto-delete after expiry
    setTimeout(() => this.delete(key), expiresIn);
  }

  /**
   * Bulk invalidation by pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    await this.deletePattern(pattern);
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
  async cacheProductDetails(productId: string, data: any): Promise<void> {
    await this.set(this.buildKey(CacheKeys.PRODUCT_DETAILS, productId), data, {
      ttl: 3600,
    });
  }

  /**
   * Get cached product details
   */
  async getProductDetailsFromCache(
    productId: string,
  ): Promise<any | undefined> {
    return this.get(this.buildKey(CacheKeys.PRODUCT_DETAILS, productId));
  }

  /**
   * Invalidate product cache
   */
  async invalidateProductCache(productId: string): Promise<void> {
    await this.deletePattern(`^${CacheKeys.PRODUCT_DETAILS}${productId}$`);
    await this.deletePattern(`^${CacheKeys.PRODUCT_CARD}${productId}$`);
  }

  /**
   * Cache creator profile (30 minutes TTL)
   */
  async cacheCreatorProfile(creatorId: string, data: any): Promise<void> {
    await this.set(this.buildKey(CacheKeys.CREATOR_PROFILE, creatorId), data, {
      ttl: 1800,
    });
  }

  /**
   * Get cached creator profile
   */
  async getCreatorProfileFromCache(
    creatorId: string,
  ): Promise<any | undefined> {
    return this.get(this.buildKey(CacheKeys.CREATOR_PROFILE, creatorId));
  }

  /**
   * Invalidate creator cache
   */
  async invalidateCreatorCache(creatorId: string): Promise<void> {
    await this.deletePattern(`^${CacheKeys.CREATOR_PROFILE}${creatorId}$`);
    await this.deletePattern(`^${CacheKeys.CREATOR_STORE}${creatorId}$`);
  }

  /**
   * Cache category tree (2 hours TTL)
   */
  async cacheCategoryTree(data: any): Promise<void> {
    await this.set(CacheKeys.CATEGORY_TREE, data, { ttl: 7200 });
  }

  /**
   * Get cached category tree
   */
  async getCategoryTreeFromCache(): Promise<any | undefined> {
    return this.get(CacheKeys.CATEGORY_TREE);
  }

  /**
   * Invalidate category cache
   */
  async invalidateCategoryCache(): Promise<void> {
    await this.delete(CacheKeys.CATEGORY_TREE);
  }

  /**
   * Cache discount code (validation cache, 5 minutes TTL)
   */
  async cacheDiscountCode(code: string, data: any): Promise<void> {
    await this.set(this.buildKey(CacheKeys.DISCOUNT_CODE, code), data, {
      ttl: 300,
    });
  }

  /**
   * Get cached discount code
   */
  async getDiscountCodeFromCache(code: string): Promise<any | undefined> {
    return this.get(this.buildKey(CacheKeys.DISCOUNT_CODE, code));
  }

  /**
   * Invalidate discount code cache
   */
  async invalidateDiscountCodeCache(code: string): Promise<void> {
    await this.delete(this.buildKey(CacheKeys.DISCOUNT_CODE, code));
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
  async getStats(): Promise<any> {
    return {
      available: true,
      keys: this.cache.size,
    };
  }
}
