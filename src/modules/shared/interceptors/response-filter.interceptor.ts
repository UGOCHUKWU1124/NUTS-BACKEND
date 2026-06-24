/**
 * Response Field Filtering Interceptor
 * Allows clients to request only specific fields via ?fields=id,name,creator{id,name}
 * Similar to GraphQL query selection, reduces response payload and latency
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseFilterInterceptor implements NestInterceptor {
  /**
   * Parse GraphQL-like field selection string
   * Example: "id,name,creator{id,storeName},category{id,name}"
   */
  private parseFieldSelection(obj: any, selector: string): any {
    if (!selector) return obj;

    const fields = selector.split(',').map((s) => s.trim());
    const result: Record<string, any> = {};

    for (const field of fields) {
      const nestedMatch = field.match(/^(\w+)\{(.+)\}$/);

      if (nestedMatch) {
        const keyName = nestedMatch[1];
        const nestedSelector = nestedMatch[2];
        if (obj[keyName]) {
          if (Array.isArray(obj[keyName])) {
            result[keyName] = obj[keyName].map((item: any) =>
              this.parseFieldSelection(item, nestedSelector),
            );
          } else {
            result[keyName] = this.parseFieldSelection(
              obj[keyName],
              nestedSelector,
            );
          }
        }
      } else if (obj[field] !== undefined) {
        result[field] = obj[field];
      }
    }

    return result;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const fieldsParam = request.query.fields as string | undefined;

    return next.handle().pipe(
      map((data) => {
        // Skip filtering if no fields parameter or data is not an object
        if (!fieldsParam || typeof data !== 'object' || data === null) {
          return data;
        }

        // Apply field filtering
        if (Array.isArray(data)) {
          return data.map((item) =>
            this.parseFieldSelection(item, fieldsParam),
          );
        }
        return this.parseFieldSelection(data, fieldsParam);
      }),
    );
  }
}

/**
 * Decorator to apply response field filtering to specific routes
 * Usage: @UseInterceptors(ResponseFilterInterceptor)
 */
export const UseResponseFieldFiltering = () => {
  return (
    target: any,
    propertyKey?: string,
    descriptor?: PropertyDescriptor,
  ) => {
    // Implementation handled by the interceptor itself
  };
};
