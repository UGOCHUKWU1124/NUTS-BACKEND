import { Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class NormalizeInputPipe implements PipeTransform {
  transform(value: unknown): unknown {
    return this.normalize(value);
  }

  private normalize(value: unknown): unknown {
    if (typeof value === 'string') {
      return value.trim();
    }

    if (Array.isArray(value)) {
      return value.map((v: unknown) => this.normalize(v));
    }

    if (typeof value === 'object' && value !== null) {
      const record = value as Record<string, unknown>;
      const result: Record<string, unknown> = {};

      for (const key of Object.keys(record)) {
        result[key] = this.normalize(record[key]);
      }

      return result;
    }

    return value;
  }
}
