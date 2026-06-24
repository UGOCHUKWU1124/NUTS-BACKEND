import { Injectable, PipeTransform } from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';

/**
 * Global pipe that sanitizes all string values in the incoming request body,
 * query parameters, and params using the `sanitize-html` library. It removes
 * potentially dangerous HTML tags and attributes to mitigate XSS attacks.
 */
@Injectable()
export class SanitizeHtmlPipe implements PipeTransform {
  transform(value: unknown): unknown {
    return this.sanitize(value);
  }

  private sanitize(value: unknown): unknown {
    if (typeof value === 'string') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      return sanitizeHtml(value, {
        allowedTags: [], // strip all HTML tags
        allowedAttributes: {},
      });
    }

    if (Array.isArray(value)) {
      return value.map((v) => this.sanitize(v));
    }

    if (typeof value === 'object' && value !== null) {
      const record = value as Record<string, unknown>;
      const result: Record<string, unknown> = {};
      for (const key of Object.keys(record)) {
        result[key] = this.sanitize(record[key]);
      }
      return result;
    }

    return value;
  }
}
