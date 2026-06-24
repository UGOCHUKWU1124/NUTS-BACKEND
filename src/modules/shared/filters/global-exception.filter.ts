import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { getPrismaErrorDetail } from 'src/modules/shared/utils/prisma-error.util';

/** Shape returned by NestJS HttpException.getResponse() when validation fails. */
interface HttpExceptionBody {
  statusCode?: number;
  message?: string | string[];
  error?: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly config: ConfigService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: string[] | null = null;
    let errorCode = 'INTERNAL_ERROR';

    // HTTP exceptions
    if (exception instanceof HttpException) {
      status = exception.getStatus();

      const res = exception.getResponse() as HttpExceptionBody;
      const rawMessage = res?.message;

      if (Array.isArray(rawMessage)) {
        message = rawMessage[0];
        errors = rawMessage;
      } else if (typeof rawMessage === 'string') {
        message = rawMessage;
      } else if (typeof rawMessage === 'object') {
        message = exception.message;
      }

      // Map status codes to error codes
      const errorCodeMap: Record<number, string> = {
        [HttpStatus.BAD_REQUEST]: 'VALIDATION_ERROR',
        [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
        [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
        [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
        [HttpStatus.CONFLICT]: 'CONFLICT',
        [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
      };
      errorCode = errorCodeMap[status] ?? 'HTTP_ERROR';
    }

    // Prisma exceptions
    else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = getPrismaErrorDetail(exception);
      status = mapped.status;
      message = mapped.message;
      errorCode = 'DATABASE_ERROR';
      // Log detailed meta for debugging (especially P2003 FK violations)
      if (exception.code === 'P2003' && exception.meta) {
        this.logger.warn(
          `Prisma P2003 detail — field_name: ${JSON.stringify(exception.meta.field_name)}, model_name: ${JSON.stringify(exception.meta.model_name)}, related_model: ${JSON.stringify(exception.meta.related_model || exception.meta.related_model_name)}, constraint: ${JSON.stringify(exception.meta.constraint)}`,
        );
      }
    }

    // Logging
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url}`,
        exception instanceof Error
          ? exception.stack
          : JSON.stringify(exception),
      );
    } else if (status >= 400) {
      this.logger.warn(`${request.method} ${request.url} → ${message}`);
    }

    const isProduction = this.config.get('NODE_ENV') === 'production';

    response.status(status).json({
      success: false,
      message:
        status >= 500 && isProduction ? 'Internal server error' : message,
      error: {
        code: errorCode,
        ...(errors && !(status >= 500 && isProduction)
          ? { details: errors }
          : {}),
      },
      timestamp: new Date().toISOString(),
    });
  }
}
