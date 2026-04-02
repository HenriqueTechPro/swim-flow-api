import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common'
import type { ZodSchema } from 'zod'

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown) {
    const normalizedValue = this.normalizeValue(value)
    const result = this.schema.safeParse(normalizedValue)

    if (!result.success) {
      throw new BadRequestException(result.error.flatten())
    }

    return result.data
  }

  private normalizeValue(value: unknown) {
    if (typeof value !== 'string') {
      return value
    }

    const trimmedValue = value.trim()
    if (!trimmedValue) {
      return value
    }

    if (!(trimmedValue.startsWith('{') || trimmedValue.startsWith('['))) {
      return value
    }

    try {
      return JSON.parse(trimmedValue)
    } catch {
      return value
    }
  }
}
