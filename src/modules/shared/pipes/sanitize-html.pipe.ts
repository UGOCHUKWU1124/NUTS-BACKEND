import { Injectable, PipeTransform } from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';

/**
 * Global pipe that sanitizes all string values in the incoming request body,
 * query parameters, and params using the `sanitize-html` library. It removes
 * potentially dangerous HTML tags and attributes to mitigate XSS attacks.
 *
 * After stripping tags, HTML entities (&amp; &lt; &gt; &quot; &#x27;) are
 * decoded back to their plain-text equivalents so downstream code and slug
 * generation always receives clean, un-escaped strings.
 */
@Injectable()
export class SanitizeHtmlPipe implements PipeTransform {
  transform(value: unknown): unknown {
    return this.sanitize(value);
  }

  private sanitize(value: unknown): unknown {
    if (typeof value === 'string') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const stripped: string = sanitizeHtml(value, {
        allowedTags: [], // strip all HTML tags
        allowedAttributes: {},
      });
      // Decode the HTML entities that sanitize-html introduces so that
      // plain text inputs like "Home & Living" are not stored as "Home &amp; Living".
      return this.decodeEntities(stripped);
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

  /**
   * Decode the five XML/HTML entities that sanitize-html may introduce when
   * stripping tags from a string that contained no actual markup.
   */
  private decodeEntities(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#39;/g, "'");
  }
}
