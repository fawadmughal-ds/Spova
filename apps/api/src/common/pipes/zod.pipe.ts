import { PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';
import { ApiError } from '../errors';

export class ZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
      throw ApiError.badRequest('validation', details[0]?.message ?? 'Invalid input', details);
    }
    return result.data;
  }
}
