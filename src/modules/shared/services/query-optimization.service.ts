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
    model: any,
    where: any,
    options: PaginationOptions,
    include?: any,
  ): Promise<{ data: T[]; total: number; page: number; limit: number }> {
    const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = options;

    const [total, data] = await this.prisma.$transaction([
      model.count({ where }),
      model.findMany({
        where,
        include,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * Batch fetch multiple IDs efficiently (prevents N+1)
   * Groups requests and fetches in parallel
   */
  async batchFetchByIds<T>(
    model: any,
    ids: string[],
    select: any,
    options?: BatchFetchOptions,
  ): Promise<Map<string, T>> {
    const chunkSize = options?.chunkSize || 100;
    const chunks: string[][] = [];

    for (let i = 0; i < ids.length; i += chunkSize) {
      chunks.push(ids.slice(i, i + chunkSize));
    }

    const results = new Map<string, T>();

    const promises = chunks.map((chunk) =>
      model.findMany({
        where: { id: { in: chunk } },
        select,
      }),
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
    model: any,
    data: any[],
    options?: { skipDuplicates?: boolean },
  ): Promise<{ count: number; created: T[] }> {
    if (data.length === 0) {
      return { count: 0, created: [] };
    }

    const result = await model.createMany({
      data,
      skipDuplicates: options?.skipDuplicates || false,
    });

    return { count: result.count, created: data };
  }

  /**
   * Batch update multiple records efficiently
   */
  async batchUpdate<T>(
    model: any,
    updates: Array<{ where: any; data: any }>,
  ): Promise<{ count: number }> {
    if (updates.length === 0) {
      return { count: 0 };
    }

    let totalCount = 0;

    for (const update of updates) {
      const result = await model.updateMany(update);
      totalCount += result.count;
    }

    return { count: totalCount };
  }

  /**
   * Batch delete multiple records efficiently
   */
  async batchDelete(model: any, ids: string[]): Promise<{ count: number }> {
    if (ids.length === 0) {
      return { count: 0 };
    }

    const result = await model.deleteMany({
      where: { id: { in: ids } },
    });

    return { count: result.count };
  }

  /**
   * Fetch related records for multiple parent records
   * Prevents N+1 by fetching all related records at once
   */
  async fetchRelatedForMany<T>(
    model: any,
    parentIds: string[],
    relationField: string,
    select?: any,
  ): Promise<Map<string, T[]>> {
    const records = await model.findMany({
      where: { id: { in: parentIds } },
      select: {
        id: true,
        [relationField]: { select },
      },
    });

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
    model: any,
    query: string,
    searchFields: string[],
    where?: any,
    select?: any,
    limit = 10,
  ): Promise<T[]> {
    const conditions = searchFields.map((field) => ({
      [field]: { contains: query, mode: 'insensitive' },
    }));

    return model.findMany({
      where: {
        ...where,
        OR: conditions,
      },
      select,
      take: limit,
    });
  }

  /**
   * Aggregate data efficiently
   * Groups and counts records
   */
  async aggregate(
    model: any,
    where: any,
    groupBy: string[],
    countField = 'id',
  ): Promise<any[]> {
    return model.groupBy({
      by: groupBy,
      where,
      _count: { [countField]: true },
    });
  }

  /**
   * Cursor-based pagination for large datasets
   * More efficient than offset/limit for deep pagination
   */
  async fetchWithCursor<T>(
    model: any,
    where: any,
    options: {
      cursor?: any;
      limit: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      include?: any;
    },
  ): Promise<{ data: T[]; nextCursor: string | null }> {
    const {
      cursor,
      limit,
      sortBy = 'id',
      sortOrder = 'asc',
      include,
    } = options;

    const data = await model.findMany({
      where,
      take: limit + 1, // Fetch one extra to determine if there's a next page
      ...(cursor && { skip: 1, cursor: { [sortBy]: cursor } }),
      orderBy: { [sortBy]: sortOrder },
      include,
    });

    const hasNextPage = data.length > limit;
    const items = hasNextPage ? data.slice(0, -1) : data;
    const nextCursor = hasNextPage ? items[items.length - 1]?.[sortBy] : null;

    return { data: items, nextCursor };
  }

  /**
   * Distinct query with filtering
   * Gets unique values of a field
   */
  async findDistinct(model: any, field: string, where?: any): Promise<any[]> {
    return model.findMany({
      distinct: [field],
      where,
      select: { [field]: true },
    });
  }

  /**
   * Count with filters
   * Simple count query
   */
  async count(model: any, where: any): Promise<number> {
    return model.count({ where });
  }

  /**
   * Check existence without fetching data
   */
  async exists(model: any, where: any): Promise<boolean> {
    const result = await model.findFirst({
      where,
      select: { id: true },
    });
    return !!result;
  }

  /**
   * Update with validation
   * Ensures record exists before updating
   */
  async updateIfExists<T>(
    model: any,
    where: any,
    data: any,
    select?: any,
  ): Promise<T | null> {
    const exists = await this.exists(model, where);
    if (!exists) return null;

    return model.update({ where, data, select });
  }

  /**
   * Soft delete by setting a timestamp
   */
  async softDelete(
    model: any,
    where: any,
    dateField = 'deletedAt',
  ): Promise<{ count: number }> {
    return model.updateMany({
      where,
      data: { [dateField]: new Date() },
    });
  }

  /**
   * Restore soft-deleted records
   */
  async restore(
    model: any,
    where: any,
    dateField = 'deletedAt',
  ): Promise<{ count: number }> {
    return model.updateMany({
      where,
      data: { [dateField]: null },
    });
  }

  /**
   * Upsert with optimized select
   */
  async upsert<T>(
    model: any,
    where: any,
    createData: any,
    updateData: any,
    select?: any,
  ): Promise<T> {
    return model.upsert({
      where,
      create: createData,
      update: updateData,
      select,
    });
  }

  /**
   * Raw query execution with parameter binding
   * For complex queries beyond Prisma's capabilities
   */
  async executeRaw<T = any>(query: Prisma.Sql): Promise<T[]> {
    return this.prisma.$queryRaw(query);
  }
}
