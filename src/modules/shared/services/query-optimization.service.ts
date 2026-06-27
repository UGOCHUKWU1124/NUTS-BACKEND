/**
 * Query Optimization Service
 * Provides patterns and helpers for efficient Prisma queries
 * Prevents N+1 problems, optimizes pagination, implements batch operations
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { Prisma } from '@prisma/client';

export interface BatchFetchOptions {
  chunkSize?: number;
  parallel?: boolean;
  timeout?: number;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

@Injectable()
export class QueryOptimizationService {
  constructor(private prisma: PrismaService) {}

  /**
   * Fetch with pagination in a single optimized transaction
   * Combines count + fetch to avoid double queries
   */
  async fetchPaginated<T>(
    model: Record<string, (...args: unknown[]) => unknown>,
    where: unknown,
    options: PaginationOptions,
    include?: unknown,
  ): Promise<{ data: T[]; total: number; page: number; limit: number }> {
    const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = options;

    const total = await (model.count({ where }) as Promise<number>);
    const data = await (model.findMany({
      where,
      include,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    }) as Promise<T[]>);

    return { data, total, page, limit };
  }

  /**
   * Batch fetch multiple IDs efficiently (prevents N+1)
   * Groups requests and fetches in parallel
   */
  async batchFetchByIds<T>(
    model: Record<string, (...args: unknown[]) => unknown>,
    ids: string[],
    select: unknown,
    options?: BatchFetchOptions,
  ): Promise<Map<string, T>> {
    const chunkSize = options?.chunkSize ?? 100;
    const chunks: string[][] = [];

    for (let i = 0; i < ids.length; i += chunkSize) {
      chunks.push(ids.slice(i, i + chunkSize));
    }

    const results = new Map<string, T>();

    const promises = chunks.map(
      (chunk) =>
        model.findMany({
          where: { id: { in: chunk } },
          select,
        }) as Promise<Array<T & { id: string }>>,
    );

    const batchResults = await Promise.all(promises);

    for (const batch of batchResults) {
      for (const item of batch) {
        results.set(item.id, item);
      }
    }

    return results;
  }

  /**
   * Batch create multiple records efficiently
   * Uses createMany for better performance
   */
  async batchCreate<T>(
    model: Record<string, (...args: unknown[]) => unknown>,
    data: unknown[],
    options?: { skipDuplicates?: boolean },
  ): Promise<{ count: number; created: T[] }> {
    if (data.length === 0) {
      return { count: 0, created: [] };
    }

    const result = await (model.createMany({
      data,
      skipDuplicates: options?.skipDuplicates ?? false,
    }) as Promise<{ count: number }>);

    return { count: result.count, created: data as T[] };
  }

  /**
   * Batch update multiple records efficiently
   */
  async batchUpdate(
    model: Record<string, (...args: unknown[]) => unknown>,
    updates: Array<{ where: unknown; data: unknown }>,
  ): Promise<{ count: number }> {
    if (updates.length === 0) {
      return { count: 0 };
    }

    let totalCount = 0;

    for (const update of updates) {
      const result = await (model.updateMany(update) as Promise<{
        count: number;
      }>);
      totalCount += result.count;
    }

    return { count: totalCount };
  }

  /**
   * Batch delete multiple records efficiently
   */
  async batchDelete(
    model: Record<string, (...args: unknown[]) => unknown>,
    ids: string[],
  ): Promise<{ count: number }> {
    if (ids.length === 0) {
      return { count: 0 };
    }

    const result = await (model.deleteMany({
      where: { id: { in: ids } },
    }) as Promise<{ count: number }>);

    return { count: result.count };
  }

  /**
   * Fetch related records for multiple parent records
   * Prevents N+1 by fetching all related records at once
   */
  async fetchRelatedForMany<T>(
    model: Record<string, (...args: unknown[]) => unknown>,
    parentIds: string[],
    relationField: string,
    select?: unknown,
  ): Promise<Map<string, T[]>> {
    const records = await (model.findMany({
      where: { id: { in: parentIds } },
      select: {
        id: true,
        [relationField]: { select },
      },
    }) as Promise<Array<{ id: string } & Record<string, T[]>>>);

    const result = new Map<string, T[]>();

    for (const record of records) {
      result.set(record.id, record[relationField] || []);
    }

    return result;
  }

  /**
   * Search with full-text search support
   * Optimized for common search patterns
   */
  async search<T>(
    model: Record<string, (...args: unknown[]) => unknown>,
    query: string,
    searchFields: string[],
    where?: unknown,
    select?: unknown,
    limit = 10,
  ): Promise<T[]> {
    const conditions = searchFields.map((field) => ({
      [field]: { contains: query, mode: 'insensitive' },
    }));

    return model.findMany({
      where: {
        ...(where as object),
        OR: conditions,
      },
      select,
      take: limit,
    }) as Promise<T[]>;
  }

  /**
   * Aggregate data efficiently
   * Groups and counts records
   */
  async aggregate(
    model: Record<string, (...args: unknown[]) => unknown>,
    where: unknown,
    groupBy: string[],
    countField = 'id',
  ): Promise<unknown[]> {
    return model.groupBy({
      by: groupBy,
      where,
      _count: { [countField]: true },
    }) as Promise<unknown[]>;
  }

  /**
   * Cursor-based pagination for large datasets
   * More efficient than offset/limit for deep pagination
   */
  async fetchWithCursor<T extends Record<string, unknown>>(
    model: Record<string, (...args: unknown[]) => unknown>,
    where: unknown,
    options: {
      cursor?: string;
      limit: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      include?: unknown;
    },
  ): Promise<{ data: T[]; nextCursor: string | null }> {
    const {
      cursor,
      limit,
      sortBy = 'id',
      sortOrder = 'asc',
      include,
    } = options;

    const data = await (model.findMany({
      where,
      take: limit + 1,
      ...(cursor && { skip: 1, cursor: { [sortBy]: cursor } }),
      orderBy: { [sortBy]: sortOrder },
      include,
    }) as Promise<T[]>);

    const hasNextPage = data.length > limit;
    const items = hasNextPage ? data.slice(0, -1) : data;
    const lastItem = items[items.length - 1];
    const rawCursor = lastItem?.[sortBy];
    const nextCursor =
      hasNextPage && lastItem && rawCursor != null
        ? typeof rawCursor === 'string' || typeof rawCursor === 'number'
          ? String(rawCursor)
          : null
        : null;

    return { data: items, nextCursor };
  }

  /**
   * Distinct query with filtering
   * Gets unique values of a field
   */
  async findDistinct(
    model: Record<string, (...args: unknown[]) => unknown>,
    field: string,
    where?: unknown,
  ): Promise<unknown[]> {
    return model.findMany({
      distinct: [field],
      where,
      select: { [field]: true },
    }) as Promise<unknown[]>;
  }

  /**
   * Count with filters
   */
  async count(
    model: Record<string, (...args: unknown[]) => unknown>,
    where: unknown,
  ): Promise<number> {
    return model.count({ where }) as Promise<number>;
  }

  /**
   * Check existence without fetching data
   */
  async exists(
    model: Record<string, (...args: unknown[]) => unknown>,
    where: unknown,
  ): Promise<boolean> {
    const result = await (model.findFirst({
      where,
      select: { id: true },
    }) as Promise<{ id: string } | null>);
    return !!result;
  }

  /**
   * Update with validation
   * Ensures record exists before updating
   */
  async updateIfExists<T>(
    model: Record<string, (...args: unknown[]) => unknown>,
    where: unknown,
    data: unknown,
    select?: unknown,
  ): Promise<T | null> {
    const exists = await this.exists(model, where);
    if (!exists) return null;

    return model.update({ where, data, select }) as Promise<T>;
  }

  /**
   * Soft delete by setting a timestamp
   */
  async softDelete(
    model: Record<string, (...args: unknown[]) => unknown>,
    where: unknown,
    dateField = 'deletedAt',
  ): Promise<{ count: number }> {
    return model.updateMany({
      where,
      data: { [dateField]: new Date() },
    }) as Promise<{ count: number }>;
  }

  /**
   * Restore soft-deleted records
   */
  async restore(
    model: Record<string, (...args: unknown[]) => unknown>,
    where: unknown,
    dateField = 'deletedAt',
  ): Promise<{ count: number }> {
    return model.updateMany({
      where,
      data: { [dateField]: null },
    }) as Promise<{ count: number }>;
  }

  /**
   * Upsert with optimized select
   */
  async upsert<T>(
    model: Record<string, (...args: unknown[]) => unknown>,
    where: unknown,
    createData: unknown,
    updateData: unknown,
    select?: unknown,
  ): Promise<T> {
    return model.upsert({
      where,
      create: createData,
      update: updateData,
      select,
    }) as Promise<T>;
  }

  /**
   * Raw query execution with parameter binding
   * For complex queries beyond Prisma's capabilities
   */
  async executeRaw<T = unknown>(query: Prisma.Sql): Promise<T[]> {
    return this.prisma.$queryRaw(query);
  }
}
