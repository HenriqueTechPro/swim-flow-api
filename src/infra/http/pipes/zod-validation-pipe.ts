import {
  BadRequestException,
  Injectable,
  type PipeTransform,
} from '@nestjs/common';
import type { ZodSchema } from 'zod';

@Injectable()
export class ZodValidationPipe<TOutput = unknown> implements PipeTransform<
  unknown,
  TOutput
> {
  constructor(private readonly schema: ZodSchema<TOutput>) {}

  transform(value: unknown): TOutput {
    const normalizedValue = this.normalizeValue(value);
    const result = this.schema.safeParse(normalizedValue);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }

    return result.data;
  }

  private normalizeValue(value: unknown): unknown {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return value;
    }

    if (!(trimmedValue.startsWith('{') || trimmedValue.startsWith('['))) {
      return value;
    }

    try {
      const parsedValue: unknown = JSON.parse(trimmedValue);
      return parsedValue;
    } catch {
      return value;
    }
  }
}
