import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';

import { Reflector } from '@nestjs/core';

import { map, Observable } from 'rxjs';

import { MESSAGE_KEY } from 'src/modules/shared/decorators/message.decorator';

import {
  ApiResponseDto,
  PaginationMetaDto,
} from 'src/modules/shared/dto/api-response.dto';

type PaginatedPayload<T> = {
  data: T[];
  meta: PaginationMetaDto;
};

function isPaginatedPayload(
  value: unknown,
): value is PaginatedPayload<unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    Array.isArray(record.data) &&
    typeof record.meta === 'object' &&
    record.meta !== null
  );
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponseDto<T>
> {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponseDto<T>> {
    const message =
      this.reflector.getAllAndOverride<string>(MESSAGE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || 'Request successful';

    return next.handle().pipe(
      map((data: unknown): ApiResponseDto<T> => {
        const timestamp = new Date().toISOString();

        if (data === null || data === undefined) {
          return {
            success: true,
            message,
            data: null,
            timestamp,
          };
        }

        if (isPaginatedPayload(data)) {
          return {
            success: true,
            message,
            data: data.data as T,
            meta: data.meta,
            timestamp,
          };
        }

        return {
          success: true,
          message,
          data: data as T,
          timestamp,
        };
      }),
    );
  }
}
